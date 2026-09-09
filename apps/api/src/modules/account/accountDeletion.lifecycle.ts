import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cleanupRemovedMediaStorage } from '../media/media.cleanup.js';
import { normalizeMediaVariants } from '../media/media.variants.js';
import { getMediaStorageProvider } from '../media/storage/mediaStorageProvider.js';

export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30;
export const ACCOUNT_DELETION_GRACE_PERIOD_MS = ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETION_PROCESS_INTERVAL_MS = 15 * 60 * 1000;
const ACCOUNT_DELETION_BATCH_SIZE = 25;

const deletableStatuses = ['requested', 'in_review'] as const;
const businessRolePriority = new Map([
  ['owner', 0],
  ['admin', 1],
  ['finance', 2],
  ['member', 3],
]);

export function accountDeletionScheduledFor(requestedAt = new Date()) {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_MS);
}

export function isAccountDeletionDue(
  request: { status: string; scheduledFor: Date | string },
  now = new Date(),
) {
  if (!deletableStatuses.includes(request.status as (typeof deletableStatuses)[number])) return false;
  const scheduledFor = request.scheduledFor instanceof Date ? request.scheduledFor : new Date(request.scheduledFor);
  return Number.isFinite(scheduledFor.getTime()) && scheduledFor.getTime() <= now.getTime();
}

async function cleanupOwnedMedia(userId: string) {
  const media = await prisma.mediaAsset.findMany({
    where: { ownerId: userId },
    select: { id: true, url: true, storageKey: true, variantsJson: true },
  });
  const provider = getMediaStorageProvider();
  for (const asset of media) {
    if (provider.driver === 'local') {
      const storageKeys = new Set<string>();
      if (asset.storageKey) storageKeys.add(asset.storageKey);
      const variants = normalizeMediaVariants(asset.variantsJson);
      if (variants) {
        for (const variant of Object.values(variants)) {
          if (variant?.storageKey) storageKeys.add(variant.storageKey);
        }
      }
      await provider.deleteImages({ storageKeys: Array.from(storageKeys) });
      continue;
    }
    await cleanupRemovedMediaStorage(asset, 'accountDeletion.lifecycle');
  }
}

async function transferOwnedBusinesses(tx: Prisma.TransactionClient, userId: string) {
  const businesses = await tx.businessProfile.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      members: {
        where: { userId: { not: userId } },
        select: { id: true, userId: true, role: true, createdAt: true },
      },
    },
  });

  for (const business of businesses) {
    const successor = [...business.members].sort((left, right) => {
      const roleDifference = (businessRolePriority.get(left.role) ?? 99) - (businessRolePriority.get(right.role) ?? 99);
      if (roleDifference !== 0) return roleDifference;
      return left.createdAt.getTime() - right.createdAt.getTime();
    })[0];
    if (!successor) continue;

    await tx.businessProfile.update({ where: { id: business.id }, data: { ownerId: successor.userId } });
    await tx.businessProfileMember.update({ where: { id: successor.id }, data: { role: 'owner' } });
  }
}

async function completeClaimedDeletion(requestId: string, userId: string, now: Date) {
  await cleanupOwnedMedia(userId);

  await prisma.$transaction(async (tx) => {
    const current = await tx.accountDeletionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true, status: true, supportTicketId: true },
    });
    if (!current || current.status !== 'processing' || current.userId !== userId) return;

    await transferOwnedBusinesses(tx, userId);

    if (current.supportTicketId) {
      await tx.supportTicket.updateMany({
        where: { id: current.supportTicketId, userId },
        data: { status: 'closed', resolvedAt: now },
      });
    }

    // Keep only a non-identifying lifecycle receipt after the User row is deleted.
    await tx.accountDeletionRequest.update({
      where: { id: current.id },
      data: {
        status: 'completed',
        reason: null,
        details: null,
        supportTicketId: null,
        completedAt: now,
      },
    });

    // User-owned rows are configured to cascade, while moderation/review references
    // that must remain are SetNull. Business workspaces with another member are
    // transferred above so deleting a personal login does not erase a team workspace.
    await tx.user.delete({ where: { id: userId } });
  });
}

export async function processDueAccountDeletions(now = new Date()) {
  const due = await prisma.accountDeletionRequest.findMany({
    where: {
      status: { in: [...deletableStatuses] },
      scheduledFor: { lte: now },
      userId: { not: null },
    },
    orderBy: { scheduledFor: 'asc' },
    take: ACCOUNT_DELETION_BATCH_SIZE,
    select: { id: true, userId: true },
  });

  let completed = 0;
  let failed = 0;
  for (const candidate of due) {
    if (!candidate.userId) continue;
    const claimed = await prisma.accountDeletionRequest.updateMany({
      where: {
        id: candidate.id,
        userId: candidate.userId,
        status: { in: [...deletableStatuses] },
        scheduledFor: { lte: now },
      },
      data: { status: 'processing', reviewedAt: now },
    });
    if (claimed.count !== 1) continue;

    try {
      await completeClaimedDeletion(candidate.id, candidate.userId, now);
      completed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[account-deletion] automatic deletion failed for request ${candidate.id}. It will be retried.`, error);
      await prisma.accountDeletionRequest.updateMany({
        where: { id: candidate.id, status: 'processing' },
        data: { status: 'in_review' },
      }).catch(() => undefined);
    }
  }

  return { scanned: due.length, completed, failed };
}

export function startAccountDeletionLifecycle() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processDueAccountDeletions();
      if (result.completed > 0 || result.failed > 0) {
        console.info(`[account-deletion] processed ${result.completed} deletion(s); ${result.failed} failed.`);
      }
    } catch (error) {
      console.error('[account-deletion] lifecycle sweep failed.', error);
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => { void run(); }, ACCOUNT_DELETION_PROCESS_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
