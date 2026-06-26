import type { MediaAsset, MediaEntityType, MediaAssetStatus, ModerationCaseStatus, ModerationContentType } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { buildMinimalModerationPayload } from './moderation.payloads.js';
import { scanWithConfiguredModerationProvider } from './moderation.provider.js';
import { storeModerationProviderResult } from './moderation.results.js';

const publicImageEntityTypes = new Set<MediaEntityType>(['need', 'offer', 'trade', 'profile', 'place', 'plan', 'plan_place']);
const imageModerationContentTypes = new Set<ModerationContentType>(['media', 'profile_image', 'trade_image', 'need_image', 'offer_image']);
const openModerationCaseStatuses = new Set<ModerationCaseStatus>(['pending', 'needs_review', 'failed', 'limited']);

function mediaCaseReason(media: Pick<MediaAsset, 'entityType' | 'entityId' | 'filename'>) {
  const entity = media.entityType && media.entityId ? `${media.entityType} ${media.entityId}` : 'a public surface';
  return `Public image attached to ${entity} is waiting for manual review.${media.filename ? `\n\nFilename: ${media.filename}` : ''}`;
}

export function isPublicImageReviewEnabled() {
  return env.moderationEnabled && env.publicImageReviewEnabled;
}

export function isPublicImageEntityType(entityType: MediaEntityType | null | undefined) {
  return Boolean(entityType && publicImageEntityTypes.has(entityType));
}

export function moderationContentTypeForMediaEntity(entityType: MediaEntityType | null | undefined): ModerationContentType {
  if (entityType === 'profile') return 'profile_image';
  if (entityType === 'trade') return 'trade_image';
  if (entityType === 'need') return 'need_image';
  if (entityType === 'offer') return 'offer_image';
  return 'media';
}

export function mediaStatusForModerationCaseStatus(status: ModerationCaseStatus): MediaAssetStatus | null {
  if (status === 'approved') return 'active';
  if (status === 'needs_review' || status === 'pending' || status === 'failed') return 'pending_review';
  if (status === 'limited') return 'flagged';
  if (status === 'rejected' || status === 'removed') return 'removed';
  if (status === 'skipped') return null;
  return null;
}

export function moderationCaseStatusForMediaStatus(status: MediaAssetStatus): ModerationCaseStatus {
  if (status === 'active') return 'approved';
  if (status === 'pending_review') return 'needs_review';
  if (status === 'flagged') return 'limited';
  return 'removed';
}

