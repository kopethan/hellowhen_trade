import { Router } from 'express';
import { createReportRequestSchema, type ReportTargetType } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { publicTradeVisibilityWhere } from '../trades/trades.routes.js';
import { createModerationCaseForReport, ensureReportModerationCase } from '../moderation/moderation.reportCases.js';

export const reportsRoutes = Router();

const reportUserSelect = { id: true, email: true, role: true, trustTier: true, emailVerifiedAt: true, twoFactorEnabled: true, createdAt: true, profile: true } as const;
const unresolvedReportStatuses = ['pending', 'reviewing'] as const;

type ReportRecord = {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string | null;
  moderationCaseId?: string | null;
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

  if (targetType === 'plan') {
    const plan = await prisma.plan.findUnique({ where: { id: targetId }, include: { owner: { select: reportUserSelect } } });
    return plan ? { type: targetType, id: plan.id, label: plan.title, ownerId: plan.ownerId, owner: plan.owner, status: plan.status, isPublic: ['open', 'full', 'started'].includes(plan.status), url: `/plans/${plan.id}` } : null;
  }

  if (targetType === 'plan_place') {
    const place = await prisma.planPlace.findUnique({ where: { id: targetId }, include: { plan: { include: { owner: { select: reportUserSelect } } } } });
    return place ? { type: targetType, id: place.id, label: place.title, ownerId: place.plan.ownerId, owner: place.plan.owner, status: place.plan.status, isPublic: ['open', 'full', 'started'].includes(place.plan.status), url: `/plans/${place.planId}` } : null;
  }

  if (targetType === 'proposal') {
    const proposal = await prisma.tradeProposal.findUnique({
      where: { id: targetId },
      include: { applicant: { select: reportUserSelect }, trade: { select: { id: true, title: true, ownerId: true, providerId: true, status: true } } },
    });
    if (!proposal) return null;
    const isAcceptedDeal = proposal.status === 'accepted';
    const tradeStatus = proposal.trade?.status ?? null;
    return {
      type: targetType,
      id: proposal.id,
      label: `${isAcceptedDeal ? 'Accepted deal' : 'Proposal'}: ${proposal.trade?.title ?? 'Proposal'}`,
      ownerId: proposal.applicantId,
      owner: proposal.applicant,
      status: tradeStatus ? `${proposal.status} · ${tradeStatus}` : proposal.status,
      isPublic: false,
      url: proposal.tradeId ? `/trades/${proposal.tradeId}/proposals/${proposal.id}` : null,
    };
  }

  if (targetType === 'message') {
    const message = await prisma.proposalMessage.findUnique({ where: { id: targetId }, include: { sender: { select: reportUserSelect }, proposal: { select: { tradeId: true } } } });
    const label = message?.body?.trim() ? `${message.body.trim().slice(0, 72)}${message.body.trim().length > 72 ? '…' : ''}` : 'Proposal message';
    return message ? { type: targetType, id: message.id, label, ownerId: message.senderId, owner: message.sender, url: message.proposal?.tradeId ? `/trades/${message.proposal.tradeId}` : null } : null;
  }

  if (targetType === 'public_message') {
    const message = await prisma.tradePublicMessage.findUnique({
      where: { id: targetId },
      include: { author: { select: reportUserSelect }, trade: { select: { id: true, title: true, ownerId: true, status: true, isPublic: true } } },
    });
    if (message) {
      const label = message.body?.trim() ? `${message.body.trim().slice(0, 72)}${message.body.trim().length > 72 ? '…' : ''}` : 'Public discussion message';
      return { type: targetType, id: message.id, label, ownerId: message.authorId, owner: message.author, status: message.status, isPublic: message.trade?.isPublic ?? null, url: message.tradeId ? `/trades/${message.tradeId}/discussion` : null };
    }

    const planMessage = await prisma.planPublicMessage.findUnique({
      where: { id: targetId },
      include: { author: { select: reportUserSelect }, plan: { select: { id: true, title: true, ownerId: true, status: true } } },
    });
    const label = planMessage?.body?.trim() ? `${planMessage.body.trim().slice(0, 72)}${planMessage.body.trim().length > 72 ? '…' : ''}` : 'Plan discussion message';
    return planMessage ? { type: targetType, id: planMessage.id, label, ownerId: planMessage.authorId, owner: planMessage.author, status: planMessage.status, isPublic: visiblePlanStatuses.includes(planMessage.plan?.status as any), url: planMessage.planId ? `/plans/${planMessage.planId}` : null } : null;
  }

  const media = await prisma.mediaAsset.findUnique({ where: { id: targetId }, include: { owner: { select: reportUserSelect } } });
  return media ? { type: targetType, id: media.id, label: media.filename || media.storageKey || 'Media asset', ownerId: media.ownerId, owner: media.owner, status: media.status, url: media.url } : null;
}


