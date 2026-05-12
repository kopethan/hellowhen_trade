import { Router } from 'express';
import { createReportRequestSchema, type ReportTargetType } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const reportsRoutes = Router();

const reportUserSelect = { id: true, email: true, role: true, trustTier: true, emailVerifiedAt: true, twoFactorEnabled: true, createdAt: true, profile: true } as const;
const unresolvedReportStatuses = ['pending', 'reviewing'] as const;

type ReportRecord = {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string | null;
  reason: string;
  details?: string | null;
  status: string;
  reviewedById?: string | null;
  reviewedAt?: Date | string | null;
  resolutionNote?: string | null;
  escalatedSupportTicketId?: string | null;
  escalatedAt?: Date | string | null;
  escalatedById?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  reporter?: unknown;
  reviewer?: unknown;
};

type ReportTargetSummary = {
  type: ReportTargetType;
  id: string;
  label: string;
  ownerId?: string | null;
  owner?: unknown;
  status?: string | null;
  isPublic?: boolean | null;
  url?: string | null;
};

function userLabel(user: { email?: string | null; profile?: { displayName?: string | null; handle?: string | null } | null }) {
  return user.profile?.displayName?.trim() || user.profile?.handle?.trim() || user.email || 'Unknown user';
}

export async function findReportTarget(targetType: ReportTargetType, targetId: string): Promise<ReportTargetSummary | null> {
  if (targetType === 'user') {
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: reportUserSelect });
    return user ? { type: targetType, id: user.id, label: userLabel(user), ownerId: user.id, owner: user, status: user.trustTier, url: `/users/${user.id}` } : null;
  }

  if (targetType === 'profile') {
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: reportUserSelect });
    if (user) return { type: targetType, id: user.id, label: userLabel(user), ownerId: user.id, owner: user, status: user.trustTier, url: `/users/${user.id}` };
    const profile = await prisma.profile.findUnique({ where: { id: targetId }, include: { user: { select: reportUserSelect } } });
    return profile ? { type: targetType, id: profile.id, label: userLabel(profile.user), ownerId: profile.userId, owner: profile.user, url: `/users/${profile.userId}` } : null;
  }

  if (targetType === 'trade') {
    const trade = await prisma.trade.findUnique({ where: { id: targetId }, include: { owner: { select: reportUserSelect } } });
    return trade ? { type: targetType, id: trade.id, label: trade.title, ownerId: trade.ownerId, owner: trade.owner, status: trade.status, isPublic: trade.isPublic, url: `/trades/${trade.id}` } : null;
  }

  if (targetType === 'need') {
    const need = await prisma.need.findUnique({ where: { id: targetId }, include: { owner: { select: reportUserSelect } } });
    return need ? { type: targetType, id: need.id, label: need.title, ownerId: need.ownerId, owner: need.owner, status: need.status, url: `/needs/${need.id}` } : null;
  }

  if (targetType === 'offer') {
    const offer = await prisma.offer.findUnique({ where: { id: targetId }, include: { owner: { select: reportUserSelect } } });
    return offer ? { type: targetType, id: offer.id, label: offer.title, ownerId: offer.ownerId, owner: offer.owner, status: offer.status, url: `/offers/${offer.id}` } : null;
  }

  if (targetType === 'proposal') {
    const proposal = await prisma.tradeProposal.findUnique({ where: { id: targetId }, include: { applicant: { select: reportUserSelect }, trade: { select: { id: true, title: true, ownerId: true } } } });
    return proposal ? { type: targetType, id: proposal.id, label: proposal.trade?.title ?? 'Proposal', ownerId: proposal.applicantId, owner: proposal.applicant, status: proposal.status, url: proposal.tradeId ? `/trades/${proposal.tradeId}` : null } : null;
  }

  if (targetType === 'message') {
    const message = await prisma.proposalMessage.findUnique({ where: { id: targetId }, include: { sender: { select: reportUserSelect }, proposal: { select: { tradeId: true } } } });
    const label = message?.body?.trim() ? `${message.body.trim().slice(0, 72)}${message.body.trim().length > 72 ? '…' : ''}` : 'Proposal message';
    return message ? { type: targetType, id: message.id, label, ownerId: message.senderId, owner: message.sender, url: message.proposal?.tradeId ? `/trades/${message.proposal.tradeId}` : null } : null;
  }

  const media = await prisma.mediaAsset.findUnique({ where: { id: targetId }, include: { owner: { select: reportUserSelect } } });
  return media ? { type: targetType, id: media.id, label: media.filename || media.storageKey || 'Media asset', ownerId: media.ownerId, owner: media.owner, status: media.status, url: media.url } : null;
}

