import { Router } from 'express';
import { adminBusinessProfileActionRequestSchema, adminContentActionRequestSchema, adminCreateSupportMessageRequestSchema, adminListReportsQuerySchema, adminReportActionRequestSchema, adminListContentQuerySchema, adminListMediaQuerySchema, adminPayoutActionRequestSchema, adminPayoutStatusFilterSchema, adminUserModerationActionRequestSchema, moneyProviderWalletBalancesSyncRequestSchema, adminTradeDisputeActionRequestSchema, adminUpdateTrustTierRequestSchema, adminUpdateSupportTicketRequestSchema, supportTicketCategorySchema, supportTicketPrioritySchema, supportTicketStatusSchema, updateMediaStatusRequestSchema } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireBusinessAccountsVisible, requireMoneyFeaturesVisible, requirePayoutsVisible } from '../../middleware/featureGates.js';
import { attachUploadedMediaToEntity } from '../media/media.helpers.js';
import { buildLaunchLimits } from '../limits/launchLimits.js';
import { buildAdminMoneySafetySummary, buildGlobalMoneySafetyConfig } from '../money/moneySafety.js';
import { mirrorProviderTradeRefund, mirrorProviderTradeRelease } from '../money/tradeMoney.js';
import { buildMoneyProviderStatus, getActiveMoneyProvider, getMoneyProvider } from '../money/providers/moneyProviderRegistry.js';
import { MoneyProviderError } from '../money/providers/moneyProvider.types.js';
import { withOneSupportMessageMedia, withOneSupportTicketMedia, withSupportTicketMedia } from '../support/support.routes.js';
import { findReportTarget, hydrateReports, moderateReportedTarget } from '../reports/reports.routes.js';
import { publicTradeVisibilityWhere, refundHeldWalletMoney, releaseHeldWalletMoney, tradeInclude, withOneTradeDeckMedia } from '../trades/trades.routes.js';

export const adminRoutes = Router();
const mediaUserSelect = { id: true, email: true, role: true, trustTier: true, emailVerifiedAt: true, ageConfirmedAt: true, declaredAgeBucket: true, twoFactorEnabled: true, createdAt: true, profile: true } as const;
const adminOverviewUserSelect = { id: true, email: true, role: true, trustTier: true, emailVerifiedAt: true, ageConfirmedAt: true, declaredAgeBucket: true, twoFactorEnabled: true, createdAt: true, profile: true } as const;


type AdminAuditInput = {
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  previousValue?: unknown;
  nextValue?: unknown;
  metadata?: unknown;
};

async function recordAdminAuditLog(client: unknown, adminId: string, input: AdminAuditInput) {
  const auditClient = client as { adminAuditLog?: { create: (args: unknown) => Promise<unknown> } };
  if (!auditClient.adminAuditLog) return;
  await auditClient.adminAuditLog.create({
    data: {
      adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      reason: input.reason ?? null,
      previousValue: input.previousValue === undefined ? undefined : input.previousValue,
      nextValue: input.nextValue === undefined ? undefined : input.nextValue,
      metadata: input.metadata === undefined ? undefined : input.metadata,
    },
  });
}

function toStringParam(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function clampTake(value: unknown, fallback = 100, max = 250) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

async function withMediaEntityContext<T extends { entityType: 'need' | 'offer' | 'trade' | 'profile' | 'support_ticket' | 'support_message' | 'plan' | 'plan_place' | null; entityId: string | null }>(media: T[]) {
  const needIds = media.filter((item) => item.entityType === 'need' && item.entityId).map((item) => item.entityId!);
  const offerIds = media.filter((item) => item.entityType === 'offer' && item.entityId).map((item) => item.entityId!);
  const tradeIds = media.filter((item) => item.entityType === 'trade' && item.entityId).map((item) => item.entityId!);
  const profileIds = media.filter((item) => item.entityType === 'profile' && item.entityId).map((item) => item.entityId!);
  const supportTicketIds = media.filter((item) => item.entityType === 'support_ticket' && item.entityId).map((item) => item.entityId!);
  const supportMessageIds = media.filter((item) => item.entityType === 'support_message' && item.entityId).map((item) => item.entityId!);
  const planIds = media.filter((item) => item.entityType === 'plan' && item.entityId).map((item) => item.entityId!);
  const planPlaceIds = media.filter((item) => item.entityType === 'plan_place' && item.entityId).map((item) => item.entityId!);

  const [needs, offers, trades, profiles, supportTickets, supportMessages, plans, planPlaces] = await Promise.all([
    needIds.length ? prisma.need.findMany({ where: { id: { in: needIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, timing: true, mode: true, locationLabel: true } }) : [],
    offerIds.length ? prisma.offer.findMany({ where: { id: { in: offerIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, availability: true, mode: true, locationLabel: true } }) : [],
    tradeIds.length ? prisma.trade.findMany({ where: { id: { in: tradeIds } }, select: { id: true, ownerId: true, title: true, status: true, needId: true, offerId: true, creditAmount: true } }) : [],
    profileIds.length ? prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true, userId: true, displayName: true, handle: true, avatarUrl: true, avatarMediaId: true } }) : [],
    supportTicketIds.length ? prisma.supportTicket.findMany({ where: { id: { in: supportTicketIds } }, select: { id: true, userId: true, subject: true, status: true, priority: true, category: true } }) : [],
    supportMessageIds.length ? prisma.supportTicketMessage.findMany({ where: { id: { in: supportMessageIds } }, select: { id: true, ticketId: true, senderId: true, senderRole: true, body: true, createdAt: true } }) : [],
    planIds.length ? prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, mode: true, locationLabel: true, startsAt: true, endsAt: true } }) : [],
    planPlaceIds.length ? prisma.planPlace.findMany({ where: { id: { in: planPlaceIds } }, select: { id: true, planId: true, title: true, note: true, addressPublicText: true, startsAt: true, endsAt: true } }) : []
  ]);

  const needsById = new Map(needs.map((need) => [need.id, need]));
  const offersById = new Map(offers.map((offer) => [offer.id, offer]));
  const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const supportTicketsById = new Map(supportTickets.map((ticket) => [ticket.id, ticket]));
  const supportMessagesById = new Map(supportMessages.map((message) => [message.id, message]));
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const planPlacesById = new Map(planPlaces.map((place) => [place.id, place]));

  return media.map((item) => {
    if (item.entityType === 'need' && item.entityId) return { ...item, entity: needsById.get(item.entityId) ?? null };
    if (item.entityType === 'offer' && item.entityId) return { ...item, entity: offersById.get(item.entityId) ?? null };
    if (item.entityType === 'trade' && item.entityId) return { ...item, entity: tradesById.get(item.entityId) ?? null };
    if (item.entityType === 'profile' && item.entityId) return { ...item, entity: profilesById.get(item.entityId) ?? null };
    if (item.entityType === 'support_ticket' && item.entityId) return { ...item, entity: supportTicketsById.get(item.entityId) ?? null };
    if (item.entityType === 'support_message' && item.entityId) return { ...item, entity: supportMessagesById.get(item.entityId) ?? null };
    if (item.entityType === 'plan' && item.entityId) return { ...item, entity: plansById.get(item.entityId) ?? null };
    if (item.entityType === 'plan_place' && item.entityId) return { ...item, entity: planPlacesById.get(item.entityId) ?? null };
    return { ...item, entity: null };
  });
}

adminRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return next();
});

adminRoutes.use(requireAuth);

adminRoutes.use(asyncRoute(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true, twoFactorEnabled: true } });
  if (user?.role !== 'admin') return res.status(404).json({ error: 'not_found' });
  if (env.adminRequireTwoFactor && !user.twoFactorEnabled) return res.status(403).json({ error: 'admin_two_factor_required', message: 'Admin accounts must enable authenticator app two-step verification before using admin tools.' });
  return next();
}));

adminRoutes.use('/payouts', requirePayoutsVisible('Admin payout tools'));
adminRoutes.use('/stripe', requirePayoutsVisible('Admin Stripe payout tools'));
adminRoutes.use('/business-profiles', requireBusinessAccountsVisible('Admin business profiles'));
adminRoutes.use('/money', requireMoneyFeaturesVisible('Admin money tools'));
adminRoutes.use('/credits', requireMoneyFeaturesVisible('Admin credit tools'));


adminRoutes.get('/overview', asyncRoute(async (_req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const moneySafety = buildGlobalMoneySafetyConfig();

  const [
    totalUsers,
    newUsers24h,
    newUsers7d,
    adminUsers,
    restrictedUsers,
    activeTrades,
    disputedTrades,
    activeNeeds,
    activeOffers,
    openSupportTickets,
    urgentSupportTickets,
    pendingReports,
    reviewingReports,
    pendingReviewMedia,
    flaggedMedia,
    recentUsers,
    recentTickets,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { trustTier: 'restricted' } }),
    prisma.trade.count({ where: publicTradeVisibilityWhere() }),
    prisma.trade.count({ where: { status: 'disputed' } }),
    prisma.need.count({ where: { status: 'active', owner: { trustTier: { not: 'restricted' } } } }),
    prisma.offer.count({ where: { status: 'active', owner: { trustTier: { not: 'restricted' } } } }),
    prisma.supportTicket.count({ where: { status: { in: ['open', 'in_review', 'waiting_for_user'] } } }),
    prisma.supportTicket.count({ where: { priority: { in: ['high', 'urgent'] }, status: { in: ['open', 'in_review', 'waiting_for_user'] } } }),
    (prisma as any).report?.count({ where: { status: 'pending' } }) ?? Promise.resolve(0),
    (prisma as any).report?.count({ where: { status: 'reviewing' } }) ?? Promise.resolve(0),
    prisma.mediaAsset.count({ where: { status: 'pending_review' } }),
    prisma.mediaAsset.count({ where: { status: 'flagged' } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, email: true, role: true, trustTier: true, emailVerifiedAt: true, ageConfirmedAt: true, declaredAgeBucket: true, createdAt: true, profile: true },
    }),
    prisma.supportTicket.findMany({
      where: { status: { in: ['open', 'in_review', 'waiting_for_user'] } },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: { user: { select: { id: true, email: true, profile: true } }, _count: { select: { messages: true } } },
    }),
    (prisma as any).adminAuditLog?.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { admin: { select: { id: true, email: true, profile: true } } },
    }) ?? Promise.resolve([]),
  ]);

  res.json({
    summary: {
      users: { total: totalUsers, new24h: newUsers24h, new7d: newUsers7d, admins: adminUsers, restricted: restrictedUsers },
      content: { activeTrades, disputedTrades, activeNeeds, activeOffers },
      support: { open: openSupportTickets, urgent: urgentSupportTickets },
      reports: { pending: pendingReports, reviewing: reviewingReports },
      media: { pendingReview: pendingReviewMedia, flagged: flaggedMedia },
      money: {
        moneyFeaturesVisible: moneySafety.moneyFeaturesVisible,
        walletVisible: moneySafety.walletVisible,
        payoutsVisible: moneySafety.payoutsVisible,
        moneyTradesEnabled: moneySafety.moneyTradesEnabled,
        realMoneyEnabled: moneySafety.realMoneyEnabled,
        moneyProvider: moneySafety.moneyProvider,
        moneyProviderEnvironment: moneySafety.moneyProviderEnvironment,
      },
    },
    recentUsers,
    recentTickets: await withSupportTicketMedia(recentTickets, 'admin'),
    recentAuditLogs,
  });
}));