type ReportAccessDecision =
  | { allowed: true }
  | { allowed: false; status: number; error: string; message: string };

const visiblePlanStatuses = ['open', 'full', 'started'] as const;

async function canReportTarget(actorId: string, target: ReportTargetSummary): Promise<ReportAccessDecision> {
  if (target.ownerId === actorId) {
    return { allowed: false, status: 409, error: 'cannot_report_own_content', message: 'You cannot report your own profile or content here. Use support for help with your own trade.' };
  }

  if (target.ownerId && await usersHaveBlockBetween(actorId, target.ownerId)) {
    return { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'user' || target.type === 'profile') {
    if (target.status === 'restricted') return { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
    return { allowed: true };
  }

  if (target.type === 'trade') {
    const trade = await prisma.trade.findFirst({
      where: {
        id: target.id,
        OR: [
          publicTradeVisibilityWhere(),
          { ownerId: actorId },
          { providerId: actorId },
          { proposals: { some: { applicantId: actorId } } },
        ],
      },
      select: { id: true },
    });
    return trade ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'need') {
    const visibleTrade = await prisma.trade.findFirst({ where: { needId: target.id, ...publicTradeVisibilityWhere() }, select: { id: true } });
    return visibleTrade ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'offer') {
    const visibleTrade = await prisma.trade.findFirst({ where: { offerId: target.id, ...publicTradeVisibilityWhere() }, select: { id: true } });
    return visibleTrade ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'proposal') {
    const proposal = await prisma.tradeProposal.findFirst({
      where: {
        id: target.id,
        OR: [
          { applicantId: actorId },
          { trade: { ownerId: actorId } },
          { trade: { providerId: actorId } },
        ],
      },
      select: { id: true },
    });
    return proposal ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'message') {
    const message = await prisma.proposalMessage.findFirst({
      where: {
        id: target.id,
        proposal: {
          OR: [
            { applicantId: actorId },
            { trade: { ownerId: actorId } },
            { trade: { providerId: actorId } },
          ],
        },
      },
      select: { id: true },
    });
    return message ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'public_message') {
    const message = await prisma.tradePublicMessage.findFirst({
      where: {
        id: target.id,
        status: 'visible',
        author: { trustTier: { not: 'restricted' } },
        trade: {
          OR: [
            publicTradeVisibilityWhere(),
            { ownerId: actorId },
            { providerId: actorId },
            { proposals: { some: { applicantId: actorId } } },
          ],
        },
      },
      select: { id: true },
    });
    if (message) return { allowed: true };

    const planMessage = await prisma.planPublicMessage.findFirst({
      where: {
        id: target.id,
        status: 'visible',
        author: { trustTier: { not: 'restricted' } },
        plan: {
          OR: [
            { status: { in: [...visiblePlanStatuses] } },
            { participants: { some: { userId: actorId } } },
          ],
        },
      },
      select: { id: true },
    });
    return planMessage ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'plan') {
    if (!env.plansEnabled) return { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
    const plan = await prisma.plan.findFirst({
      where: {
        id: target.id,
        OR: [
          { status: { in: [...visiblePlanStatuses] } },
          { participants: { some: { userId: actorId } } },
        ],
      },
      select: { id: true },
    });
    return plan ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  if (target.type === 'plan_place') {
    if (!env.plansEnabled) return { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
    const place = await prisma.planPlace.findFirst({
      where: {
        id: target.id,
        plan: {
          OR: [
            { status: { in: [...visiblePlanStatuses] } },
            { participants: { some: { userId: actorId } } },
          ],
        },
      },
      select: { id: true },
    });
    return place ? { allowed: true } : { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
  }

  return { allowed: false, status: 404, error: 'target_not_found', message: 'The reported item could not be found.' };
}

export async function hydrateReports<T extends ReportRecord>(reports: T[]) {
  const targets = await Promise.all(reports.map(async (report) => {
    const target = await findReportTarget(report.targetType, report.targetId);
    if (!target || report.targetType !== 'proposal' || !report.targetOwnerId || target.ownerId === report.targetOwnerId) return target;
    const counterparty = await prisma.user.findUnique({ where: { id: report.targetOwnerId }, select: reportUserSelect });
    return { ...target, ownerId: report.targetOwnerId, owner: counterparty ?? target.owner };
  }));
  return reports.map((report, index) => ({ ...report, target: targets[index] ?? null }));
}

function publicReportUserPreview(user: unknown) {
  if (!user || typeof user !== 'object') return null;
  const candidate = user as {
    id?: unknown;
    profile?: {
      displayName?: unknown;
      handle?: unknown;
      avatarUrl?: unknown;
      countryCode?: unknown;
    } | null;
  };
  if (typeof candidate.id !== 'string') return null;
  return {
    id: candidate.id,
    profile: candidate.profile ? {
      displayName: typeof candidate.profile.displayName === 'string' ? candidate.profile.displayName : null,
      handle: typeof candidate.profile.handle === 'string' ? candidate.profile.handle : null,
      avatarUrl: typeof candidate.profile.avatarUrl === 'string' ? candidate.profile.avatarUrl : null,
      countryCode: typeof candidate.profile.countryCode === 'string' ? candidate.profile.countryCode : null,
    } : null,
  };
}

function publicReportTargetSummary(target: ReportTargetSummary | null | undefined) {
  if (!target) return null;
  const status = target.type === 'user' || target.type === 'profile' ? null : target.status ?? null;
  return {
    type: target.type,
    id: target.id,
    label: target.label,
    ownerId: target.ownerId ?? null,
    owner: publicReportUserPreview(target.owner),
    status,
    isPublic: target.isPublic ?? null,
    url: target.url ?? null,
  };
}

function publicReportResponse<T extends ReportRecord & { target?: ReportTargetSummary | null }>(report: T) {
  return {
    id: report.id,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    targetOwnerId: report.targetOwnerId ?? null,
    moderationCaseId: report.moderationCaseId ?? null,
    reason: report.reason,
    details: report.details ?? null,
    status: report.status,
    reviewedAt: report.reviewedAt ?? null,
    resolutionNote: report.resolutionNote ?? null,
    escalatedSupportTicketId: report.escalatedSupportTicketId ?? null,
    escalatedAt: report.escalatedAt ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    target: publicReportTargetSummary(report.target),
  };
}

function publicReportResponses<T extends ReportRecord & { target?: ReportTargetSummary | null }>(reports: T[]) {
  return reports.map((report) => publicReportResponse(report));
}

export async function moderateReportedTarget(targetType: ReportTargetType, targetId: string, action: 'hide_target' | 'restore_target' | 'suspend_target_owner' | 'unsuspend_target_owner', adminId: string, note?: string | null) {
  const target = await findReportTarget(targetType, targetId);
  if (!target) return null;
  const reason = note?.trim() || 'Admin report queue moderation action.';

  if (action === 'suspend_target_owner' || action === 'unsuspend_target_owner') {
    if (!target.ownerId) return null;
    const existingOwner = await prisma.user.findUnique({ where: { id: target.ownerId }, select: { id: true, role: true, trustTier: true, trustTierNote: true, sessionRevokedAt: true } });
    if (!existingOwner || existingOwner.role === 'admin' || existingOwner.id === adminId) return null;
    const now = new Date();
    const restoring = action === 'unsuspend_target_owner';
    const nextTrustTier = restoring ? 'new' : 'restricted';
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: target.ownerId! },
        data: {
          trustTier: nextTrustTier,
          trustTierUpdatedAt: now,
          trustTierNote: reason,
          ...(!restoring ? { sessionRevokedAt: now, sensitiveActionVerifiedAt: null } : {}),
        },
      });
      if (!restoring) await tx.session.updateMany({ where: { userId: target.ownerId!, revokedAt: null }, data: { revokedAt: now } });
      await (tx as any).adminAuditLog?.create({
        data: {
          adminId,
          action: restoring ? 'report.target_owner.unsuspend' : 'report.target_owner.suspend',
          targetType: 'user',
          targetId: target.ownerId,
          reason,
          previousValue: { trustTier: existingOwner.trustTier, trustTierNote: existingOwner.trustTierNote, sessionRevokedAt: existingOwner.sessionRevokedAt, targetType, targetId },
          nextValue: { trustTier: nextTrustTier, trustTierNote: reason, sessionRevokedAt: restoring ? existingOwner.sessionRevokedAt : now },
        },
      });
    });
    return findReportTarget(targetType, targetId);
  }

  if (targetType === 'trade') {
    await prisma.trade.update({
      where: { id: targetId },
      data: action === 'restore_target' ? { isPublic: true, ...(target.status === 'closed' || target.status === 'expired' ? { status: 'active' as const, closedAt: null } : {}) } : { isPublic: false },
    });
  }
  else if (targetType === 'need') await prisma.need.update({ where: { id: targetId }, data: { status: action === 'restore_target' ? 'active' : 'closed' } });
  else if (targetType === 'offer') await prisma.offer.update({ where: { id: targetId }, data: { status: action === 'restore_target' ? 'active' : 'closed' } });
  else if (targetType === 'plan') await prisma.plan.update({ where: { id: targetId }, data: { status: action === 'restore_target' ? 'open' : 'hidden' } });
  else if (targetType === 'plan_place') {
    const place = await prisma.planPlace.findUnique({ where: { id: targetId }, select: { planId: true } });
    if (!place) return null;
    await prisma.plan.update({ where: { id: place.planId }, data: { status: action === 'restore_target' ? 'open' : 'hidden' } });
  }
  else if (targetType === 'public_message') {
    await Promise.all([
      prisma.tradePublicMessage.updateMany({
        where: { id: targetId },
        data: action === 'restore_target'
          ? { status: 'visible', hiddenAt: null, hiddenById: null, moderationNote: null }
          : { status: 'hidden', hiddenAt: new Date(), hiddenById: adminId, moderationNote: reason },
      }),
      prisma.planPublicMessage.updateMany({
        where: { id: targetId },
        data: action === 'restore_target'
          ? { status: 'visible', hiddenAt: null, hiddenById: null, moderationNote: null }
          : { status: 'hidden', hiddenAt: new Date(), hiddenById: adminId, moderationNote: reason },
      }),
    ]);
  }
  else if (targetType === 'media') await prisma.mediaAsset.update({ where: { id: targetId }, data: { status: action === 'restore_target' ? 'active' : 'removed', reviewedAt: new Date(), reviewerId: adminId, reviewNote: reason } });
  else return null;

  const updatedTarget = await findReportTarget(targetType, targetId);
  await (prisma as any).adminAuditLog?.create({
    data: {
      adminId,
      action: action === 'restore_target' ? `report.target.${targetType}.restore` : `report.target.${targetType}.hide`,
      targetType,
      targetId,
      reason,
      previousValue: { status: target.status, isPublic: target.isPublic },
      nextValue: updatedTarget,
    },
  });
  return updatedTarget;
}

reportsRoutes.use(requireAuth);
reportsRoutes.use(requireActiveAccount);

reportsRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createReportRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const target = await findReportTarget(input.targetType, input.targetId);
  if (!target) return res.status(404).json({ error: 'target_not_found', message: 'The reported item could not be found.' });
  const access = await canReportTarget(actorId, target);
  if (!access.allowed) return res.status(access.status).json({ error: access.error, message: access.message });

  const existing = await (prisma as any).report.findFirst({
    where: { reporterId: actorId, targetType: input.targetType, targetId: input.targetId, status: { in: unresolvedReportStatuses } },
    include: { reporter: { select: reportUserSelect }, reviewer: { select: reportUserSelect } },
  });
  if (existing) {
    const moderationCaseId = await ensureReportModerationCase({
      reportId: existing.id,
      reporterId: actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetOwnerId: target.ownerId ?? null,
      moderationCaseId: existing.moderationCaseId ?? null,
      reason: input.reason,
      details: input.details?.trim() || existing.details || null,
    });
    const [report] = await hydrateReports([{ ...existing, moderationCaseId }]);
    return res.json({ report: publicReportResponse(report), duplicate: true });
  }

  const report = await prisma.$transaction(async (tx: any) => {
    const createdReport = await tx.report.create({
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

    const moderationCase = await createModerationCaseForReport(tx, {
      reportId: createdReport.id,
      reporterId: actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetOwnerId: target.ownerId ?? null,
      reason: input.reason,
      details: input.details?.trim() || null,
    });

    return tx.report.update({
      where: { id: createdReport.id },
      data: { moderationCaseId: moderationCase.id },
      include: { reporter: { select: reportUserSelect }, reviewer: { select: reportUserSelect } },
    });
  });

  const [hydrated] = await hydrateReports([report]);
  return res.status(201).json({ report: publicReportResponse(hydrated), duplicate: false });
}));

reportsRoutes.get('/mine', asyncRoute(async (req, res) => {
  const reports = await (prisma as any).report.findMany({
    where: { reporterId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { reporter: { select: reportUserSelect }, reviewer: { select: reportUserSelect } },
  });
  const hydrated = await hydrateReports(reports);
  res.json({ reports: publicReportResponses(hydrated) });
}));