export async function enqueuePublicImageReview(mediaId: string, options: { actorId?: string | null; reason?: string | null } = {}) {
  if (!isPublicImageReviewEnabled()) return null;

  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!media || media.status === 'removed' || !isPublicImageEntityType(media.entityType)) return null;

  const contentType = moderationContentTypeForMediaEntity(media.entityType);
  const reason = options.reason?.trim() || mediaCaseReason(media);

  const moderationCase = await prisma.$transaction(async (tx: any) => {
    const existing = await tx.moderationCase.findFirst({
      where: {
        contentId: media.id,
        contentType: { in: Array.from(imageModerationContentTypes) },
        source: 'upload',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const nextStatus = openModerationCaseStatuses.has(existing.status) ? 'needs_review' : existing.status;
      const updated = await tx.moderationCase.update({
        where: { id: existing.id },
        data: {
          contentType,
          contentOwnerId: media.ownerId,
          visibility: 'public',
          reason,
          ...(openModerationCaseStatuses.has(existing.status) ? { status: nextStatus, resolvedById: null, resolvedAt: null } : {}),
        },
      });
      if (openModerationCaseStatuses.has(existing.status) && media.status === 'active') {
        await tx.mediaAsset.update({ where: { id: media.id }, data: { status: 'pending_review', reviewNote: 'Queued for public image review.', reviewedAt: null, reviewerId: null } });
      }
      return updated;
    }

    const created = await tx.moderationCase.create({
      data: {
        contentType,
        contentId: media.id,
        contentOwnerId: media.ownerId,
        source: 'upload',
        status: 'needs_review',
        priority: 55,
        visibility: 'public',
        reason,
      },
    });

    await tx.moderationAction.create({
      data: {
        caseId: created.id,
        action: 'case_created',
        actorType: options.actorId ? 'user' : 'system',
        actorId: options.actorId ?? null,
        nextStatus: 'needs_review',
        note: 'Public image review case created when media was attached to public content.',
        metadata: {
          mediaId: media.id,
          entityType: media.entityType,
          entityId: media.entityId,
          filename: media.filename,
        },
      },
    });

    await tx.mediaAsset.update({
      where: { id: media.id },
      data: { status: 'pending_review', reviewNote: 'Queued for public image review.', reviewedAt: null, reviewerId: null },
    });

    return created;
  });

  const payload = buildMinimalModerationPayload({
    contentId: media.id,
    contentType,
    visibility: 'public',
    scanType: 'image',
    mediaId: media.id,
    temporaryImageUrl: media.url,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    appArea: media.entityType ? `${media.entityType}_image` : 'media_upload',
  });
  const providerResult = await scanWithConfiguredModerationProvider(payload);
  await prisma.$transaction(async (tx: any) => {
    await storeModerationProviderResult(tx, moderationCase.id, providerResult);
  });

  return moderationCase;
}

export async function enqueuePublicImageReviews(mediaIds: string[], options: { actorId?: string | null; reason?: string | null } = {}) {
  if (!isPublicImageReviewEnabled()) return [];
  const uniqueIds = Array.from(new Set(mediaIds.filter(Boolean)));
  const cases = [];
  for (const mediaId of uniqueIds) {
    const moderationCase = await enqueuePublicImageReview(mediaId, options);
    if (moderationCase) cases.push(moderationCase);
  }
  return cases;
}

export async function syncMediaModerationCasesFromAdminStatus(media: Pick<MediaAsset, 'id' | 'ownerId' | 'entityType' | 'entityId' | 'status'>, input: { nextStatus: MediaAssetStatus; adminId: string; note?: string | null }) {
  const moderationCaseClient = (prisma as any).moderationCase;
  if (!moderationCaseClient) return;
  const cases = await moderationCaseClient.findMany({
    where: { contentId: media.id, contentType: { in: Array.from(imageModerationContentTypes) } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  if (!cases.length) return;

  const nextStatus = moderationCaseStatusForMediaStatus(input.nextStatus);
  const now = new Date();
  await prisma.$transaction(async (tx: any) => {
    for (const moderationCase of cases) {
      await tx.moderationCase.update({
        where: { id: moderationCase.id },
        data: {
          status: nextStatus,
          contentType: moderationContentTypeForMediaEntity(media.entityType),
          contentOwnerId: media.ownerId,
          visibility: isPublicImageEntityType(media.entityType) ? 'public' : moderationCase.visibility,
          resolvedById: nextStatus === 'needs_review' ? null : input.adminId,
          resolvedAt: nextStatus === 'needs_review' ? null : now,
        },
      });
      await tx.moderationAction.create({
        data: {
          caseId: moderationCase.id,
          action: nextStatus === 'approved' ? 'approve' : nextStatus === 'limited' ? 'limit' : nextStatus === 'removed' ? 'remove' : 'mark_needs_review',
          actorType: 'admin',
          actorId: input.adminId,
          note: input.note ?? null,
          previousStatus: moderationCase.status,
          nextStatus,
          metadata: {
            mediaId: media.id,
            mediaStatus: input.nextStatus,
            entityType: media.entityType,
            entityId: media.entityId,
          },
        },
      });
    }
  });
}

export async function applyMediaStatusFromModerationCaseAction(input: { contentType: ModerationContentType; contentId: string; action: 'mark_needs_review' | 'approve' | 'reject' | 'limit' | 'remove' | 'restore' | 'resolve' | 'add_note'; adminId: string; note?: string | null }) {
  if (!imageModerationContentTypes.has(input.contentType)) return false;
  if (input.action === 'add_note' || input.action === 'resolve') return false;
  const mediaStatus = input.action === 'approve' || input.action === 'restore'
    ? 'active'
    : input.action === 'mark_needs_review'
      ? 'pending_review'
      : input.action === 'limit'
        ? 'flagged'
        : 'removed';

  const updated = await prisma.mediaAsset.updateMany({
    where: { id: input.contentId, status: { not: mediaStatus } },
    data: { status: mediaStatus, reviewNote: input.note ?? null, reviewerId: input.adminId, reviewedAt: new Date() },
  });
  return updated.count > 0;
}