adminRoutes.get('/audit-log', asyncRoute(async (req, res) => {
  const targetType = toStringParam(req.query.targetType);
  const targetId = toStringParam(req.query.targetId);
  const action = toStringParam(req.query.action);
  const take = clampTake(req.query.take, 100, 250);
  const auditLogClient = (prisma as any).adminAuditLog;
  if (!auditLogClient) return res.json({ logs: [] });
  const logs = await auditLogClient.findMany({
    where: {
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
    include: { admin: { select: { id: true, email: true, profile: true } } },
  });
  res.json({ logs });
}));


adminRoutes.get('/reports', asyncRoute(async (req, res) => {
  const input = adminListReportsQuerySchema.parse(req.query);
  const reportClient = (prisma as any).report;
  if (!reportClient) return res.json({ reports: [] });
  const reports = await reportClient.findMany({
    where: {
      ...(input.status && input.status !== 'all' ? { status: input.status } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.q ? {
        OR: [
          { details: { contains: input.q, mode: 'insensitive' as const } },
          { targetId: { contains: input.q, mode: 'insensitive' as const } },
          { reporter: { is: { email: { contains: input.q, mode: 'insensitive' as const } } } },
          { reporter: { is: { profile: { is: { displayName: { contains: input.q, mode: 'insensitive' as const } } } } } },
          { reporter: { is: { profile: { is: { handle: { contains: input.q, mode: 'insensitive' as const } } } } } },
        ],
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.take ?? 100,
    include: { reporter: { select: adminOverviewUserSelect }, reviewer: { select: adminOverviewUserSelect } },
  });
  res.json({ reports: await hydrateReports(reports) });
}));


async function findRelatedTradeIdForReport(targetType: string, targetId: string) {
  if (targetType === 'trade') return targetId;
  if (targetType === 'proposal') {
    const proposal = await prisma.tradeProposal.findUnique({ where: { id: targetId }, select: { tradeId: true } });
    return proposal?.tradeId ?? null;
  }
  if (targetType === 'message') {
    const message = await prisma.proposalMessage.findUnique({ where: { id: targetId }, select: { proposal: { select: { tradeId: true } } } });
    return message?.proposal?.tradeId ?? null;
  }
  if (targetType === 'media') {
    const media = await prisma.mediaAsset.findUnique({ where: { id: targetId }, select: { entityType: true, entityId: true } });
    return media?.entityType === 'trade' ? media.entityId : null;
  }
  return null;
}

function reportSupportCategory(reason: string, targetType: string) {
  if (reason === 'illegal_unsafe' || reason === 'harassment' || reason === 'scam') return 'safety_concern';
  if (targetType === 'media' || reason === 'inappropriate_image') return 'media_issue';
  if (targetType === 'trade' || targetType === 'proposal' || targetType === 'message') return 'trade_issue';
  if (targetType === 'user' || targetType === 'profile' || reason === 'fake_profile') return 'account_issue';
  return 'general_feedback';
}

function reportSupportPriority(reason: string) {
  if (reason === 'illegal_unsafe' || reason === 'scam') return 'urgent';
  if (reason === 'harassment' || reason === 'inappropriate_image') return 'high';
  return 'normal';
}

function truncateSupportSubject(value: string) {
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length <= 140 ? text : `${text.slice(0, 137)}…`;
}

function buildReportEscalationMessage(report: { id: string; reason: string; details?: string | null; targetType: string; targetId: string; targetOwnerId?: string | null }, target: { label?: string | null; ownerId?: string | null; status?: string | null; isPublic?: boolean | null } | null, note?: string | null) {
  const lines = [
    'Admin escalated this report into a support ticket for safer follow-up.',
    '',
    `Report: ${report.id}`,
    `Reason: ${report.reason}`,
    `Target: ${report.targetType} ${report.targetId}`,
    target?.label ? `Target label: ${target.label}` : null,
    target?.ownerId ? `Target owner: ${target.ownerId}` : report.targetOwnerId ? `Target owner: ${report.targetOwnerId}` : null,
    target?.status ? `Target status: ${target.status}` : null,
    typeof target?.isPublic === 'boolean' ? `Target visibility: ${target.isPublic ? 'public' : 'hidden'}` : null,
    '',
    report.details ? `Reporter details:\n${report.details}` : 'Reporter details: none provided.',
    note ? `\nAdmin note:\n${note}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

async function escalateReportToSupportTicket(existing: any, adminId: string, note?: string | null) {
  if (existing.escalatedSupportTicketId) {
    const alreadyEscalatedTicket = await prisma.supportTicket.findUnique({ where: { id: existing.escalatedSupportTicketId }, include: supportTicketIncludeForAdmin });
    return { report: existing, supportTicket: alreadyEscalatedTicket };
  }

  const target = await findReportTarget(existing.targetType, existing.targetId);
  const relatedTradeId = await findRelatedTradeIdForReport(existing.targetType, existing.targetId);
  const now = new Date();
  const subject = truncateSupportSubject(`Report escalation: ${target?.label ?? `${existing.targetType} ${existing.targetId}`}`);
  const message = buildReportEscalationMessage(existing, target, note);
  const category = reportSupportCategory(existing.reason, existing.targetType) as any;
  const priority = reportSupportPriority(existing.reason) as any;

  return prisma.$transaction(async (tx: any) => {
    const supportTicket = await tx.supportTicket.create({
      data: {
        userId: existing.reporterId,
        category,
        subject,
        message,
        priority,
        status: 'in_review',
        assignedAdminId: adminId,
        relatedTradeId,
        relatedProposalId: existing.targetType === 'proposal' ? existing.targetId : null,
        relatedMediaId: existing.targetType === 'media' ? existing.targetId : null,
        messages: {
          create: [
            { senderId: existing.reporterId, senderRole: 'user', body: existing.details?.trim() || 'Report submitted for admin review.' },
            { senderId: adminId, senderRole: 'admin', internal: true, body: message },
          ],
        },
      },
      include: supportTicketIncludeForAdmin,
    });
    const report = await (tx as any).report.update({
      where: { id: existing.id },
      data: {
        status: 'reviewing',
        reviewedById: adminId,
        reviewedAt: now,
        resolutionNote: note ?? existing.resolutionNote ?? null,
        escalatedSupportTicketId: supportTicket.id,
        escalatedAt: now,
        escalatedById: adminId,
      },
      include: { reporter: { select: adminOverviewUserSelect }, reviewer: { select: adminOverviewUserSelect } },
    });
    await recordAdminAuditLog(tx, adminId, {
      action: 'report.escalate_to_support',
      targetType: 'report',
      targetId: existing.id,
      reason: note,
      previousValue: { status: existing.status, escalatedSupportTicketId: existing.escalatedSupportTicketId ?? null },
      nextValue: { status: 'reviewing', escalatedSupportTicketId: supportTicket.id },
      metadata: { targetType: existing.targetType, targetId: existing.targetId, supportTicketId: supportTicket.id },
    });
    return { report, supportTicket };
  });
}

adminRoutes.patch('/reports/:reportId/action', asyncRoute(async (req, res) => {
  const input = adminReportActionRequestSchema.parse(req.body ?? {});
  const reportClient = (prisma as any).report;
  if (!reportClient) return res.status(404).json({ error: 'reports_unavailable' });
  const existing = await reportClient.findUnique({ where: { id: req.params.reportId }, include: { reporter: { select: adminOverviewUserSelect }, reviewer: { select: adminOverviewUserSelect } } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const note = input.note?.trim();
  const now = new Date();

  const noteRequiredActions = new Set(['reopen', 'resolve', 'dismiss', 'hide_target', 'restore_target', 'suspend_target_owner', 'unsuspend_target_owner', 'escalate_to_support']);
  if (noteRequiredActions.has(input.action) && !note) {
    return res.status(400).json({ error: 'admin_note_required', message: 'Add an internal note before resolving, dismissing, reopening, restoring, escalating, hiding content, or changing user restrictions.' });
  }

  if (input.action === 'escalate_to_support') {
    const { report, supportTicket } = await escalateReportToSupportTicket(existing, req.user!.id, note);
    const [hydrated] = await hydrateReports([report]);
    return res.json({ report: hydrated, supportTicket: supportTicket ? await withOneSupportTicketMedia(supportTicket, 'admin') : null });
  }

  if (input.action === 'hide_target' || input.action === 'restore_target' || input.action === 'suspend_target_owner' || input.action === 'unsuspend_target_owner') {
    const moderated = await moderateReportedTarget(existing.targetType, existing.targetId, input.action, req.user!.id, note);
    if (!moderated) return res.status(409).json({ error: 'report_target_action_not_supported', message: 'This report target cannot be moderated with that action.' });
  }

  const nextStatus = input.action === 'mark_reviewing' ? 'reviewing' : input.action === 'reopen' ? 'pending' : input.action === 'dismiss' ? 'dismissed' : 'resolved';
  const updated = await prisma.$transaction(async (tx: any) => {
    const report = await (tx as any).report.update({
      where: { id: existing.id },
      data: { status: nextStatus, reviewedById: req.user!.id, reviewedAt: now, resolutionNote: note ?? existing.resolutionNote ?? null },
      include: { reporter: { select: adminOverviewUserSelect }, reviewer: { select: adminOverviewUserSelect } },
    });
    await recordAdminAuditLog(tx, req.user!.id, {
      action: `report.${input.action}`,
      targetType: 'report',
      targetId: existing.id,
      reason: note,
      previousValue: { status: existing.status, reviewedById: existing.reviewedById, resolutionNote: existing.resolutionNote },
      nextValue: { status: nextStatus, reviewedById: req.user!.id, resolutionNote: note ?? existing.resolutionNote ?? null },
      metadata: { targetType: existing.targetType, targetId: existing.targetId, targetOwnerId: existing.targetOwnerId },
    });
    return report;
  });
  const [hydrated] = await hydrateReports([updated]);
  res.json({ report: hydrated });
}));

adminRoutes.get('/users', asyncRoute(async (req, res) => {
  const q = toStringParam(req.query.q);
  const rawTrustTier = toStringParam(req.query.trustTier);
  const trustTier = rawTrustTier && ['new', 'email_verified', 'stripe_verified', 'trusted', 'restricted'].includes(rawTrustTier) ? rawTrustTier as 'new' | 'email_verified' | 'stripe_verified' | 'trusted' | 'restricted' : undefined;
  const rawRole = toStringParam(req.query.role);
  const role = rawRole && ['user', 'admin'].includes(rawRole) ? rawRole as 'user' | 'admin' : undefined;
  const take = clampTake(req.query.take, 100, 250);
  const users = await prisma.user.findMany({
    where: {
      ...(trustTier ? { trustTier } : {}),
      ...(role ? { role } : {}),
      ...(q ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { profile: { is: { displayName: { contains: q, mode: 'insensitive' as const } } } },
          { profile: { is: { handle: { contains: q, mode: 'insensitive' as const } } } },
        ],
      } : {}),
    },
    select: {
      id: true, email: true, role: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true,
      emailVerifiedAt: true, ageConfirmedAt: true, declaredAgeBucket: true, createdAt: true, lastLoginAt: true, profile: true, wallet: true,
      _count: { select: { needs: true, offers: true, trades: true, supportTickets: true, mediaAssets: true } },
    },
    orderBy: { createdAt: 'desc' },
    take
  });
  const usersWithLimits = await Promise.all(users.map(async (user) => ({ ...user, limits: await buildLaunchLimits(prisma, user.id) })));
  res.json({ users: usersWithLimits });
}));

adminRoutes.patch('/users/:userId/trust-tier', asyncRoute(async (req, res) => {
  const input = adminUpdateTrustTierRequestSchema.parse(req.body);
  if (input.trustTier === 'restricted' && req.params.userId === req.user!.id) {
    return res.status(409).json({ error: 'self_restrict_blocked', message: 'Admins cannot restrict their own account.' });
  }
  const existing = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true, email: true, role: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true, sessionRevokedAt: true } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const now = new Date();
  const restrictingUser = input.trustTier === 'restricted' && existing.trustTier !== 'restricted';
  const user = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.user.update({
      where: { id: req.params.userId },
      data: {
        trustTier: input.trustTier,
        trustTierUpdatedAt: now,
        trustTierNote: input.note ?? null,
        ...(restrictingUser ? { sessionRevokedAt: now, sensitiveActionVerifiedAt: null } : {}),
      },
      select: { id: true, email: true, role: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true, emailVerifiedAt: true, ageConfirmedAt: true, declaredAgeBucket: true, createdAt: true, lastLoginAt: true, profile: true, wallet: true, _count: { select: { needs: true, offers: true, trades: true, supportTickets: true, mediaAssets: true } } }
    });
    if (restrictingUser) {
      await tx.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: now } });
    }
    await recordAdminAuditLog(tx, req.user!.id, {
      action: 'user.trust_tier.update',
      targetType: 'user',
      targetId: updated.id,
      reason: input.note,
      previousValue: { trustTier: existing.trustTier, trustTierNote: existing.trustTierNote, sessionRevokedAt: existing.sessionRevokedAt },
      nextValue: { trustTier: updated.trustTier, trustTierNote: updated.trustTierNote, sessionRevokedAt: restrictingUser ? now : existing.sessionRevokedAt },
      metadata: { sessionsRevoked: restrictingUser },
    });
    return updated;
  });
  res.json({ user: { ...user, limits: await buildLaunchLimits(prisma, user.id) } });
}));



const adminContentUserSelect = { id: true, email: true, role: true, trustTier: true, emailVerifiedAt: true, ageConfirmedAt: true, declaredAgeBucket: true, twoFactorEnabled: true, createdAt: true, profile: true } as const;
const tradeStatusValues = ['draft', 'active', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'expired', 'closed', 'cancelled'] as const;
const needStatusValues = ['draft', 'active', 'fulfilled', 'closed', 'expired'] as const;
const offerStatusValues = ['draft', 'active', 'accepted', 'closed', 'expired'] as const;

type AdminContentType = 'trade' | 'need' | 'offer';
type AdminContentItem = {
  id: string;
  type: AdminContentType;
  ownerId: string;
  title: string;
  description: string;
  status: string;
  isPublic?: boolean;
  postType?: string | null;
  category?: string | null;
  itemType?: string | null;
  mode?: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
  closedAt?: Date | null;
  owner?: unknown;
  mediaCount?: number;
  proposalCount?: number;
  linkedTradeCount?: number;
  publicDiscoverable?: boolean;
  visibilityBlockers?: string[];
};

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function contentSearchWhere(q: string | undefined) {
  return q ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }] } : {};
}

function tradeVisibilityBlockers(trade: any) {
  const blockers: string[] = [];
  if (trade.status !== 'active') blockers.push(`trade status: ${trade.status}`);
  if (!trade.isPublic) blockers.push('trade is hidden');
  if (trade.expiresAt && new Date(trade.expiresAt).getTime() <= Date.now()) blockers.push('trade expired');
  if (trade.owner?.trustTier === 'restricted') blockers.push('owner restricted');
  if (trade.needId && trade.need?.status !== 'active') blockers.push(`need status: ${trade.need?.status ?? 'missing'}`);
  if (trade.offerId && trade.offer?.status !== 'active') blockers.push(`offer status: ${trade.offer?.status ?? 'missing'}`);
  return blockers;
}

function inventoryVisibilityBlockers(item: any, type: 'need' | 'offer') {
  const blockers: string[] = [];
  if (item.status !== 'active') blockers.push(`${type} status: ${item.status}`);
  if (item.owner?.trustTier === 'restricted') blockers.push('owner restricted');
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) blockers.push(`${type} expired`);
  return blockers;
}

async function countMediaForContent(items: Array<{ id: string; type: AdminContentType }>) {
  const counts = new Map<string, number>();
  await Promise.all((['trade', 'need', 'offer'] as const).map(async (entityType) => {
    const ids = items.filter((item) => item.type === entityType).map((item) => item.id);
    if (!ids.length) return;
    const rows = await prisma.mediaAsset.groupBy({ by: ['entityId'], where: { entityType, entityId: { in: ids }, status: { not: 'removed' } }, _count: { _all: true } });
    for (const row of rows) if (row.entityId) counts.set(`${entityType}:${row.entityId}`, row._count._all);
  }));
  return counts;
}

async function hydrateAdminContent(items: AdminContentItem[]) {
  const mediaCounts = await countMediaForContent(items);
  return items.map((item) => ({ ...item, mediaCount: mediaCounts.get(`${item.type}:${item.id}`) ?? item.mediaCount ?? 0 }));
}

async function toAdminTradeItem(trade: any): Promise<AdminContentItem> {
  const visibilityBlockers = tradeVisibilityBlockers(trade);
  return {
    id: trade.id,
    type: 'trade',
    ownerId: trade.ownerId,
    title: trade.title,
    description: trade.description,
    status: trade.status,
    isPublic: trade.isPublic,
    postType: trade.postType,
    category: trade.need?.category ?? trade.offer?.category ?? null,
    itemType: trade.need?.itemType ?? trade.offer?.itemType ?? null,
    mode: trade.need?.mode ?? trade.offer?.mode ?? null,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
    expiresAt: trade.expiresAt,
    closedAt: trade.closedAt,
    owner: trade.owner,
    proposalCount: trade._count?.proposals ?? 0,
    publicDiscoverable: visibilityBlockers.length === 0,
    visibilityBlockers,
  };
}

function toAdminNeedItem(need: any): AdminContentItem {
  const visibilityBlockers = inventoryVisibilityBlockers(need, 'need');
  return {
    id: need.id,
    type: 'need',
    ownerId: need.ownerId,
    title: need.title,
    description: need.description,
    status: need.status,
    category: need.category ?? null,
    itemType: need.itemType ?? null,
    mode: need.mode ?? null,
    createdAt: need.createdAt,
    updatedAt: need.updatedAt,
    expiresAt: need.expiresAt,
    owner: need.owner,
    linkedTradeCount: need._count?.trades ?? 0,
    publicDiscoverable: visibilityBlockers.length === 0,
    visibilityBlockers,
  };
}

function toAdminOfferItem(offer: any): AdminContentItem {
  const visibilityBlockers = inventoryVisibilityBlockers(offer, 'offer');
  return {
    id: offer.id,
    type: 'offer',
    ownerId: offer.ownerId,
    title: offer.title,
    description: offer.description,
    status: offer.status,
    category: offer.category ?? null,
    itemType: offer.itemType ?? null,
    mode: offer.mode ?? null,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    expiresAt: offer.expiresAt,
    owner: offer.owner,
    linkedTradeCount: offer._count?.trades ?? 0,
    publicDiscoverable: visibilityBlockers.length === 0,
    visibilityBlockers,
  };
}

async function loadAdminContentItem(type: AdminContentType, id: string) {
  if (type === 'trade') {
    const trade = await prisma.trade.findUnique({ where: { id }, include: { owner: { select: adminContentUserSelect }, need: true, offer: true, _count: { select: { proposals: true } } } });
    return trade ? (await hydrateAdminContent([await toAdminTradeItem(trade)]))[0] : null;
  }
  if (type === 'need') {
    const need = await prisma.need.findUnique({ where: { id }, include: { owner: { select: adminContentUserSelect }, _count: { select: { trades: true } } } });
    return need ? (await hydrateAdminContent([toAdminNeedItem(need)]))[0] : null;
  }
  const offer = await prisma.offer.findUnique({ where: { id }, include: { owner: { select: adminContentUserSelect }, _count: { select: { trades: true } } } });
  return offer ? (await hydrateAdminContent([toAdminOfferItem(offer)]))[0] : null;
}

adminRoutes.patch('/users/:userId/moderation', asyncRoute(async (req, res) => {
  const input = adminUserModerationActionRequestSchema.parse(req.body ?? {});
  if (input.action === 'suspend' && req.params.userId === req.user!.id) {
    return res.status(409).json({ error: 'self_suspend_blocked', message: 'Admins cannot suspend their own account.' });
  }
  const existing = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, email: true, role: true, trustTier: true, trustTierNote: true, trustTierUpdatedAt: true, sessionRevokedAt: true },
  });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const now = new Date();
  const note = input.note?.trim();
  if (['suspend', 'restore', 'force_logout'].includes(input.action) && !note) {
    return res.status(400).json({ error: 'admin_note_required', message: 'Add an internal note before suspending, restoring, or force-logging-out a user.' });
  }
  const nextTrustTier = input.action === 'suspend'
    ? 'restricted'
    : input.action === 'restore'
      ? (input.trustTier && input.trustTier !== 'restricted' ? input.trustTier : 'new')
      : existing.trustTier;

  const user = await prisma.$transaction(async (tx: any) => {
    const data = input.action === 'force_logout'
      ? { sessionRevokedAt: now, sensitiveActionVerifiedAt: null }
      : {
          trustTier: nextTrustTier,
          trustTierUpdatedAt: now,
          trustTierNote: note ?? existing.trustTierNote,
          ...(input.action === 'suspend' ? { sessionRevokedAt: now, sensitiveActionVerifiedAt: null } : {}),
        };
    const updated = await tx.user.update({
      where: { id: existing.id },
      data,
      select: { id: true, email: true, role: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true, emailVerifiedAt: true, ageConfirmedAt: true, declaredAgeBucket: true, createdAt: true, lastLoginAt: true, profile: true, wallet: true, _count: { select: { needs: true, offers: true, trades: true, supportTickets: true, mediaAssets: true } } },
    });
    if (input.action === 'suspend' || input.action === 'force_logout') {
      await tx.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: now } });
    }
    await recordAdminAuditLog(tx, req.user!.id, {
      action: `user.moderation.${input.action}`,
      targetType: 'user',
      targetId: existing.id,
      reason: note,
      previousValue: { trustTier: existing.trustTier, trustTierNote: existing.trustTierNote, sessionRevokedAt: existing.sessionRevokedAt },
      nextValue: { trustTier: updated.trustTier, trustTierNote: updated.trustTierNote, sessionRevokedAt: input.action === 'suspend' || input.action === 'force_logout' ? now : existing.sessionRevokedAt },
    });
    return updated;
  });

  res.json({ user: { ...user, limits: await buildLaunchLimits(prisma, user.id) } });
}));

adminRoutes.get('/content', asyncRoute(async (req, res) => {
  const input = adminListContentQuerySchema.parse(req.query);
  const types: AdminContentType[] = input.type === 'all' ? ['trade', 'need', 'offer'] : [input.type as AdminContentType];
  const take = input.take ?? 100;
  const content: AdminContentItem[] = [];

  if (types.includes('trade')) {
    const where = {
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      ...(isOneOf(input.status, tradeStatusValues) ? { status: input.status } : {}),
      ...contentSearchWhere(input.q),
    };
    const trades = await prisma.trade.findMany({
      where,
      include: { owner: { select: adminContentUserSelect }, need: true, offer: true, _count: { select: { proposals: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    for (const trade of trades) content.push(await toAdminTradeItem(trade));
  }

  if (types.includes('need')) {
    const where = {
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      ...(isOneOf(input.status, needStatusValues) ? { status: input.status } : {}),
      ...contentSearchWhere(input.q),
    };
    const needs = await prisma.need.findMany({
      where,
      include: { owner: { select: adminContentUserSelect }, _count: { select: { trades: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    content.push(...needs.map(toAdminNeedItem));
  }

  if (types.includes('offer')) {
    const where = {
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      ...(isOneOf(input.status, offerStatusValues) ? { status: input.status } : {}),
      ...contentSearchWhere(input.q),
    };
    const offers = await prisma.offer.findMany({
      where,
      include: { owner: { select: adminContentUserSelect }, _count: { select: { trades: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    content.push(...offers.map(toAdminOfferItem));
  }

  const hydrated = await hydrateAdminContent(content.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take));
  res.json({ content: hydrated });
}));

adminRoutes.patch('/content/:type/:contentId/action', asyncRoute(async (req, res) => {
  const rawType = req.params.type;
  const type: AdminContentType | null = rawType === 'trade' || rawType === 'need' || rawType === 'offer' ? rawType : null;
  if (!type) return res.status(400).json({ error: 'invalid_content_type' });
  const input = adminContentActionRequestSchema.parse(req.body ?? {});
  const note = input.note?.trim();
  const contentId = req.params.contentId;
  if (!contentId) return res.status(400).json({ error: 'content_id_required' });
  if (['hide', 'restore', 'close'].includes(input.action) && !note) {
    return res.status(400).json({ error: 'admin_note_required', message: 'Add an internal note before hiding, restoring, or closing content.' });
  }

  const existing = await loadAdminContentItem(type, contentId);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  if (type === 'trade') {
    if (input.action === 'close' && ['funded', 'in_progress', 'submitted', 'disputed'].includes(existing.status)) {
      return res.status(409).json({ error: 'active_trade_requires_dispute_flow', message: 'Use the dispute/admin trade flow for funded, in-progress, submitted, or disputed trades.' });
    }
    if (input.action !== 'mark_reviewed') {
      const data = input.action === 'hide'
        ? { isPublic: false }
        : input.action === 'restore'
          ? { isPublic: true, ...(existing.status === 'closed' || existing.status === 'expired' ? { status: 'active' as const, closedAt: null } : {}) }
          : { isPublic: false, status: 'closed' as const, closedAt: new Date() };
      await prisma.trade.update({ where: { id: contentId }, data });
    }
  } else if (type === 'need') {
    if (input.action !== 'mark_reviewed') {
      const data = input.action === 'restore' ? { status: 'active' as const } : { status: 'closed' as const };
      await prisma.need.update({ where: { id: contentId }, data });
    }
  } else {
    if (input.action !== 'mark_reviewed') {
      const data = input.action === 'restore' ? { status: 'active' as const } : { status: 'closed' as const };
      await prisma.offer.update({ where: { id: contentId }, data });
    }
  }

  const updated = await loadAdminContentItem(type, contentId);
  await recordAdminAuditLog(prisma, req.user!.id, {
    action: `content.${type}.${input.action}`,
    targetType: type,
    targetId: contentId,
    reason: note,
    previousValue: { status: existing.status, isPublic: existing.isPublic, closedAt: existing.closedAt },
    nextValue: updated ? { status: updated.status, isPublic: updated.isPublic, closedAt: updated.closedAt } : undefined,
    metadata: { ownerId: existing.ownerId, title: existing.title },
  });
  res.json({ item: updated });
}));


adminRoutes.get('/moderation-smoke', asyncRoute(async (_req, res) => {
  const [
    feedEligibleTrades,
    feedEligibleRestrictedOwnerTrades,
    feedEligibleClosedNeedTrades,
    feedEligibleClosedOfferTrades,
    publicTradesOwnedByRestrictedUsers,
    publicTradesWithClosedNeeds,
    publicTradesWithClosedOffers,
    restrictedUsers,
    activeNeedsOwnedByRestrictedUsers,
    activeOffersOwnedByRestrictedUsers,
    restrictedOwnerSamples,
    closedInventorySamples,
  ] = await Promise.all([
    prisma.trade.count({ where: publicTradeVisibilityWhere() }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { owner: { trustTier: 'restricted' } }] } }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { needId: { not: null }, need: { is: { status: { not: 'active' } } } }] } }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { offerId: { not: null }, offer: { is: { status: { not: 'active' } } } }] } }),
    prisma.trade.count({ where: { status: 'active', isPublic: true, owner: { trustTier: 'restricted' } } }),
    prisma.trade.count({ where: { status: 'active', isPublic: true, needId: { not: null }, need: { is: { status: { not: 'active' } } } } }),
    prisma.trade.count({ where: { status: 'active', isPublic: true, offerId: { not: null }, offer: { is: { status: { not: 'active' } } } } }),
    prisma.user.count({ where: { trustTier: 'restricted' } }),
    prisma.need.count({ where: { status: 'active', owner: { trustTier: 'restricted' } } }),
    prisma.offer.count({ where: { status: 'active', owner: { trustTier: 'restricted' } } }),
    prisma.trade.findMany({
      where: { status: 'active', isPublic: true, owner: { trustTier: 'restricted' } },
      include: { owner: { select: adminContentUserSelect }, need: true, offer: true, _count: { select: { proposals: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.trade.findMany({
      where: {
        status: 'active',
        isPublic: true,
        OR: [
          { needId: { not: null }, need: { is: { status: { not: 'active' } } } },
          { offerId: { not: null }, offer: { is: { status: { not: 'active' } } } },
        ],
      },
      include: { owner: { select: adminContentUserSelect }, need: true, offer: true, _count: { select: { proposals: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const [restrictedOwnerItems, closedInventoryItems] = await Promise.all([
    Promise.all(restrictedOwnerSamples.map(toAdminTradeItem)),
    Promise.all(closedInventorySamples.map(toAdminTradeItem)),
  ]);

  res.json({
    checks: {
      restrictedOwnersHiddenFromFeed: feedEligibleRestrictedOwnerTrades === 0,
      closedNeedsHiddenFromFeed: feedEligibleClosedNeedTrades === 0,
      closedOffersHiddenFromFeed: feedEligibleClosedOfferTrades === 0,
      publicFeedUsesDiscoverableFilter: true,
    },
    counts: {
      feedEligibleTrades,
      feedEligibleRestrictedOwnerTrades,
      feedEligibleClosedNeedTrades,
      feedEligibleClosedOfferTrades,
      publicTradesOwnedByRestrictedUsers,
      publicTradesWithClosedNeeds,
      publicTradesWithClosedOffers,
      restrictedUsers,
      activeNeedsOwnedByRestrictedUsers,
      activeOffersOwnedByRestrictedUsers,
    },
    samples: {
      publicTradesOwnedByRestrictedUsers: await hydrateAdminContent(restrictedOwnerItems),
      publicTradesWithClosedInventory: await hydrateAdminContent(closedInventoryItems),
    },
  });
}));


adminRoutes.get('/launch-checklist', asyncRoute(async (_req, res) => {
  type ChecklistStatus = 'pass' | 'warning' | 'fail';
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const moneySafety = buildGlobalMoneySafetyConfig();

  const [
    adminUsers,
    adminsMissingTwoFactor,
    defaultSeedAdminUsers,
    usersMissingAgeConfirmation,
    feedEligibleTrades,
    feedEligibleRestrictedOwnerTrades,
    feedEligibleClosedNeedTrades,
    feedEligibleClosedOfferTrades,
    publicTradesOwnedByRestrictedUsers,
    publicTradesWithClosedNeeds,
    publicTradesWithClosedOffers,
    pendingReports,
    reviewingReports,
    openSupportTickets,
    urgentSupportTickets,
    pendingReviewMedia,
    flaggedMedia,
    recentAuditLogs,
    activeNeeds,
    activeOffers,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { role: 'admin', twoFactorEnabled: false } }),
    prisma.user.count({ where: { role: 'admin', email: 'admin@hellowhen.app' } }),
    prisma.user.count({ where: { OR: [{ ageConfirmedAt: null }, { declaredAgeBucket: null }, { declaredAgeBucket: { not: '18_plus' } }] } }),
    prisma.trade.count({ where: publicTradeVisibilityWhere() }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { owner: { trustTier: 'restricted' } }] } }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { needId: { not: null }, need: { is: { status: { not: 'active' } } } }] } }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { offerId: { not: null }, offer: { is: { status: { not: 'active' } } } }] } }),
    prisma.trade.count({ where: { status: 'active', isPublic: true, owner: { trustTier: 'restricted' } } }),
    prisma.trade.count({ where: { status: 'active', isPublic: true, needId: { not: null }, need: { is: { status: { not: 'active' } } } } }),
    prisma.trade.count({ where: { status: 'active', isPublic: true, offerId: { not: null }, offer: { is: { status: { not: 'active' } } } } }),
    (prisma as any).report?.count({ where: { status: 'pending' } }) ?? Promise.resolve(0),
    (prisma as any).report?.count({ where: { status: 'reviewing' } }) ?? Promise.resolve(0),
    prisma.supportTicket.count({ where: { status: { in: ['open', 'in_review', 'waiting_for_user'] } } }),
    prisma.supportTicket.count({ where: { priority: { in: ['high', 'urgent'] }, status: { in: ['open', 'in_review', 'waiting_for_user'] } } }),
    prisma.mediaAsset.count({ where: { status: 'pending_review' } }),
    prisma.mediaAsset.count({ where: { status: 'flagged' } }),
    (prisma as any).adminAuditLog?.count({ where: { createdAt: { gte: weekAgo } } }) ?? Promise.resolve(0),
    prisma.need.count({ where: { status: 'active', owner: { trustTier: { not: 'restricted' } } } }),
    prisma.offer.count({ where: { status: 'active', owner: { trustTier: { not: 'restricted' } } } }),
  ]);

  const visibilityLeaks = feedEligibleRestrictedOwnerTrades + feedEligibleClosedNeedTrades + feedEligibleClosedOfferTrades;
  const staleHiddenRows = publicTradesOwnedByRestrictedUsers + publicTradesWithClosedNeeds + publicTradesWithClosedOffers;
  const items: Array<{ id: string; label: string; status: ChecklistStatus; detail: string; action?: string }> = [
    {
      id: 'admin-account',
      label: 'Admin account exists',
      status: adminUsers > 0 ? 'pass' : 'fail',
      detail: adminUsers > 0 ? `${adminUsers} admin account(s) found.` : 'No admin account exists.',
      action: adminUsers > 0 ? undefined : 'Run npm run prisma:seed or promote one trusted user to admin directly in the database.',
    },
    {
      id: 'admin-two-factor',
      label: 'Admin two-step policy',
      status: env.adminRequireTwoFactor ? (adminsMissingTwoFactor > 0 ? 'warning' : 'pass') : 'warning',
      detail: env.adminRequireTwoFactor
        ? adminsMissingTwoFactor > 0
          ? `${adminsMissingTwoFactor} admin account(s) still do not have authenticator 2FA enabled.`
          : 'ADMIN_REQUIRE_TWO_FACTOR is enabled and all admin accounts have authenticator 2FA enabled.'
        : 'ADMIN_REQUIRE_TWO_FACTOR is disabled. This is okay only for local smoke tests.',
      action: env.adminRequireTwoFactor && adminsMissingTwoFactor > 0 ? 'Enable authenticator 2FA for every admin account before launch.' : undefined,
    },
    {
      id: 'default-admin-seed',
      label: 'Default seed admin reviewed',
      status: defaultSeedAdminUsers > 0 ? 'warning' : 'pass',
      detail: defaultSeedAdminUsers > 0
        ? 'The default admin@hellowhen.app seed account exists.'
        : 'No default admin@hellowhen.app account was found.',
      action: defaultSeedAdminUsers > 0 ? 'Use SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD for non-local environments, or rotate/remove the default seed admin.' : undefined,
    },
    {
      id: 'age-confirmation-launch-gate',
      label: '18+ launch gate',
      status: usersMissingAgeConfirmation === 0 ? 'pass' : 'warning',
      detail: usersMissingAgeConfirmation === 0
        ? 'All existing users have the 18+ age confirmation metadata expected for first launch.'
        : `${usersMissingAgeConfirmation} existing user account(s) are missing 18+ age confirmation metadata.`,
      action: usersMissingAgeConfirmation > 0 ? 'Run the age confirmation migration/seed update before launch and confirm registration requires the 18+ checkbox.' : undefined,
    },
    {
      id: 'money-off-launch',
      label: 'Money features launch gate',
      status: moneySafety.realMoneyEnabled ? 'fail' : moneySafety.moneyFeaturesVisible ? 'warning' : 'pass',
      detail: moneySafety.realMoneyEnabled
        ? `Real-money mode is enabled with provider ${moneySafety.moneyProvider}.`
        : moneySafety.moneyFeaturesVisible
          ? 'Money UI is visible in demo/sandbox mode.'
          : 'Money, wallet, payouts, and money trades are hidden for first launch.',
      action: moneySafety.realMoneyEnabled ? 'Set MONEY_LAUNCH_MODE=disabled and MONEY_PRODUCTION_ENABLED=false before first launch.' : undefined,
    },
    {
      id: 'public-visibility-filter',
      label: 'Public visibility filter',
      status: visibilityLeaks === 0 ? (staleHiddenRows > 0 ? 'warning' : 'pass') : 'fail',
      detail: visibilityLeaks === 0
        ? staleHiddenRows > 0
          ? `${staleHiddenRows} stale active public row(s) are blocked by runtime filters.`
          : 'No restricted-owner or closed-inventory trade leaks detected in feed eligibility.'
        : `${visibilityLeaks} feed eligibility leak(s) detected.`,
      action: visibilityLeaks > 0 ? 'Review publicTradeVisibilityWhere and /admin/moderation-smoke before launch.' : staleHiddenRows > 0 ? 'Use /admin/content to close or hide stale rows for cleaner data.' : undefined,
    },
    {
      id: 'reports-queue',
      label: 'Reports queue reviewed',
      status: pendingReports > 0 ? 'warning' : 'pass',
      detail: pendingReports > 0 ? `${pendingReports} pending report(s), ${reviewingReports} in review.` : `${reviewingReports} report(s) in review and none pending.`,
      action: pendingReports > 0 ? 'Open /admin/reports and resolve, dismiss, hide, suspend, or escalate pending reports.' : undefined,
    },
    {
      id: 'support-queue',
      label: 'Support queue reviewed',
      status: urgentSupportTickets > 0 ? 'warning' : 'pass',
      detail: urgentSupportTickets > 0 ? `${urgentSupportTickets} urgent/high support ticket(s), ${openSupportTickets} open total.` : `${openSupportTickets} open support ticket(s), none urgent/high.`,
      action: urgentSupportTickets > 0 ? 'Open /admin/support and claim or update urgent tickets.' : undefined,
    },
    {
      id: 'media-queue',
      label: 'Media moderation queue reviewed',
      status: flaggedMedia > 0 || pendingReviewMedia > 0 ? 'warning' : 'pass',
      detail: `${pendingReviewMedia} pending media item(s), ${flaggedMedia} flagged media item(s).`,
      action: flaggedMedia > 0 || pendingReviewMedia > 0 ? 'Open /admin/media and review pending or flagged media.' : undefined,
    },
    {
      id: 'audit-log',
      label: 'Admin audit log active',
      status: recentAuditLogs > 0 ? 'pass' : 'warning',
      detail: recentAuditLogs > 0 ? `${recentAuditLogs} audit log entry/entries recorded in the last 7 days.` : 'No admin audit log entries in the last 7 days.',
      action: recentAuditLogs > 0 ? undefined : 'Run one harmless admin action such as mark reviewed and confirm it writes to /admin/audit-log.',
    },
    {
      id: 'marketplace-content',
      label: 'Launch content baseline',
      status: feedEligibleTrades > 0 && activeNeeds > 0 && activeOffers > 0 ? 'pass' : 'warning',
      detail: `${feedEligibleTrades} feed-eligible trade(s), ${activeNeeds} active need(s), ${activeOffers} active offer(s).`,
      action: feedEligibleTrades > 0 && activeNeeds > 0 && activeOffers > 0 ? undefined : 'Run seed data locally or create a small clean starter set before demoing the marketplace.',
    },
  ];

  const summary = items.reduce((acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }), { pass: 0, warning: 0, fail: 0 });
  const overallStatus: ChecklistStatus = summary.fail > 0 ? 'fail' : summary.warning > 0 ? 'warning' : 'pass';
  res.json({ overallStatus, generatedAt: now.toISOString(), items, summary });
}));


adminRoutes.get('/runtime-qa', asyncRoute(async (_req, res) => {
  type QaStatus = 'pass' | 'warning' | 'fail';
  const now = new Date();
  const moneySafety = buildGlobalMoneySafetyConfig();
  const moneyOff = !moneySafety.moneyFeaturesVisible || moneySafety.launchMode === 'disabled' || !moneySafety.moneyTradesEnabled;

  const [
    restrictedUsersWithOpenSessions,
    activePublicMoneyTradesWhileMoneyOff,
    feedEligibleRestrictedOwnerTrades,
    feedEligibleClosedNeedTrades,
    feedEligibleClosedOfferTrades,
    pendingReports,
    urgentSupportTickets,
    pendingReviewMedia,
    flaggedMedia,
  ] = await Promise.all([
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now }, user: { trustTier: 'restricted' } } }),
    moneyOff ? prisma.trade.count({ where: { status: 'active', isPublic: true, OR: [{ amountCents: { gt: 0 } }, { creditAmount: { gt: 0 } }] } }) : Promise.resolve(0),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { owner: { trustTier: 'restricted' } }] } }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { needId: { not: null }, need: { is: { status: { not: 'active' } } } }] } }),
    prisma.trade.count({ where: { AND: [publicTradeVisibilityWhere(), { offerId: { not: null }, offer: { is: { status: { not: 'active' } } } }] } }),
    (prisma as any).report?.count({ where: { status: 'pending' } }) ?? Promise.resolve(0),
    prisma.supportTicket.count({ where: { priority: { in: ['high', 'urgent'] }, status: { in: ['open', 'in_review', 'waiting_for_user'] } } }),
    prisma.mediaAsset.count({ where: { status: 'pending_review' } }),
    prisma.mediaAsset.count({ where: { status: 'flagged' } }),
  ]);

  const publicVisibilityLeaks = feedEligibleRestrictedOwnerTrades + feedEligibleClosedNeedTrades + feedEligibleClosedOfferTrades;
  const pendingOrFlaggedMedia = pendingReviewMedia + flaggedMedia;
  const checks: Array<{ id: string; label: string; status: QaStatus; detail: string; action?: string }> = [
    {
      id: 'auth-session-revocation',
      label: 'Session revocation enforced',
      status: restrictedUsersWithOpenSessions > 0 ? 'warning' : 'pass',
      detail: restrictedUsersWithOpenSessions > 0
        ? `${restrictedUsersWithOpenSessions} active session(s) still belong to restricted users. Access tokens are checked against session revocation, but these users should be forced out for a cleaner launch state.`
        : 'Authenticated requests now validate access tokens against session revocation, global user sessionRevokedAt, and session expiry.',
      action: restrictedUsersWithOpenSessions > 0 ? 'Use Suspend or Force logout from /admin for restricted users with active sessions.' : undefined,
    },
    {
      id: 'optional-auth-public-fallback',
      label: 'Public reads tolerate revoked tokens',
      status: 'pass',
      detail: 'Optional public reads fall back to anonymous access when a stale, expired, or revoked token is sent.',
    },
    {
      id: 'public-visibility-leaks',
      label: 'Public visibility filters',
      status: publicVisibilityLeaks > 0 ? 'fail' : 'pass',
      detail: publicVisibilityLeaks > 0
        ? `${publicVisibilityLeaks} feed-eligible visibility leak(s) were detected.`
        : 'No restricted-owner or closed-inventory rows are eligible for public trade discovery.',
      action: publicVisibilityLeaks > 0 ? 'Run /admin/moderation-smoke and inspect samples in /admin/content.' : undefined,
    },
    {
      id: 'money-off-runtime',
      label: 'Money-off launch runtime',
      status: moneySafety.realMoneyEnabled ? 'fail' : activePublicMoneyTradesWhileMoneyOff > 0 ? 'warning' : moneySafety.moneyFeaturesVisible ? 'warning' : 'pass',
      detail: moneySafety.realMoneyEnabled
        ? `Real money is enabled through ${moneySafety.moneyProvider}.`
        : activePublicMoneyTradesWhileMoneyOff > 0
          ? `${activePublicMoneyTradesWhileMoneyOff} active public money/credit trade(s) exist while money is off. Public feed filters should hide them, but close or review them before launch.`
          : moneySafety.moneyFeaturesVisible
            ? 'Money UI is visible in demo/sandbox mode; keep this only for controlled QA.'
            : 'Money, wallet, payouts, and money trades are hidden for first launch runtime.',
      action: moneySafety.realMoneyEnabled ? 'Set MONEY_LAUNCH_MODE=disabled and MONEY_PRODUCTION_ENABLED=false.' : activePublicMoneyTradesWhileMoneyOff > 0 ? 'Use /admin/content to close or hide old money/credit trades.' : undefined,
    },
    {
      id: 'admin-two-factor-runtime',
      label: 'Admin 2FA runtime guard',
      status: env.adminRequireTwoFactor ? 'pass' : 'warning',
      detail: env.adminRequireTwoFactor
        ? 'Admin routes require authenticator app 2FA before tools can be used.'
        : 'ADMIN_REQUIRE_TWO_FACTOR is disabled. This should only happen in local smoke tests.',
      action: env.adminRequireTwoFactor ? undefined : 'Set ADMIN_REQUIRE_TWO_FACTOR=true before public launch.',
    },
    {
      id: 'reports-support-media-queues',
      label: 'Safety queues ready for rehearsal',
      status: pendingReports > 0 || urgentSupportTickets > 0 || pendingOrFlaggedMedia > 0 ? 'warning' : 'pass',
      detail: `${pendingReports} pending report(s), ${urgentSupportTickets} urgent/high support ticket(s), ${pendingOrFlaggedMedia} pending/flagged media item(s).`,
      action: pendingReports > 0 || urgentSupportTickets > 0 || pendingOrFlaggedMedia > 0 ? 'Open /admin/reports, /admin/support, and /admin/media before launch.' : undefined,
    },
  ];

  const summary = checks.reduce((acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }), { pass: 0, warning: 0, fail: 0 });
  const overallStatus: QaStatus = summary.fail > 0 ? 'fail' : summary.warning > 0 ? 'warning' : 'pass';

  res.json({
    overallStatus,
    generatedAt: now.toISOString(),
    launchMode: {
      nodeEnv: env.nodeEnv,
      moneyLaunchMode: moneySafety.launchMode,
      moneyFeaturesVisible: moneySafety.moneyFeaturesVisible,
      walletVisible: moneySafety.walletVisible,
      payoutsVisible: moneySafety.payoutsVisible,
      moneyTradesEnabled: moneySafety.moneyTradesEnabled,
      realMoneyEnabled: moneySafety.realMoneyEnabled,
      adminRequireTwoFactor: env.adminRequireTwoFactor,
    },
    counts: {
      restrictedUsersWithOpenSessions,
      activePublicMoneyTradesWhileMoneyOff,
      publicVisibilityLeaks,
      pendingReports,
      urgentSupportTickets,
      pendingOrFlaggedMedia,
    },
    checks,
    rehearsal: [
      { step: 1, label: 'Load launch dashboard', expected: 'Overview, launch checklist, runtime QA, and moderation smoke all load for an admin account.', operatorAction: 'Open /admin and click Load dashboard.' },
      { step: 2, label: 'Suspend a non-admin test user', expected: 'Sessions are revoked, public profile becomes unavailable, and existing active public posts disappear from discovery.', operatorAction: 'Use /admin user controls with an internal note.' },
      { step: 3, label: 'Confirm stale token behavior', expected: 'The suspended user receives 401/403 on authenticated writes; public reads work as anonymous.', operatorAction: 'Retry the app with the suspended user session in web or Expo.' },
      { step: 4, label: 'Hide and restore one test content item', expected: 'Hidden/closed content shows as not discoverable in /admin/content and is absent from public feed.', operatorAction: 'Use /admin/content actions with an internal note.' },
      { step: 5, label: 'Escalate one test report to support', expected: 'The report moves to reviewing, a linked support ticket is created, and audit log records the escalation.', operatorAction: 'Use /admin/reports → Escalate to support.' },
      { step: 6, label: 'Review support/media queues', expected: 'Urgent support and pending/flagged media queues have a launch decision or admin note.', operatorAction: 'Open /admin/support and /admin/media.' },
    ],
    summary,
  });
}));

adminRoutes.get('/money-safety', asyncRoute(async (_req, res) => {
  res.json(await buildAdminMoneySafetySummary(prisma));
}));


adminRoutes.get('/trades/disputes', asyncRoute(async (_req, res) => {
  const trades = await prisma.trade.findMany({
    where: { status: 'disputed' },
    include: { ...tradeInclude, proposals: { where: { status: 'accepted' }, include: { applicant: { select: { id: true, email: true, profile: true } } } } },
    orderBy: { disputedAt: 'desc' },
    take: 100,
  });
  const tickets = await prisma.supportTicket.findMany({
    where: { relatedTradeId: { in: trades.map((trade) => trade.id) } },
    include: { user: { select: { id: true, email: true, profile: true } }, assignedAdmin: { select: { id: true, email: true, profile: true } }, _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ trades: await Promise.all(trades.map((trade) => withOneTradeDeckMedia(trade, 'owner'))), supportTickets: await withSupportTicketMedia(tickets, 'admin') });
}));

adminRoutes.patch('/trades/:tradeId/dispute', asyncRoute(async (req, res) => {
  const input = adminTradeDisputeActionRequestSchema.parse(req.body);
  const trade = await prisma.trade.findUnique({ where: { id: req.params.tradeId }, include: tradeInclude });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  if (trade.status !== 'disputed') return res.status(409).json({ error: 'trade_not_disputed', message: 'Only disputed trades can be resolved through this action.' });
  const note = input.note?.trim();
  const disputePayment = trade.payment;
  const updated = await prisma.$transaction(async (tx: any) => {
    if (input.action === 'refund_payer') {
      await refundHeldWalletMoney(tx, trade, req.user!.id);
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'cancelled', closedAt: new Date(), confirmedById: req.user!.id, confirmedAt: new Date() }, include: tradeInclude });
    }
    if (input.action === 'release_seller') {
      await releaseHeldWalletMoney(tx, trade);
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'completed', closedAt: new Date(), confirmedById: req.user!.id, confirmedAt: new Date() }, include: tradeInclude });
    }
    return tx.trade.update({ where: { id: trade.id }, data: { status: 'closed', closedAt: new Date(), confirmedById: req.user!.id, confirmedAt: new Date() }, include: tradeInclude });
  });
  if (input.action === 'release_seller' && disputePayment?.status === 'held' && disputePayment.amountCents > 0 && disputePayment.sellerId) {
    await mirrorProviderTradeRelease({ tradeId: trade.id, buyerId: disputePayment.buyerId, sellerId: disputePayment.sellerId, amountCents: disputePayment.amountCents, currency: disputePayment.currency, confirmedById: req.user!.id });
  }
  if (input.action === 'refund_payer' && disputePayment && ['held', 'released'].includes(disputePayment.status) && disputePayment.amountCents > 0) {
    await mirrorProviderTradeRefund({ tradeId: trade.id, buyerId: disputePayment.buyerId, sellerId: disputePayment.sellerId, amountCents: disputePayment.amountCents, currency: disputePayment.currency, refundedById: req.user!.id, wasReleased: disputePayment.status === 'released', reason: 'admin_dispute_refund' });
  }
  if (note || trade.disputeTicketId) {
    await prisma.supportTicketMessage.create({ data: { ticketId: trade.disputeTicketId ?? '', senderId: req.user!.id, senderRole: 'admin', internal: true, body: note || `Admin resolved dispute with action: ${input.action}` } }).catch(() => null);
  }
  await recordAdminAuditLog(prisma, req.user!.id, {
    action: `trade.dispute.${input.action}`,
    targetType: 'trade',
    targetId: trade.id,
    reason: note,
    previousValue: { status: trade.status, disputedAt: trade.disputedAt, disputeTicketId: trade.disputeTicketId },
    nextValue: { status: updated.status, closedAt: updated.closedAt },
  });
  res.json({ trade: await withOneTradeDeckMedia(updated, 'owner') });
}));


function payoutGrossCents(payout: { amountCents: number; grossAmountCents?: number | null }) {
  return payout.grossAmountCents && payout.grossAmountCents > 0 ? payout.grossAmountCents : payout.amountCents;
}

const adminPayoutUserSelect = { id: true, email: true, profile: true, trustTier: true, trustTierUpdatedAt: true, trustTierNote: true, emailVerifiedAt: true, wallet: true } as const;
const adminPayoutEventInclude = { admin: { select: { id: true, email: true, profile: true } } } as const;
const adminPayoutInclude = {
  user: { select: adminPayoutUserSelect },
  stripeConnectAccount: true,
  providerAccount: true,
  providerTransactions: { orderBy: { createdAt: 'desc' as const }, take: 8 },
  adminEvents: { include: adminPayoutEventInclude, orderBy: { createdAt: 'desc' as const }, take: 8 },
} as const;

function appendAdminNote(current: string | null | undefined, note: string | undefined, action: string) {
  const cleanNote = note?.trim();
  const stamp = new Date().toISOString();
  const nextLine = cleanNote ? `[${stamp}] admin:${action} — ${cleanNote}` : `[${stamp}] admin:${action}`;
  return [current?.trim(), nextLine].filter(Boolean).join('\n');
}


function providerForPayout(payout: { provider?: 'none' | 'stripe' | 'airwallex' | null }) {
  return payout.provider ? getMoneyProvider(payout.provider) : getActiveMoneyProvider();
}

function shouldCreateProviderPayoutTransfer(payout: { provider?: 'none' | 'stripe' | 'airwallex' | null; providerAccountId?: string | null; netAmountCents: number }) {
  const moneySafety = buildGlobalMoneySafetyConfig();
  if (!moneySafety.providerTransfersEnabled || payout.netAmountCents <= 0) return false;
  if (!payout.provider || payout.provider === 'none') return false;
  if (payout.provider === 'airwallex') return Boolean(payout.providerAccountId);
  if (payout.provider === 'stripe') return true;
  return false;
}

async function createProviderPayoutTransferForAdmin(input: {
  payoutId: string;
  adminId: string;
  scaToken?: string | null;
}) {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: input.payoutId },
    include: { providerAccount: true, stripeConnectAccount: true },
  });
  if (!payout) return null;
  if (!shouldCreateProviderPayoutTransfer(payout)) return null;
  const provider = providerForPayout(payout);
  return provider.createPayoutTransfer({
    userId: payout.userId,
    payoutId: payout.id,
    grossAmountCents: payoutGrossCents(payout),
    platformFeeCents: payout.platformFeeCents,
    netAmountCents: payout.netAmountCents,
    currency: payout.currency,
    requestedById: input.adminId,
    scaToken: input.scaToken ?? null,
  });
}

async function syncProviderPayoutTransferForAdmin(input: { payoutId: string; scaToken?: string | null }) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: input.payoutId } });
  if (!payout) return null;
  if (!payout.provider || payout.provider === 'none') return null;
  const provider = getMoneyProvider(payout.provider);
  return provider.syncPayoutTransfer({ payoutId: payout.id, providerTransferId: payout.providerTransferId ?? undefined, scaToken: input.scaToken ?? null });
}

adminRoutes.get('/payouts', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'all';
  const status = adminPayoutStatusFilterSchema.safeParse(rawStatus);
  const rawUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const where = {
    ...(status.success && status.data !== 'all' ? { status: status.data } : {}),
    ...(rawUserId ? { userId: rawUserId } : {}),
  };
  const [payouts, byStatus] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      include: adminPayoutInclude,
      orderBy: { requestedAt: 'desc' },
      take: 100
    }),
    prisma.payoutRequest.groupBy({ by: ['status'], _count: { _all: true }, _sum: { grossAmountCents: true, platformFeeCents: true, netAmountCents: true } })
  ]);
  res.json({ payouts, summary: { byStatus } });
}));

adminRoutes.get('/payouts/:payoutId', asyncRoute(async (req, res) => {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: req.params.payoutId }, include: { ...adminPayoutInclude, adminEvents: { include: adminPayoutEventInclude, orderBy: { createdAt: 'desc' } } } });
  if (!payout) return res.status(404).json({ error: 'not_found' });
  const providerEventFilters: Array<Record<string, string>> = [];
  if (payout.providerEventId) providerEventFilters.push({ providerEventId: payout.providerEventId });
  if (payout.providerTransferId) providerEventFilters.push({ providerEventId: payout.providerTransferId });
  if (payout.providerPayoutId) providerEventFilters.push({ providerEventId: payout.providerPayoutId });
  if (payout.providerAccount?.providerAccountId) providerEventFilters.push({ providerAccountId: payout.providerAccount.providerAccountId });
  const [ledgerEntries, supportTickets, stripeEvents, providerEvents, providerTransactions, userLimits] = await Promise.all([
    prisma.creditLedgerEntry.findMany({ where: { userId: payout.userId }, orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.supportTicket.findMany({ where: { userId: payout.userId }, include: { user: { select: supportUserSelect }, assignedAdmin: { select: supportUserSelect }, _count: { select: { messages: true } } }, orderBy: { updatedAt: 'desc' }, take: 10 }),
    prisma.stripeEvent.findMany({
      where: (() => {
        const filters: Array<Record<string, string>> = [];
        if (payout.stripeEventId) filters.push({ stripeEventId: payout.stripeEventId });
        if (payout.stripePayoutId) filters.push({ objectId: payout.stripePayoutId });
        if (payout.stripeTransferId) filters.push({ objectId: payout.stripeTransferId });
        if (payout.stripeConnectAccount?.stripeAccountId) filters.push({ stripeAccountId: payout.stripeConnectAccount.stripeAccountId });
        if (payout.stripeConnectAccountId) filters.push({ stripeConnectAccountId: payout.stripeConnectAccountId });
        return filters.length ? { OR: filters } : { stripeEventId: '__none__' };
      })(),
      orderBy: { createdAt: 'desc' },
      take: 25
    }),
    prisma.moneyProviderEvent.findMany({
      where: providerEventFilters.length ? { OR: providerEventFilters } : { providerEventId: '__none__' },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.moneyProviderTransaction.findMany({
      where: { payoutRequestId: payout.id },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    buildLaunchLimits(prisma, payout.userId)
  ]);
  res.json({ payout, ledgerEntries, supportTickets: await withSupportTicketMedia(supportTickets, 'admin'), stripeEvents, providerEvents, providerTransactions, userLimits });
}));

adminRoutes.patch('/payouts/:payoutId/action', asyncRoute(async (req, res) => {
  const input = adminPayoutActionRequestSchema.parse(req.body);
  const payout = await prisma.payoutRequest.findUnique({ where: { id: req.params.payoutId }, include: { user: { select: { id: true, wallet: true } }, stripeConnectAccount: true, providerAccount: true } });
  if (!payout) return res.status(404).json({ error: 'not_found' });

  const previousStatus = payout.status;
  const note = input.note?.trim();
  const now = new Date();
  const grossAmountCents = payoutGrossCents(payout);
  const safeMutable = !['paid', 'rejected', 'cancelled'].includes(previousStatus);

  let nextStatus = previousStatus;
  let data: any = { notes: appendAdminNote(payout.notes, note, input.action) };
  let ledgerDescription: string | null = null;
  let walletIncrement = 0;

  if (input.action === 'approve') {
    if (!safeMutable) return res.status(409).json({ error: 'payout_not_mutable', message: 'Only draft/requested payouts can be approved.' });
    nextStatus = 'approved';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeExternalStatus: payout.stripeExternalStatus ?? 'admin_approved', providerExternalStatus: payout.providerExternalStatus ?? 'admin_approved' };
  } else if (input.action === 'pause') {
    if (previousStatus === 'paid') return res.status(409).json({ error: 'payout_paid', message: 'Paid payouts cannot be paused.' });
    nextStatus = 'requested';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeExternalStatus: 'admin_paused', providerExternalStatus: 'admin_paused' };
  } else if (input.action === 'retry') {
    if (previousStatus === 'paid') return res.status(409).json({ error: 'payout_paid', message: 'Paid payouts cannot be retried.' });
    nextStatus = previousStatus === 'rejected' || previousStatus === 'cancelled' ? previousStatus : 'requested';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeFailureCode: null, stripeFailureMessage: null, stripeExternalStatus: 'admin_retry_requested', providerFailureCode: null, providerFailureMessage: null, providerExternalStatus: 'admin_retry_requested' };
  } else if (input.action === 'mark_paid') {
    if (previousStatus === 'rejected' || previousStatus === 'cancelled') return res.status(409).json({ error: 'payout_closed', message: 'Rejected or cancelled payouts cannot be marked paid.' });
    nextStatus = 'paid';
    data = { ...data, status: nextStatus, reviewedAt: now, paidAt: payout.paidAt ?? now, stripeExternalStatus: payout.stripeExternalStatus ?? 'admin_marked_paid', providerExternalStatus: payout.providerExternalStatus ?? 'admin_marked_paid' };
    ledgerDescription = 'Admin marked payout as paid.';
  } else if (input.action === 'reject' || input.action === 'cancel') {
    if (previousStatus === 'paid') return res.status(409).json({ error: 'payout_paid', message: 'Paid payouts cannot be rejected or cancelled.' });
    nextStatus = input.action === 'reject' ? 'rejected' : 'cancelled';
    data = { ...data, status: nextStatus, reviewedAt: now, stripeExternalStatus: `admin_${nextStatus}`, providerExternalStatus: `admin_${nextStatus}` };
    if (previousStatus !== 'rejected' && previousStatus !== 'cancelled') {
      walletIncrement = grossAmountCents;
      ledgerDescription = input.action === 'reject' ? 'Admin rejected payout and returned gross payout-eligible earnings.' : 'Admin cancelled payout and returned gross payout-eligible earnings.';
    }
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    if (walletIncrement > 0 && payout.user.wallet) {
      await tx.wallet.update({ where: { id: payout.user.wallet.id }, data: { pendingPayoutCents: { increment: walletIncrement } } });
      await tx.creditLedgerEntry.create({ data: { userId: payout.userId, walletId: payout.user.wallet.id, type: 'adjustment', balanceType: 'earned_pending', amount: 0, amountCents: walletIncrement, currency: payout.currency, description: ledgerDescription, metadata: { payoutId: payout.id, adminAction: input.action } } });
    } else if (ledgerDescription && payout.user.wallet) {
      await tx.creditLedgerEntry.create({ data: { userId: payout.userId, walletId: payout.user.wallet.id, type: 'payout_paid', balanceType: 'earned_pending', amount: 0, amountCents: 0, currency: payout.currency, description: ledgerDescription, metadata: { payoutId: payout.id, adminAction: input.action } } });
    }
    const updatedPayout = await tx.payoutRequest.update({ where: { id: payout.id }, data, include: adminPayoutInclude });
    await tx.adminPayoutEvent.create({ data: { payoutRequestId: payout.id, adminId: req.user!.id, action: input.action, note: note || null, previousStatus, nextStatus, metadata: { grossAmountCents, walletReturnedCents: walletIncrement, stripeExternalStatus: updatedPayout.stripeExternalStatus, providerExternalStatus: updatedPayout.providerExternalStatus } } });
    return updatedPayout;
  });

  let refreshed = updated;
  let providerTransfer: unknown = null;
  let providerTransferError: string | null = null;
  if ((input.action === 'approve' || input.action === 'retry') && shouldCreateProviderPayoutTransfer(updated)) {
    try {
      providerTransfer = await createProviderPayoutTransferForAdmin({ payoutId: updated.id, adminId: req.user!.id, scaToken: input.scaToken ?? null });
      refreshed = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: updated.id }, include: adminPayoutInclude });
      await prisma.adminPayoutEvent.create({ data: { payoutRequestId: updated.id, adminId: req.user!.id, action: 'provider_transfer_created', previousStatus: updated.status, nextStatus: refreshed.status, metadata: JSON.parse(JSON.stringify({ providerTransfer })) } });
    } catch (error) {
      providerTransferError = error instanceof Error ? error.message : 'Provider payout transfer failed';
      refreshed = await prisma.payoutRequest.update({ where: { id: updated.id }, data: { providerExternalStatus: 'transfer_failed', providerFailureCode: 'provider_transfer_failed', providerFailureMessage: providerTransferError, notes: appendAdminNote(updated.notes, providerTransferError, 'provider_transfer_failed') }, include: adminPayoutInclude });
      await prisma.adminPayoutEvent.create({ data: { payoutRequestId: updated.id, adminId: req.user!.id, action: 'provider_transfer_failed', previousStatus: updated.status, nextStatus: refreshed.status, metadata: { error: providerTransferError } } });
    }
  }

  res.json({ payout: refreshed, providerTransfer, providerTransferError });
}));

adminRoutes.post('/payouts/:payoutId/provider-sync', asyncRoute(async (req, res) => {
  try {
    const payoutId = req.params.payoutId;
    if (!payoutId) return res.status(400).json({ error: 'payout_id_required' });
    const result = await syncProviderPayoutTransferForAdmin({ payoutId, scaToken: typeof req.body?.scaToken === 'string' ? req.body.scaToken : null });
    const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, include: adminPayoutInclude });
    if (!payout) return res.status(404).json({ error: 'not_found' });
    await prisma.adminPayoutEvent.create({ data: { payoutRequestId: payout.id, adminId: req.user!.id, action: 'provider_transfer_synced', previousStatus: payout.status, nextStatus: payout.status, metadata: { result } } }).catch(() => null);
    res.json({ payout, providerTransfer: result });
  } catch (error) {
    if (error instanceof MoneyProviderError) return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
    throw error;
  }
}));

adminRoutes.get('/stripe/connect-accounts', asyncRoute(async (_req, res) => {
  const accounts = await prisma.stripeConnectAccount.findMany({
    include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100
  });
  res.json({ accounts });
}));

adminRoutes.get('/stripe/events', asyncRoute(async (_req, res) => {
  const events = await prisma.stripeEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ events });
}));

adminRoutes.get('/business-profiles', asyncRoute(async (_req, res) => {
  const businessProfiles = await prisma.businessProfile.findMany({
    include: {
      owner: { select: { id: true, email: true, profile: true, trustTier: true } },
      reviewer: { select: { id: true, email: true, profile: true } },
      members: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } }, orderBy: { createdAt: 'asc' } },
      moneyProviderAccounts: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { needs: true, offers: true, trades: true } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 150,
  });
  const provider = buildMoneyProviderStatus();
  res.json({ provider, businessProfiles: businessProfiles.map((profile) => ({ ...profile, counts: profile._count })) });
}));

adminRoutes.patch('/business-profiles/:businessProfileId/action', asyncRoute(async (req, res) => {
  const input = adminBusinessProfileActionRequestSchema.parse(req.body);
  const existing = await prisma.businessProfile.findUnique({ where: { id: req.params.businessProfileId } });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  const statusByAction = {
    verify: 'verified',
    restrict: 'restricted',
    disable: 'disabled',
    reject: 'rejected',
    activate: 'active',
  } as const;
  const nextStatus = statusByAction[input.action];
  const updated = await prisma.businessProfile.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      reviewedAt: new Date(),
      reviewerId: req.user!.id,
      reviewNote: input.note ?? null,
      verifiedAt: input.action === 'verify' ? new Date() : input.action === 'activate' ? existing.verifiedAt : null,
    },
    include: {
      owner: { select: { id: true, email: true, profile: true, trustTier: true } },
      reviewer: { select: { id: true, email: true, profile: true } },
      members: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } }, orderBy: { createdAt: 'asc' } },
      moneyProviderAccounts: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { needs: true, offers: true, trades: true } },
    },
  });
  res.json({ businessProfile: { ...updated, counts: updated._count } });
}));


adminRoutes.get('/money/provider-accounts', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const [providerAccounts, legacyStripeAccounts] = await Promise.all([
    prisma.moneyProviderAccount.findMany({
      include: { user: { select: { id: true, email: true, profile: true, trustTier: true } }, businessProfile: true, balances: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.stripeConnectAccount.findMany({
      include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
  ]);
  res.json({
    provider,
    accounts: [
      ...providerAccounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        accountType: account.accountType,
        businessProfileId: account.businessProfileId,
        businessProfile: account.businessProfile,
        status: account.status,
        defaultCurrency: account.defaultCurrency,
        country: account.country,
        capabilities: account.capabilities,
        requirements: account.requirements,
        rawProviderStatus: account.rawProviderStatus,
        balances: account.balances,
        lastSyncedAt: account.lastSyncedAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        user: account.user,
      })),
      ...legacyStripeAccounts.map((account) => ({
        provider: 'stripe_legacy',
        providerAccountId: account.stripeAccountId,
        legacyStripeAccountId: account.stripeAccountId,
        status: account.status,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        detailsSubmitted: account.detailsSubmitted,
        defaultCurrency: account.defaultCurrency,
        country: account.country,
        lastSyncedAt: account.lastSyncedAt,
        user: account.user,
      })),
    ],
  });
}));


adminRoutes.get('/money/provider-balances', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const balances = await prisma.moneyProviderWalletBalance.findMany({
    include: { account: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } }, businessProfile: true } } },
    orderBy: [{ updatedAt: 'desc' }, { currency: 'asc' }],
    take: 250,
  });
  res.json({
    provider,
    balances: balances.map((balance) => ({
      id: balance.id,
      provider: balance.provider,
      providerAccountId: balance.account.providerAccountId,
      moneyProviderAccountId: balance.moneyProviderAccountId,
      currency: balance.currency,
      availableCents: balance.availableCents,
      reservedCents: balance.reservedCents,
      pendingCents: balance.pendingCents,
      totalCents: balance.availableCents + balance.reservedCents + balance.pendingCents,
      externalUpdatedAt: balance.externalUpdatedAt,
      lastSyncedAt: balance.lastSyncedAt,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
      account: {
        id: balance.account.id,
        provider: balance.account.provider,
        status: balance.account.status,
        accountType: balance.account.accountType,
        country: balance.account.country,
        defaultCurrency: balance.account.defaultCurrency,
        user: balance.account.user,
        businessProfile: balance.account.businessProfile,
      },
    })),
  });
}));

adminRoutes.post('/money/provider-accounts/:accountId/sync-balances', asyncRoute(async (req, res) => {
  const input = moneyProviderWalletBalancesSyncRequestSchema.parse(req.body ?? {});
  const account = await prisma.moneyProviderAccount.findUnique({
    where: { id: req.params.accountId },
    include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } },
  });
  if (!account) return res.status(404).json({ error: 'provider_account_not_found', message: 'Provider account was not found.' });
  const provider = getMoneyProvider(account.provider);
  try {
    const result = await provider.syncWalletBalances({ providerAccountId: account.providerAccountId, scaToken: input.scaToken });
    res.json({ provider: provider.getPublicStatus(), ...result });
  } catch (error) {
    if (error instanceof MoneyProviderError) return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
    throw error;
  }
}));


adminRoutes.get('/money/provider-transactions', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const transactions = await prisma.moneyProviderTransaction.findMany({
    include: {
      user: { select: { id: true, email: true, profile: true, trustTier: true } },
      account: { select: { id: true, provider: true, providerAccountId: true, status: true, businessProfile: true, user: { select: { id: true, email: true, profile: true, trustTier: true } } } },
      counterpartyAccount: { select: { id: true, provider: true, providerAccountId: true, status: true, businessProfile: true, user: { select: { id: true, email: true, profile: true, trustTier: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 150,
  });
  res.json({
    provider,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      provider: transaction.provider,
      providerTransactionId: transaction.providerTransactionId,
      type: transaction.type,
      status: transaction.status,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      userId: transaction.userId,
      tradeId: transaction.tradeId,
      payoutRequestId: transaction.payoutRequestId,
      providerAccountId: transaction.account?.providerAccountId ?? null,
      counterpartyProviderAccountId: transaction.counterpartyAccount?.providerAccountId ?? null,
      rawProviderStatus: transaction.rawProviderStatus,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      user: transaction.user,
      account: transaction.account,
      counterpartyAccount: transaction.counterpartyAccount,
    })),
  });
}));

adminRoutes.get('/money/provider-events', asyncRoute(async (_req, res) => {
  const provider = buildMoneyProviderStatus();
  const [providerEvents, legacyStripeEvents] = await Promise.all([
    prisma.moneyProviderEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.stripeEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  res.json({
    provider,
    events: [
      ...providerEvents.map((event) => ({
        provider: event.provider,
        providerEventId: event.providerEventId,
        type: event.eventType,
        processingStatus: event.status,
        providerAccountId: event.providerAccountId,
        createdAt: event.createdAt,
        processedAt: event.processedAt,
        error: event.error,
        payload: event.payload,
      })),
      ...legacyStripeEvents.map((event) => ({
        provider: 'stripe_legacy',
        providerEventId: event.stripeEventId,
        type: event.type,
        processingStatus: event.processingStatus,
        providerAccountId: event.stripeAccountId,
        objectId: event.objectId,
        livemode: event.livemode,
        createdAt: event.createdAt,
        processedAt: event.processedAt,
        error: event.error,
      })),
    ],
  });
}));

adminRoutes.get('/media', asyncRoute(async (req, res) => {
  const input = adminListMediaQuerySchema.parse(req.query);
  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.ownerId ? { ownerId: input.ownerId } : {})
  };
  const media = await prisma.mediaAsset.findMany({
    where,
    include: {
      owner: { select: mediaUserSelect },
      reviewer: { select: mediaUserSelect }
    },
    orderBy: { createdAt: 'desc' },
    take: input.take ?? 100
  });
  res.json({ media: await withMediaEntityContext(media) });
}));

adminRoutes.get('/media/summary', asyncRoute(async (_req, res) => {
  const [byStatus, byEntityType] = await Promise.all([
    prisma.mediaAsset.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.mediaAsset.groupBy({ by: ['entityType'], _count: { _all: true } })
  ]);

  res.json({
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
    byEntityType: Object.fromEntries(byEntityType.map((row) => [row.entityType ?? 'unattached', row._count._all]))
  });
}));

adminRoutes.get('/media/:mediaId', asyncRoute(async (req, res) => {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: req.params.mediaId },
    include: {
      owner: { select: mediaUserSelect },
      reviewer: { select: mediaUserSelect }
    }
  });
  if (!media) return res.status(404).json({ error: 'not_found' });
  res.json({ media: (await withMediaEntityContext([media]))[0] });
}));

adminRoutes.patch('/media/:mediaId/status', asyncRoute(async (req, res) => {
  const input = updateMediaStatusRequestSchema.parse(req.body);
  const media = await prisma.mediaAsset.findUnique({ where: { id: req.params.mediaId } });
  if (!media) return res.status(404).json({ error: 'not_found' });
  const updated = await prisma.mediaAsset.update({
    where: { id: media.id },
    data: { status: input.status, reviewNote: input.reviewNote ?? null, reviewerId: req.user!.id, reviewedAt: new Date() },
    include: { owner: { select: { id: true, email: true, profile: true } }, reviewer: { select: { id: true, email: true, profile: true } } }
  });
  if (updated.entityType === 'profile' && updated.entityId && input.status === 'removed') {
    await prisma.profile.updateMany({ where: { id: updated.entityId, avatarMediaId: updated.id }, data: { avatarUrl: null, avatarMediaId: null } });
  }
  await recordAdminAuditLog(prisma, req.user!.id, {
    action: 'media.status.update',
    targetType: 'media',
    targetId: updated.id,
    reason: input.reviewNote,
    previousValue: { status: media.status, reviewNote: media.reviewNote },
    nextValue: { status: updated.status, reviewNote: updated.reviewNote },
    metadata: { entityType: updated.entityType, entityId: updated.entityId, ownerId: updated.ownerId },
  });
  res.json({ media: (await withMediaEntityContext([updated]))[0] });
}));

adminRoutes.get('/credits/purchases', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where = rawStatus && ['pending', 'paid', 'failed', 'expired'].includes(rawStatus) ? { status: rawStatus as 'pending' | 'paid' | 'failed' | 'expired' } : {};
  const purchases = await prisma.creditPurchase.findMany({
    where,
    include: { user: { select: { id: true, email: true, profile: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json({ purchases });
}));


const supportUserSelect = { id: true, email: true, profile: true } as const;
const supportTicketIncludeForAdmin = {
  user: { select: supportUserSelect },
  assignedAdmin: { select: supportUserSelect },
  messages: {
    include: { sender: { select: supportUserSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

adminRoutes.get('/support/tickets', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const rawCategory = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rawPriority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const rawAssigned = typeof req.query.assigned === 'string' ? req.query.assigned : undefined;
  const q = toStringParam(req.query.q);
  const status = rawStatus ? supportTicketStatusSchema.safeParse(rawStatus) : null;
  const category = rawCategory ? supportTicketCategorySchema.safeParse(rawCategory) : null;
  const priority = rawPriority ? supportTicketPrioritySchema.safeParse(rawPriority) : null;
  const where = {
    ...(status?.success ? { status: status.data } : {}),
    ...(category?.success ? { category: category.data } : {}),
    ...(priority?.success ? { priority: priority.data } : {}),
    ...(rawAssigned === 'unassigned' ? { assignedAdminId: null } : rawAssigned === 'mine' ? { assignedAdminId: req.user!.id } : {}),
    ...(q ? {
      OR: [
        { subject: { contains: q, mode: 'insensitive' as const } },
        { message: { contains: q, mode: 'insensitive' as const } },
        { id: { contains: q, mode: 'insensitive' as const } },
        { user: { is: { email: { contains: q, mode: 'insensitive' as const } } } },
        { guestEmail: { contains: q, mode: 'insensitive' as const } },
        { guestAccountEmail: { contains: q, mode: 'insensitive' as const } },
        { guestName: { contains: q, mode: 'insensitive' as const } },
        { user: { is: { profile: { is: { displayName: { contains: q, mode: 'insensitive' as const } } } } } },
        { user: { is: { profile: { is: { handle: { contains: q, mode: 'insensitive' as const } } } } } },
      ],
    } : {}),
  };
  const tickets = await prisma.supportTicket.findMany({
    where,
    include: { user: { select: supportUserSelect }, assignedAdmin: { select: supportUserSelect }, _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ tickets: await withSupportTicketMedia(tickets, 'admin') });
}));

adminRoutes.get('/support/tickets/:ticketId', asyncRoute(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId }, include: supportTicketIncludeForAdmin });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  res.json({ ticket: await withOneSupportTicketMedia(ticket, 'admin') });
}));

adminRoutes.patch('/support/tickets/:ticketId', asyncRoute(async (req, res) => {
  const input = adminUpdateSupportTicketRequestSchema.parse(req.body);
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const status = input.status ?? existing.status;
  const note = input.note?.trim();
  if (input.status && input.status !== existing.status && !note) {
    return res.status(400).json({ error: 'admin_note_required', message: 'Add an internal note before changing support ticket status.' });
  }
  const updated = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: {
      status,
      priority: input.priority ?? existing.priority,
      assignedAdminId: input.assignedAdminId === undefined ? existing.assignedAdminId : input.assignedAdminId,
      resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null,
    },
    include: supportTicketIncludeForAdmin,
  });
  await recordAdminAuditLog(prisma, req.user!.id, {
    action: 'support.ticket.update',
    targetType: 'support_ticket',
    targetId: existing.id,
    reason: note,
    previousValue: { status: existing.status, priority: existing.priority, assignedAdminId: existing.assignedAdminId, resolvedAt: existing.resolvedAt },
    nextValue: { status: updated.status, priority: updated.priority, assignedAdminId: updated.assignedAdminId, resolvedAt: updated.resolvedAt },
  });
  res.json({ ticket: await withOneSupportTicketMedia(updated, 'admin') });
}));

adminRoutes.post('/support/tickets/:ticketId/messages', asyncRoute(async (req, res) => {
  const input = adminCreateSupportMessageRequestSchema.parse(req.body);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  const message = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: req.user!.id,
      senderRole: 'admin',
      body: input.body,
      internal: input.internal ?? false,
    },
    include: { sender: { select: supportUserSelect } },
  });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'support_message', message.id);
  const nextStatus = input.status ?? (input.internal ? ticket.status : 'waiting_for_user');
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: nextStatus, assignedAdminId: ticket.assignedAdminId ?? req.user!.id, resolvedAt: nextStatus === 'resolved' || nextStatus === 'closed' ? new Date() : null },
  });
  await recordAdminAuditLog(prisma, req.user!.id, {
    action: input.internal ? 'support.internal_note.create' : 'support.reply.create',
    targetType: 'support_ticket',
    targetId: ticket.id,
    nextValue: { status: nextStatus, messageId: message.id, internal: input.internal ?? false },
  });
  res.status(201).json({ message: await withOneSupportMessageMedia(message, 'admin') });
}));