export async function hydrateReports<T extends ReportRecord>(reports: T[]) {
  const targets = await Promise.all(reports.map((report) => findReportTarget(report.targetType, report.targetId)));
  return reports.map((report, index) => ({ ...report, target: targets[index] ?? null }));
}

export async function moderateReportedTarget(targetType: ReportTargetType, targetId: string, action: 'hide_target' | 'suspend_target_owner', adminId: string) {
  const target = await findReportTarget(targetType, targetId);
  if (!target) return null;

  if (action === 'suspend_target_owner') {
    if (!target.ownerId) return null;
    const now = new Date();
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({ where: { id: target.ownerId! }, data: { trustTier: 'restricted', trustTierUpdatedAt: now, trustTierNote: 'Restricted from admin report queue.', sessionRevokedAt: now, sensitiveActionVerifiedAt: null } });
      await tx.session.updateMany({ where: { userId: target.ownerId!, revokedAt: null }, data: { revokedAt: now } });
      await (tx as any).adminAuditLog?.create({ data: { adminId, action: 'report.target_owner.suspend', targetType: 'user', targetId: target.ownerId, reason: 'Suspended from report queue.', previousValue: { targetType, targetId }, nextValue: { trustTier: 'restricted' } } });
    });
    return findReportTarget(targetType, targetId);
  }

  if (targetType === 'trade') await prisma.trade.update({ where: { id: targetId }, data: { isPublic: false } });
  else if (targetType === 'need') await prisma.need.update({ where: { id: targetId }, data: { status: 'closed' } });
  else if (targetType === 'offer') await prisma.offer.update({ where: { id: targetId }, data: { status: 'closed' } });
  else if (targetType === 'media') await prisma.mediaAsset.update({ where: { id: targetId }, data: { status: 'removed', reviewedAt: new Date(), reviewerId: adminId, reviewNote: 'Removed from admin report queue.' } });
  else return null;

  await (prisma as any).adminAuditLog?.create({ data: { adminId, action: `report.target.${targetType}.hide`, targetType, targetId, reason: 'Hidden from report queue.', previousValue: { status: target.status, isPublic: target.isPublic }, nextValue: await findReportTarget(targetType, targetId) } });
  return findReportTarget(targetType, targetId);
}

reportsRoutes.use(requireAuth);

reportsRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createReportRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const target = await findReportTarget(input.targetType, input.targetId);
  if (!target) return res.status(404).json({ error: 'target_not_found', message: 'The reported item could not be found.' });
  if (target.ownerId === actorId) return res.status(409).json({ error: 'cannot_report_own_content', message: 'You cannot report your own profile or content here. Use support for help with your own trade.' });

  const existing = await (prisma as any).report.findFirst({
    where: { reporterId: actorId, targetType: input.targetType, targetId: input.targetId, status: { in: unresolvedReportStatuses } },
    include: { reporter: { select: reportUserSelect }, reviewer: { select: reportUserSelect } },
  });
  if (existing) {
    const [report] = await hydrateReports([existing]);
    return res.json({ report, duplicate: true });
  }

  const report = await (prisma as any).report.create({
    data: {
      reporterId: actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetOwnerId: target.ownerId ?? null,
      reason: input.reason,
      details: input.details?.trim() || null,
    },
    include: { reporter: { select: reportUserSelect }, reviewer: { select: reportUserSelect } },
  });
  const [hydrated] = await hydrateReports([report]);
  return res.status(201).json({ report: hydrated, duplicate: false });
}));

reportsRoutes.get('/mine', asyncRoute(async (req, res) => {
  const reports = await (prisma as any).report.findMany({
    where: { reporterId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { reporter: { select: reportUserSelect }, reviewer: { select: reportUserSelect } },
  });
  res.json({ reports: await hydrateReports(reports) });
}));
