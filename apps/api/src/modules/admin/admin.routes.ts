import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { adminBusinessProfileActionRequestSchema, adminBusinessBudgetActionRequestSchema, adminBusinessBudgetListQuerySchema, adminBusinessCampaignActionRequestSchema, adminBusinessCampaignListQuerySchema, adminBusinessSponsoredPlacementActionRequestSchema, adminBusinessSponsoredPlacementListQuerySchema, adminContentActionRequestSchema, adminContentClassificationActionRequestSchema, adminContentClassificationAiSuggestionRequestSchema, adminListContentClassificationsQuerySchema, adminCreateSupportMessageRequestSchema, adminListReportsQuerySchema, adminReportActionRequestSchema, adminListContentQuerySchema, adminListMediaQuerySchema, adminPayoutActionRequestSchema, adminPayoutStatusFilterSchema, adminUserModerationActionRequestSchema, moneyProviderWalletBalancesSyncRequestSchema, adminTradeDisputeActionRequestSchema, adminUpdateTrustTierRequestSchema, adminUpdateSupportTicketRequestSchema, supportTicketCategorySchema, supportTicketPrioritySchema, supportTicketStatusSchema, updateMediaStatusRequestSchema } from '@hellowhen/contracts';
import { hasProAccess } from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireBusinessAccountsEnabled, requireBusinessBudgetsEnabled, requireBusinessCampaignsEnabled, requireBusinessSponsoredContentEnabled, requireMoneyFeaturesVisible, requirePayoutsVisible } from '../../middleware/featureGates.js';
import { attachUploadedMediaToEntity, withMedia, withOneMedia } from '../media/media.helpers.js';
import { buildLaunchLimits } from '../limits/launchLimits.js';
import { buildAdminMoneySafetySummary, buildGlobalMoneySafetyConfig } from '../money/moneySafety.js';
import { mirrorProviderTradeRefund, mirrorProviderTradeRelease } from '../money/tradeMoney.js';
import { buildMoneyProviderStatus, getActiveMoneyProvider, getMoneyProvider } from '../money/providers/moneyProviderRegistry.js';
import { MoneyProviderError } from '../money/providers/moneyProvider.types.js';
import { withOneSupportMessageMedia, withOneSupportTicketMedia, withSupportTicketMedia } from '../support/support.routes.js';
import { findReportTarget, hydrateReports, moderateReportedTarget } from '../reports/reports.routes.js';
import { publicTradeVisibilityWhere, refundHeldWalletMoney, releaseHeldWalletMoney, tradeInclude, withOneTradeDeckMedia } from '../trades/trades.routes.js';
import { buildAiSuggestionProviderStatus, classifyContentWithAiSuggestions, ContentAiSuggestionError } from '../content-intelligence/contentIntelligence.ai.js';
import { assertContentPlacementSignalsEnabled, buildContentPlacementSignalData, buildContentPlacementSignalStatus } from '../content-intelligence/contentIntelligence.signals.js';
import { API_METRICS_RETENTION_HOURS, USAGE_ACTIVITY_WINDOW_MINUTES, USAGE_LIVE_WINDOW_MINUTES, USAGE_MONITORING_PRIVACY_NOTE, USAGE_PRESENCE_RETENTION_HOURS, cleanupUsageMonitoringData, usageMonitoringWindowStart } from '../usage/usageRetention.js';
import { buildAdminServerHealth } from '../usage/serverHealth.js';

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

async function withMediaEntityContext<T extends { entityType: 'need' | 'offer' | 'trade' | 'inventory_template' | 'profile' | 'support_ticket' | 'support_message' | 'plan' | 'plan_place' | null; entityId: string | null }>(media: T[]) {
  const needIds = media.filter((item) => item.entityType === 'need' && item.entityId).map((item) => item.entityId!);
  const offerIds = media.filter((item) => item.entityType === 'offer' && item.entityId).map((item) => item.entityId!);
  const tradeIds = media.filter((item) => item.entityType === 'trade' && item.entityId).map((item) => item.entityId!);
  const inventoryTemplateIds = media.filter((item) => item.entityType === 'inventory_template' && item.entityId).map((item) => item.entityId!);
  const profileIds = media.filter((item) => item.entityType === 'profile' && item.entityId).map((item) => item.entityId!);
  const supportTicketIds = media.filter((item) => item.entityType === 'support_ticket' && item.entityId).map((item) => item.entityId!);
  const supportMessageIds = media.filter((item) => item.entityType === 'support_message' && item.entityId).map((item) => item.entityId!);
  const planIds = media.filter((item) => item.entityType === 'plan' && item.entityId).map((item) => item.entityId!);
  const planPlaceIds = media.filter((item) => item.entityType === 'plan_place' && item.entityId).map((item) => item.entityId!);

  const [needs, offers, trades, inventoryTemplates, profiles, supportTickets, supportMessages, plans, planPlaces] = await Promise.all([
    needIds.length ? prisma.need.findMany({ where: { id: { in: needIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, timing: true, mode: true, locationLabel: true } }) : [],
    offerIds.length ? prisma.offer.findMany({ where: { id: { in: offerIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, availability: true, mode: true, locationLabel: true } }) : [],
    tradeIds.length ? prisma.trade.findMany({ where: { id: { in: tradeIds } }, select: { id: true, ownerId: true, title: true, status: true, needId: true, offerId: true, creditAmount: true } }) : [],
    inventoryTemplateIds.length ? prisma.inventoryTemplate.findMany({ where: { id: { in: inventoryTemplateIds } }, select: { id: true, key: true, kind: true, title: true, status: true, itemType: true, category: true, languageCode: true, countryCode: true } }) : [],
    profileIds.length ? prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true, userId: true, displayName: true, handle: true, avatarUrl: true, avatarMediaId: true } }) : [],
    supportTicketIds.length ? prisma.supportTicket.findMany({ where: { id: { in: supportTicketIds } }, select: { id: true, userId: true, subject: true, status: true, priority: true, category: true } }) : [],
    supportMessageIds.length ? prisma.supportTicketMessage.findMany({ where: { id: { in: supportMessageIds } }, select: { id: true, ticketId: true, senderId: true, senderRole: true, body: true, createdAt: true } }) : [],
    planIds.length ? prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, mode: true, locationLabel: true, startsAt: true, endsAt: true } }) : [],
    planPlaceIds.length ? prisma.planPlace.findMany({ where: { id: { in: planPlaceIds } }, select: { id: true, planId: true, title: true, note: true, addressPublicText: true, startsAt: true, endsAt: true } }) : []
  ]);

  const needsById = new Map(needs.map((need) => [need.id, need]));
  const offersById = new Map(offers.map((offer) => [offer.id, offer]));
  const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
  const inventoryTemplatesById = new Map(inventoryTemplates.map((template) => [template.id, template]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const supportTicketsById = new Map(supportTickets.map((ticket) => [ticket.id, ticket]));
  const supportMessagesById = new Map(supportMessages.map((message) => [message.id, message]));
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const planPlacesById = new Map(planPlaces.map((place) => [place.id, place]));

  return media.map((item) => {
    if (item.entityType === 'need' && item.entityId) return { ...item, entity: needsById.get(item.entityId) ?? null };
    if (item.entityType === 'offer' && item.entityId) return { ...item, entity: offersById.get(item.entityId) ?? null };
    if (item.entityType === 'trade' && item.entityId) return { ...item, entity: tradesById.get(item.entityId) ?? null };
    if (item.entityType === 'inventory_template' && item.entityId) return { ...item, entity: inventoryTemplatesById.get(item.entityId) ?? null };
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
adminRoutes.use('/business-profiles', requireBusinessAccountsEnabled('Admin business profiles'));
adminRoutes.use('/business-sponsored-placements', requireBusinessSponsoredContentEnabled('Admin Business sponsored placements'));
adminRoutes.use('/business-campaigns', requireBusinessCampaignsEnabled('Admin Business campaigns'));
adminRoutes.use('/business-budgets', requireBusinessBudgetsEnabled('Admin Business budget sandbox'));
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


type AdminUsageHeartbeatRow = {
  id: string;
  userId: string | null;
  sessionId: string | null;
  clientId: string | null;
  appArea: string;
  routePattern: string;
  lastSeenAt: Date;
  user?: { id: string; email: string; profile?: { displayName?: string | null; handle?: string | null; avatarUrl?: string | null } | null } | null;
};

type AdminApiRequestMetricRow = {
  id: string;
  userId: string | null;
  sessionId: string | null;
  method: string;
  routePattern: string;
  appArea: string;
  statusCode: number;
  statusGroup: string;
  durationMs: number;
  createdAt: Date;
};

type AdminUsageWeight = 'lite' | 'medium' | 'heavy';

type AdminUsageWeightResult = {
  weight: AdminUsageWeight;
  reason: string;
};


function heartbeatIdentity(row: AdminUsageHeartbeatRow) {
  return row.userId ? `user:${row.userId}` : row.sessionId ? `session:${row.sessionId}` : row.clientId ? `client:${row.clientId}` : `heartbeat:${row.id}`;
}

function latestByIdentity(rows: AdminUsageHeartbeatRow[]) {
  const latest = new Map<string, AdminUsageHeartbeatRow>();
  for (const row of rows) {
    const key = heartbeatIdentity(row);
    const current = latest.get(key);
    if (!current || row.lastSeenAt > current.lastSeenAt) latest.set(key, row);
  }
  return Array.from(latest.values()).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

function averageDurationMs(rows: AdminApiRequestMetricRow[]) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + row.durationMs, 0) / rows.length);
}

function metricErrorCount(rows: AdminApiRequestMetricRow[]) {
  return rows.filter((row) => row.statusCode >= 400).length;
}

function calculateUsageWeight(input: { requests: number; errors: number; averageDurationMs: number; liveNow: boolean }): AdminUsageWeightResult {
  if (input.requests >= 100) return { weight: 'heavy', reason: '100+ API requests in 15 minutes' };
  if (input.errors >= 10) return { weight: 'heavy', reason: '10+ API errors in 15 minutes' };
  if (input.requests >= 25 && input.averageDurationMs >= 2000) return { weight: 'heavy', reason: 'High request volume with slow average responses' };

  if (input.requests >= 25) return { weight: 'medium', reason: '25+ API requests in 15 minutes' };
  if (input.errors >= 3) return { weight: 'medium', reason: '3+ API errors in 15 minutes' };
  if (input.requests >= 10 && input.averageDurationMs >= 1000) return { weight: 'medium', reason: 'Moderate request volume with slower responses' };
  if (input.liveNow) return { weight: 'lite', reason: 'Recent heartbeat with low API activity' };
  return { weight: 'lite', reason: 'Low recent API activity' };
}

function summarizeUsageWeights(users: { usageWeight: AdminUsageWeight }[]) {
  return users.reduce((summary, user) => {
    summary[user.usageWeight] += 1;
    return summary;
  }, { lite: 0, medium: 0, heavy: 0 } as Record<AdminUsageWeight, number>);
}

function buildApiRouteStats(rows: AdminApiRequestMetricRow[]) {
  const routeMap = new Map<string, { method: string; routePattern: string; appArea: string; requests: number; errors: number; totalDurationMs: number; maxDurationMs: number; lastSeenAt: Date | null }>();

  for (const row of rows) {
    const key = `${row.method} ${row.routePattern}`;
    const existing = routeMap.get(key) ?? { method: row.method, routePattern: row.routePattern, appArea: row.appArea, requests: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0, lastSeenAt: null };
    existing.requests += 1;
    if (row.statusCode >= 400) existing.errors += 1;
    existing.totalDurationMs += row.durationMs;
    existing.maxDurationMs = Math.max(existing.maxDurationMs, row.durationMs);
    if (!existing.lastSeenAt || row.createdAt > existing.lastSeenAt) existing.lastSeenAt = row.createdAt;
    routeMap.set(key, existing);
  }

  return Array.from(routeMap.values())
    .map((item) => ({
      method: item.method,
      routePattern: item.routePattern,
      appArea: item.appArea,
      requests: item.requests,
      errors: item.errors,
      averageDurationMs: Math.round(item.totalDurationMs / item.requests),
      maxDurationMs: item.maxDurationMs,
      lastSeenAt: item.lastSeenAt?.toISOString() ?? null,
    }))
    .sort((a, b) => b.averageDurationMs - a.averageDurationMs || b.maxDurationMs - a.maxDurationMs || b.requests - a.requests)
    .slice(0, 12);
}

function buildApiAreaStats(rows: AdminApiRequestMetricRow[]) {
  const areaMap = new Map<string, { area: string; requests: number; errors: number; totalDurationMs: number; maxDurationMs: number }>();
  for (const row of rows) {
    const existing = areaMap.get(row.appArea) ?? { area: row.appArea, requests: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
    existing.requests += 1;
    if (row.statusCode >= 400) existing.errors += 1;
    existing.totalDurationMs += row.durationMs;
    existing.maxDurationMs = Math.max(existing.maxDurationMs, row.durationMs);
    areaMap.set(row.appArea, existing);
  }

  return Array.from(areaMap.values())
    .map((item) => ({
      area: item.area,
      requests: item.requests,
      errors: item.errors,
      averageDurationMs: Math.round(item.totalDurationMs / item.requests),
      maxDurationMs: item.maxDurationMs,
    }))
    .sort((a, b) => b.requests - a.requests || b.errors - a.errors);
}

adminRoutes.get('/usage', asyncRoute(async (_req, res) => {
  const usageHeartbeatClient = (prisma as any).usageHeartbeat as {
    findMany?: (args: unknown) => Promise<AdminUsageHeartbeatRow[]>;
    deleteMany?: (args: unknown) => Promise<unknown>;
  } | undefined;
  const apiRequestMetricClient = (prisma as any).apiRequestMetric as {
    findMany?: (args: unknown) => Promise<AdminApiRequestMetricRow[]>;
    deleteMany?: (args: unknown) => Promise<unknown>;
  } | undefined;

  const now = new Date();
  const fiveMinutesAgo = usageMonitoringWindowStart(now, USAGE_LIVE_WINDOW_MINUTES);
  const fifteenMinutesAgo = usageMonitoringWindowStart(now, USAGE_ACTIVITY_WINDOW_MINUTES);
  const [cleanup, serverHealth] = await Promise.all([
    cleanupUsageMonitoringData(prisma, now),
    buildAdminServerHealth(prisma),
  ]);

  const rows = usageHeartbeatClient?.findMany ? await usageHeartbeatClient.findMany({
    where: { lastSeenAt: { gte: fifteenMinutesAgo } },
    orderBy: { lastSeenAt: 'desc' },
    take: 500,
    include: { user: { select: { id: true, email: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } } },
  }) : [];

  const metricRows = apiRequestMetricClient?.findMany ? await apiRequestMetricClient.findMany({
    where: { createdAt: { gte: fifteenMinutesAgo } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  }) : [];

  const latestRows = latestByIdentity(rows);
  const liveRows = latestRows.filter((row) => row.lastSeenAt >= fiveMinutesAgo);
  const activeUsers5m = new Set(liveRows.filter((row) => row.userId).map((row) => row.userId)).size;
  const activeUsers15m = new Set(latestRows.filter((row) => row.userId).map((row) => row.userId)).size;
  const activeGuests5m = liveRows.filter((row) => !row.userId).length;
  const activeSessions15m = latestRows.length;

  const metricsByUserId = new Map<string, AdminApiRequestMetricRow[]>();
  for (const metric of metricRows) {
    if (!metric.userId) continue;
    metricsByUserId.set(metric.userId, [...(metricsByUserId.get(metric.userId) ?? []), metric]);
  }

  const areaMap = new Map<string, { area: string; count: number; liveCount: number; lastSeenAt: Date | null }>();
  for (const row of latestRows) {
    const existing = areaMap.get(row.appArea) ?? { area: row.appArea, count: 0, liveCount: 0, lastSeenAt: null };
    existing.count += 1;
    if (row.lastSeenAt >= fiveMinutesAgo) existing.liveCount += 1;
    if (!existing.lastSeenAt || row.lastSeenAt > existing.lastSeenAt) existing.lastSeenAt = row.lastSeenAt;
    areaMap.set(row.appArea, existing);
  }

  const activeUsers = latestRows
    .filter((row) => row.userId && row.user)
    .slice(0, 80)
    .map((row) => {
      const userMetrics = metricsByUserId.get(row.user!.id) ?? [];
      const apiRequests15m = userMetrics.length;
      const apiErrors15m = metricErrorCount(userMetrics);
      const apiAverageDurationMs15m = averageDurationMs(userMetrics);
      const liveNow = row.lastSeenAt >= fiveMinutesAgo;
      const usageWeight = calculateUsageWeight({ requests: apiRequests15m, errors: apiErrors15m, averageDurationMs: apiAverageDurationMs15m, liveNow });
      return {
        userId: row.user!.id,
        email: row.user!.email,
        displayName: row.user!.profile?.displayName ?? null,
        handle: row.user!.profile?.handle ?? null,
        avatarUrl: row.user!.profile?.avatarUrl ?? null,
        currentArea: row.appArea,
        routePattern: row.routePattern,
        lastSeenAt: row.lastSeenAt.toISOString(),
        liveNow,
        apiRequests15m,
        apiErrors15m,
        apiAverageDurationMs15m,
        usageWeight: usageWeight.weight,
        usageWeightReason: usageWeight.reason,
      };
    });
  const usageWeights = summarizeUsageWeights(activeUsers);

  return res.json({
    generatedAt: now.toISOString(),
    retentionHours: USAGE_PRESENCE_RETENTION_HOURS,
    summary: {
      activeUsers5m,
      activeUsers15m,
      activeGuests5m,
      activeSessions15m,
      apiRequests15m: metricRows.length,
      apiErrors15m: metricErrorCount(metricRows),
      apiAverageDurationMs15m: averageDurationMs(metricRows),
      liteUsers15m: usageWeights.lite,
      mediumUsers15m: usageWeights.medium,
      heavyUsers15m: usageWeights.heavy,
    },
    areas: Array.from(areaMap.values()).map((item) => ({ ...item, lastSeenAt: item.lastSeenAt?.toISOString() ?? null })).sort((a, b) => b.count - a.count || b.liveCount - a.liveCount),
    serverHealth,
    apiMetrics: {
      available: Boolean(apiRequestMetricClient?.findMany),
      windowMinutes: USAGE_ACTIVITY_WINDOW_MINUTES,
      retentionHours: API_METRICS_RETENTION_HOURS,
      areaStats: buildApiAreaStats(metricRows),
      slowestRoutes: buildApiRouteStats(metricRows),
    },
    activeUsers,
    usageWeights: {
      windowMinutes: USAGE_ACTIVITY_WINDOW_MINUTES,
      rule: 'Lite/medium/heavy is based only on safe recent heartbeat, API request count, error count, and average API response time.',
      counts: usageWeights,
    },
    retention: {
      presenceHours: cleanup.presenceRetentionHours,
      apiMetricsHours: cleanup.apiMetricsRetentionHours,
      cleanup: 'Rows older than the retention windows are ignored by queries and deleted during heartbeat, API metric, or admin usage reads.',
    },
    privacy: { contentVisible: false, note: USAGE_MONITORING_PRIVACY_NOTE },
  });
}));


const adminLibraryStatusFilterSchema = z.enum(['all', 'draft', 'pending_review', 'active', 'rejected', 'archived']).optional().default('active');
const adminLibraryKindFilterSchema = z.enum(['all', 'need', 'offer']).optional().default('all');
const adminLibraryTemplateBaseSchema = z.object({
  title: z.string().trim().min(3).max(70),
  description: z.string().trim().min(10).max(500),
  itemType: z.enum(['service', 'goods', 'other']).optional().default('service'),
  languageCode: z.enum(['en', 'fr']).optional().default('en'),
  countryCode: z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toUpperCase();
    return trimmed || null;
  }, z.string().length(2).nullable().optional()),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  timing: z.string().trim().min(1).max(80).nullable().optional(),
  availability: z.string().trim().min(1).max(80).nullable().optional(),
  mode: z.enum(['remote', 'local', 'hybrid']).nullable().optional(),
  locationLabel: z.string().trim().min(1).max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional().default([]),
  includes: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  mediaIds: z.array(z.string().trim().min(1).max(128)).max(5).optional().default([]),
  status: z.enum(['draft', 'pending_review', 'active', 'rejected', 'archived']).optional().default('active'),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).optional().default(0),
});
const adminCreateLibraryTemplateSchema = adminLibraryTemplateBaseSchema.extend({
  kind: z.enum(['need', 'offer']),
  sourceType: z.enum(['hellowhen', 'business', 'brand', 'partner']).optional().default('hellowhen'),
});
const adminUpdateLibraryTemplateSchema = adminLibraryTemplateBaseSchema.partial();
const adminLibraryActionSchema = z.object({ action: z.enum(['approve', 'reject', 'hide', 'restore']), note: z.string().trim().max(1000).optional() });
const adminListLibraryQuerySchema = z.object({
  kind: adminLibraryKindFilterSchema,
  status: adminLibraryStatusFilterSchema,
  q: z.string().trim().min(1).max(120).optional(),
  languageCode: z.enum(['en', 'fr']).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  sourceType: z.enum(['all', 'hellowhen', 'business', 'brand', 'partner']).optional().default('all'),
  businessProfileId: z.string().trim().min(1).optional(),
  take: z.coerce.number().int().min(1).max(250).optional().default(100),
});

const adminLibraryBusinessProfileSelect = { id: true, displayName: true, handle: true, type: true, status: true } as const;
const adminLibraryTemplateInclude = {
  businessProfile: { select: adminLibraryBusinessProfileSelect },
  _count: { select: { createdNeeds: true, createdOffers: true } },
} as const;

async function syncAdminLibraryTemplateMedia(client: unknown, ownerId: string, mediaIds: string[] | undefined, entityId: string) {
  const selectedIds = Array.from(new Set(mediaIds ?? []));
  const mediaClient = (client as { mediaAsset: typeof prisma.mediaAsset }).mediaAsset;

  const [selectedMedia, existingMedia] = await Promise.all([
    selectedIds.length ? mediaClient.findMany({ where: { id: { in: selectedIds }, ownerId, status: 'active' } }) : Promise.resolve([]),
    mediaClient.findMany({ where: { entityType: 'inventory_template', entityId, status: { not: 'removed' } }, select: { id: true } }),
  ]);

  if (selectedMedia.length !== selectedIds.length) {
    throw Object.assign(new Error('One or more selected images could not be attached. Upload the images again and retry.'), { statusCode: 400, code: 'invalid_media_ids', publicMessage: 'One or more selected images could not be attached. Upload the images again and retry.' });
  }

  const attachedElsewhere = selectedMedia.find((item) => item.entityType && item.entityId && (item.entityType !== 'inventory_template' || item.entityId !== entityId));
  if (attachedElsewhere) {
    throw Object.assign(new Error('One or more selected images already belong to another item. Upload a new copy if you want to reuse it.'), { statusCode: 409, code: 'media_already_attached', publicMessage: 'One or more selected images already belong to another item. Upload a new copy if you want to reuse it.' });
  }

  if (selectedIds.length > 5) {
    throw Object.assign(new Error('You can attach up to 5 images. Remove one image before adding another.'), { statusCode: 400, code: 'too_many_images', publicMessage: 'You can attach up to 5 images. Remove one image before adding another.' });
  }

  if (selectedIds.length) {
    await mediaClient.updateMany({
      where: {
        id: { in: selectedIds },
        ownerId,
        status: { not: 'removed' },
        OR: [{ entityId: null }, { entityId }],
      },
      data: { entityType: 'inventory_template', entityId },
    });
  }

  const selectedSet = new Set(selectedIds);
  const removedIds = existingMedia.map((item) => item.id).filter((id) => !selectedSet.has(id));
  if (removedIds.length) {
    await mediaClient.updateMany({
      where: { id: { in: removedIds }, ownerId, entityType: 'inventory_template', entityId },
      data: { entityType: null, entityId: null },
    });
  }
}

function slugifyTemplateTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 54) || 'starter-template';
}

function makeAdminTemplateKey(kind: 'need' | 'offer', title: string) {
  return `admin-${kind}-${slugifyTemplateTitle(title)}-${randomUUID().slice(0, 8)}`;
}

function normalizeTemplateNullable<T extends string | null | undefined>(value: T) {
  return value === undefined ? undefined : value;
}

adminRoutes.get('/library', asyncRoute(async (req, res) => {
  const input = adminListLibraryQuerySchema.parse(req.query);
  const q = input.q?.trim();
  const templates = await prisma.inventoryTemplate.findMany({
    where: ({
      ...(input.kind !== 'all' ? { kind: input.kind } : {}),
      ...(input.status !== 'all' ? { status: input.status } : {}),
      ...(input.languageCode ? { languageCode: input.languageCode } : {}),
      ...(input.countryCode ? { countryCode: input.countryCode } : {}),
      ...(input.sourceType !== 'all' ? { sourceType: input.sourceType } : {}),
      ...(input.businessProfileId ? { businessProfileId: input.businessProfileId } : {}),
      ...(q ? {
        OR: [
          { key: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { locationLabel: { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    } as any),
    include: adminLibraryTemplateInclude,
    orderBy: [{ kind: 'asc' }, { languageCode: 'asc' }, { countryCode: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    take: input.take,
  });
  res.json({ templates: await withMedia('inventory_template', templates, 'admin') });
}));

adminRoutes.post('/library', asyncRoute(async (req, res) => {
  const input = adminCreateLibraryTemplateSchema.parse(req.body ?? {});
  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryTemplate.create({
      data: {
        key: makeAdminTemplateKey(input.kind, input.title),
        kind: input.kind,
        sourceType: input.sourceType,
        languageCode: input.languageCode,
        countryCode: input.countryCode ?? null,
        title: input.title,
        description: input.description,
        itemType: input.itemType,
        category: input.category ?? null,
        timing: input.kind === 'need' ? input.timing ?? null : null,
        availability: input.kind === 'offer' ? input.availability ?? null : null,
        mode: input.mode ?? null,
        locationLabel: input.locationLabel ?? null,
        tags: input.tags,
        includes: input.kind === 'offer' ? input.includes : [],
        status: input.status as any,
        sortOrder: input.sortOrder,
      },
      include: adminLibraryTemplateInclude,
    });
    await syncAdminLibraryTemplateMedia(tx, req.user!.id, input.mediaIds, created.id);
    await recordAdminAuditLog(tx, req.user!.id, {
      action: 'inventory_template.create',
      targetType: 'inventory_template',
      targetId: created.id,
      reason: 'Admin created starter Need/Offer library template.',
      nextValue: created,
    });
    return created;
  });
  res.status(201).json({ template: await withOneMedia('inventory_template', template, 'admin') });
}));

adminRoutes.patch('/library/:templateId', asyncRoute(async (req, res) => {
  const input = adminUpdateLibraryTemplateSchema.parse(req.body ?? {});
  const existing = await prisma.inventoryTemplate.findUnique({ where: { id: req.params.templateId }, include: adminLibraryTemplateInclude });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Starter template not found.' });

  const template = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventoryTemplate.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        itemType: input.itemType,
        languageCode: input.languageCode,
        countryCode: normalizeTemplateNullable(input.countryCode),
        category: normalizeTemplateNullable(input.category),
        timing: existing.kind === 'need' ? normalizeTemplateNullable(input.timing) : null,
        availability: existing.kind === 'offer' ? normalizeTemplateNullable(input.availability) : null,
        mode: normalizeTemplateNullable(input.mode),
        locationLabel: normalizeTemplateNullable(input.locationLabel),
        tags: input.tags,
        includes: existing.kind === 'offer' ? input.includes : [],
        status: input.status as any,
        sortOrder: input.sortOrder,
      },
      include: adminLibraryTemplateInclude,
    });
    if (input.mediaIds !== undefined) await syncAdminLibraryTemplateMedia(tx, req.user!.id, input.mediaIds, updated.id);
    await recordAdminAuditLog(tx, req.user!.id, {
      action: 'inventory_template.update',
      targetType: 'inventory_template',
      targetId: updated.id,
      reason: 'Admin updated starter Need/Offer library template.',
      previousValue: existing,
      nextValue: updated,
    });
    return updated;
  });
  res.json({ template: await withOneMedia('inventory_template', template, 'admin') });
}));

adminRoutes.patch('/library/:templateId/action', asyncRoute(async (req, res) => {
  const input = adminLibraryActionSchema.parse(req.body ?? {});
  const existing = await prisma.inventoryTemplate.findUnique({ where: { id: req.params.templateId }, include: adminLibraryTemplateInclude });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'Starter template not found.' });
  const isBusinessOwned = Boolean(existing.businessProfileId) || existing.sourceType === 'business' || existing.sourceType === 'brand' || existing.sourceType === 'partner';
  const note = input.note?.trim() ?? '';
  if ((input.action === 'approve' || input.action === 'reject' || isBusinessOwned) && note.length < 3) {
    return res.status(400).json({ error: 'review_note_required', message: 'Add a short admin review note before changing a Business library item.' });
  }

  const nextStatusByAction = {
    approve: 'active',
    reject: 'rejected',
    hide: 'archived',
    restore: 'active',
  } as const;
  const nextStatus = nextStatusByAction[input.action];
  if ((input.action === 'approve' || input.action === 'restore') && existing.businessProfileId && existing.businessProfile?.status !== 'verified') {
    return res.status(409).json({ error: 'business_profile_not_verified', message: 'Verify the Business profile before approving its library item.' });
  }

  const template = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventoryTemplate.update({
      where: { id: existing.id },
      data: { status: nextStatus as any },
      include: adminLibraryTemplateInclude,
    });
    await recordAdminAuditLog(tx, req.user!.id, {
      action: `inventory_template.${input.action}`,
      targetType: 'inventory_template',
      targetId: updated.id,
      reason: note || (input.action === 'hide' ? 'Admin hid template from public starter library.' : input.action === 'restore' ? 'Admin restored template to public starter library.' : input.action === 'approve' ? 'Admin approved Business library item.' : input.action === 'reject' ? 'Admin rejected Business library item.' : 'Admin reviewed Business library item.'),
      previousValue: { status: existing.status, sourceType: existing.sourceType, businessProfileId: existing.businessProfileId },
      nextValue: { status: updated.status, sourceType: updated.sourceType, businessProfileId: updated.businessProfileId },
      metadata: { businessOwned: isBusinessOwned, businessProfile: existing.businessProfile ?? null },
    });
    return updated;
  });
  res.json({ template: await withOneMedia('inventory_template', template, 'admin') });
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
  if (targetType === 'public_message') {
    const message = await prisma.tradePublicMessage.findUnique({ where: { id: targetId }, select: { tradeId: true } });
    return message?.tradeId ?? null;
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
  if (targetType === 'trade' || targetType === 'proposal' || targetType === 'message' || targetType === 'public_message') return 'trade_issue';
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

const adminProfessionalStatusValues = ['none', 'pending_verification', 'verified', 'rejected', 'suspended'] as const;
const adminSubscriptionTierValues = ['free', 'plus_later', 'pro', 'business_later'] as const;
const adminSubscriptionStatusValues = ['none', 'trialing', 'active', 'past_due', 'canceled', 'expired'] as const;
const adminIdentityVerificationProviderValues = ['none', 'manual', 'stripe_identity', 'airwallex'] as const;
const adminIdentityVerificationStatusValues = ['none', 'pending', 'verified', 'rejected', 'expired', 'cancelled'] as const;
const adminProfessionalStatusFilters = ['all', ...adminProfessionalStatusValues] as const;
const adminSubscriptionTierFilters = ['all', ...adminSubscriptionTierValues] as const;
const adminSubscriptionStatusFilters = ['all', ...adminSubscriptionStatusValues] as const;
const adminIdentityVerificationStatusFilters = ['all', ...adminIdentityVerificationStatusValues] as const;

const adminProListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  professionalStatus: z.enum(adminProfessionalStatusFilters).optional().default('all'),
  subscriptionTier: z.enum(adminSubscriptionTierFilters).optional().default('all'),
  subscriptionStatus: z.enum(adminSubscriptionStatusFilters).optional().default('all'),
  identityVerificationStatus: z.enum(adminIdentityVerificationStatusFilters).optional().default('all'),
  take: z.coerce.number().int().min(1).max(250).optional().default(100),
});

const adminProDateField = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }
  return value;
}, z.date().nullable().optional());

const adminProUpdateSchema = z.object({
  professionalStatus: z.enum(adminProfessionalStatusValues).optional(),
  subscriptionTier: z.enum(adminSubscriptionTierValues).optional(),
  subscriptionStatus: z.enum(adminSubscriptionStatusValues).optional(),
  identityVerificationProvider: z.enum(adminIdentityVerificationProviderValues).optional(),
  identityVerificationStatus: z.enum(adminIdentityVerificationStatusValues).optional(),
  trialStartedAt: adminProDateField,
  trialEndsAt: adminProDateField,
  currentPeriodStartedAt: adminProDateField,
  currentPeriodEndsAt: adminProDateField,
  expiresAt: adminProDateField,
  verificationExpiresAt: adminProDateField,
  professionalStatusNote: z.string().trim().max(500).nullable().optional(),
  subscriptionAdminNote: z.string().trim().max(500).nullable().optional(),
  identityAdminNote: z.string().trim().max(500).nullable().optional(),
  rejectionReason: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().min(3).max(500),
});

const adminProUserSelect = {
  id: true,
  email: true,
  role: true,
  trustTier: true,
  accountKind: true,
  professionalStatus: true,
  professionalStatusUpdatedAt: true,
  subscriptionTier: true,
  subscriptionStatus: true,
  subscriptionStatusUpdatedAt: true,
  emailVerifiedAt: true,
  ageConfirmedAt: true,
  createdAt: true,
  profile: { select: { displayName: true, handle: true, avatarUrl: true } },
  professionalProfile: true,
  subscriptionState: true,
  identityVerificationState: true,
} as const;

function adminProConfigSnapshot() {
  return {
    subscriptionsEnabled: env.subscriptionsEnabled,
    proAccountsEnabled: env.proAccountsEnabled,
    proAccountsVisible: env.proAccountsVisible,
    proTrialsEnabled: env.proTrialsEnabled,
    identityVerificationEnabled: env.identityVerificationEnabled,
    monthlyPriceCents: env.proMonthlyPriceCents,
    monthlyPriceCurrency: env.proMonthlyPriceCurrency,
    trialDays: env.proTrialDays,
    providerConnected: false,
    publicUpgradeVisible: false,
  };
}

function adminProAccessBlockers(user: { professionalStatus: string; subscriptionTier: string; subscriptionStatus: string }) {
  const blockers: string[] = [];
  if (user.professionalStatus !== 'verified') blockers.push('identity_not_verified');
  if (user.subscriptionTier !== 'pro') blockers.push('not_on_pro_tier');
  if (user.subscriptionStatus !== 'trialing' && user.subscriptionStatus !== 'active') blockers.push('subscription_not_active');
  return blockers;
}

function normalizeAdminProUser(user: any) {
  const accessInput = {
    professionalStatus: user.professionalStatus,
    subscriptionTier: user.subscriptionTier,
    subscriptionStatus: user.subscriptionStatus,
  };
  const access = hasProAccess(accessInput);
  return {
    ...user,
    access: {
      hasProAccess: access,
      blockers: access ? [] : adminProAccessBlockers(user),
    },
  };
}

function adminProWhere(input: z.infer<typeof adminProListQuerySchema>) {
  const where: Record<string, unknown> = {};
  if (input.professionalStatus !== 'all') where.professionalStatus = input.professionalStatus;
  if (input.subscriptionTier !== 'all') where.subscriptionTier = input.subscriptionTier;
  if (input.subscriptionStatus !== 'all') where.subscriptionStatus = input.subscriptionStatus;
  if (input.identityVerificationStatus !== 'all') where.identityVerificationState = { is: { status: input.identityVerificationStatus } };
  if (input.q) {
    where.OR = [
      { email: { contains: input.q, mode: 'insensitive' as const } },
      { profile: { is: { displayName: { contains: input.q, mode: 'insensitive' as const } } } },
      { profile: { is: { handle: { contains: input.q, mode: 'insensitive' as const } } } },
      { professionalProfile: { is: { displayName: { contains: input.q, mode: 'insensitive' as const } } } },
      { professionalProfile: { is: { headline: { contains: input.q, mode: 'insensitive' as const } } } },
      { professionalProfile: { is: { category: { contains: input.q, mode: 'insensitive' as const } } } },
    ];
  }
  return where;
}

async function loadAdminProUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: adminProUserSelect });
  return user ? normalizeAdminProUser(user) : null;
}

function maybeDateValue(value: Date | null | undefined) {
  return value === undefined ? undefined : value;
}

function identityStatusTimestampData(status: string | undefined, now: Date, existing?: any) {
  if (!status) return {};
  if (status === 'pending') return { submittedAt: existing?.submittedAt ?? now, verifiedAt: null, rejectedAt: null };
  if (status === 'verified') return { verifiedAt: now, rejectedAt: null };
  if (status === 'rejected') return { rejectedAt: now, verifiedAt: null };
  return {};
}

adminRoutes.get('/pro/users', asyncRoute(async (req, res) => {
  const input = adminProListQuerySchema.parse(req.query);
  const where = adminProWhere(input);
  const users = await prisma.user.findMany({
    where: where as any,
    select: adminProUserSelect,
    orderBy: [{ professionalStatusUpdatedAt: 'desc' }, { subscriptionStatusUpdatedAt: 'desc' }, { createdAt: 'desc' }],
    take: input.take,
  });
  const [verifiedProfessionals, activeProUsers, trialingProUsers, pendingIdentityReviews] = await Promise.all([
    prisma.user.count({ where: { professionalStatus: 'verified' } }),
    prisma.user.count({ where: { professionalStatus: 'verified', subscriptionTier: 'pro', subscriptionStatus: 'active' } }),
    prisma.user.count({ where: { professionalStatus: 'verified', subscriptionTier: 'pro', subscriptionStatus: 'trialing' } }),
    prisma.identityVerificationState.count({ where: { status: 'pending' } }),
  ]);
  res.json({
    config: adminProConfigSnapshot(),
    summary: { verifiedProfessionals, activeProUsers, trialingProUsers, pendingIdentityReviews },
    users: users.map(normalizeAdminProUser),
  });
}));

adminRoutes.patch('/pro/users/:userId', asyncRoute(async (req, res) => {
  const input = adminProUpdateSchema.parse(req.body ?? {});
  const existing = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: adminProUserSelect,
  });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const now = new Date();
  const professionalTouched = input.professionalStatus !== undefined || input.professionalStatusNote !== undefined;
  const subscriptionTouched = input.subscriptionTier !== undefined
    || input.subscriptionStatus !== undefined
    || input.trialStartedAt !== undefined
    || input.trialEndsAt !== undefined
    || input.currentPeriodStartedAt !== undefined
    || input.currentPeriodEndsAt !== undefined
    || input.expiresAt !== undefined
    || input.subscriptionAdminNote !== undefined;
  const identityTouched = input.identityVerificationProvider !== undefined
    || input.identityVerificationStatus !== undefined
    || input.verificationExpiresAt !== undefined
    || input.identityAdminNote !== undefined
    || input.rejectionReason !== undefined;

  if (!professionalTouched && !subscriptionTouched && !identityTouched) {
    return res.status(400).json({ error: 'no_changes', message: 'Choose at least one Pro, subscription, or identity field to update.' });
  }

  await prisma.$transaction(async (tx: any) => {
    const nextUserData: Record<string, unknown> = {};
    if (input.professionalStatus !== undefined) {
      nextUserData.professionalStatus = input.professionalStatus;
      nextUserData.professionalStatusUpdatedAt = now;
    }
    if (input.subscriptionTier !== undefined) {
      nextUserData.subscriptionTier = input.subscriptionTier;
      nextUserData.subscriptionStatusUpdatedAt = now;
    }
    if (input.subscriptionStatus !== undefined) {
      nextUserData.subscriptionStatus = input.subscriptionStatus;
      nextUserData.subscriptionStatusUpdatedAt = now;
    }
    if (Object.keys(nextUserData).length) {
      await tx.user.update({ where: { id: existing.id }, data: nextUserData });
    }

    if (professionalTouched) {
      const nextProfessionalStatus = input.professionalStatus ?? existing.professionalProfile?.status ?? existing.professionalStatus;
      await tx.professionalProfile.upsert({
        where: { userId: existing.id },
        create: {
          userId: existing.id,
          displayName: existing.profile?.displayName ?? null,
          status: nextProfessionalStatus,
          statusNote: input.professionalStatusNote ?? null,
          reviewedAt: now,
          reviewedById: req.user!.id,
        },
        update: {
          ...(input.professionalStatus !== undefined ? { status: input.professionalStatus } : {}),
          ...(input.professionalStatusNote !== undefined ? { statusNote: input.professionalStatusNote } : {}),
          reviewedAt: now,
          reviewedById: req.user!.id,
        },
      });
    }

    if (subscriptionTouched) {
      const nextTier = input.subscriptionTier ?? existing.subscriptionState?.tier ?? existing.subscriptionTier;
      const nextStatus = input.subscriptionStatus ?? existing.subscriptionState?.status ?? existing.subscriptionStatus;
      const data = {
        tier: nextTier,
        status: nextStatus,
        provider: existing.subscriptionState?.provider ?? 'manual_admin',
        ...(input.trialStartedAt !== undefined ? { trialStartedAt: maybeDateValue(input.trialStartedAt) } : {}),
        ...(input.trialEndsAt !== undefined ? { trialEndsAt: maybeDateValue(input.trialEndsAt) } : {}),
        ...(input.currentPeriodStartedAt !== undefined ? { currentPeriodStartedAt: maybeDateValue(input.currentPeriodStartedAt) } : {}),
        ...(input.currentPeriodEndsAt !== undefined ? { currentPeriodEndsAt: maybeDateValue(input.currentPeriodEndsAt) } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: maybeDateValue(input.expiresAt) } : {}),
        ...(input.subscriptionAdminNote !== undefined ? { adminNote: input.subscriptionAdminNote } : {}),
        lastSyncedAt: now,
      };
      await tx.subscriptionState.upsert({
        where: { userId: existing.id },
        create: { userId: existing.id, ...data },
        update: data,
      });
    }

    if (identityTouched) {
      const nextProvider = input.identityVerificationProvider ?? existing.identityVerificationState?.provider ?? 'manual';
      const nextStatus = input.identityVerificationStatus ?? existing.identityVerificationState?.status ?? 'none';
      const timestampData = identityStatusTimestampData(input.identityVerificationStatus, now, existing.identityVerificationState);
      const data = {
        provider: nextProvider,
        status: nextStatus,
        ...timestampData,
        ...(input.verificationExpiresAt !== undefined ? { expiresAt: maybeDateValue(input.verificationExpiresAt) } : {}),
        ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
        ...(input.identityAdminNote !== undefined ? { adminNote: input.identityAdminNote } : {}),
        reviewedAt: now,
        reviewedById: req.user!.id,
      };
      await tx.identityVerificationState.upsert({
        where: { userId: existing.id },
        create: { userId: existing.id, ...data },
        update: data,
      });
    }

    await recordAdminAuditLog(tx, req.user!.id, {
      action: 'pro.admin_update',
      targetType: 'user',
      targetId: existing.id,
      reason: input.note,
      previousValue: normalizeAdminProUser(existing),
      nextValue: {
        professionalStatus: input.professionalStatus ?? existing.professionalStatus,
        subscriptionTier: input.subscriptionTier ?? existing.subscriptionTier,
        subscriptionStatus: input.subscriptionStatus ?? existing.subscriptionStatus,
        identityVerificationStatus: input.identityVerificationStatus ?? existing.identityVerificationState?.status ?? 'none',
      },
      metadata: { providerConnected: false, publicUpgradeVisible: false, manualAdminOnly: true },
    });
  });

  const user = await loadAdminProUser(existing.id);
  res.json({ user, config: adminProConfigSnapshot() });
}));


adminRoutes.get('/users', asyncRoute(async (req, res) => {
  const userId = toStringParam(req.query.userId);
  const q = toStringParam(req.query.q);
  const rawTrustTier = toStringParam(req.query.trustTier);
  const trustTier = rawTrustTier && ['new', 'email_verified', 'stripe_verified', 'trusted', 'restricted'].includes(rawTrustTier) ? rawTrustTier as 'new' | 'email_verified' | 'stripe_verified' | 'trusted' | 'restricted' : undefined;
  const rawRole = toStringParam(req.query.role);
  const role = rawRole && ['user', 'admin'].includes(rawRole) ? rawRole as 'user' | 'admin' : undefined;
  const take = userId ? 1 : clampTake(req.query.take, 100, 250);
  const users = await prisma.user.findMany({
    where: userId ? { id: userId } : {
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
const needStatusValues = ['draft', 'pending_review', 'active', 'rejected', 'fulfilled', 'closed', 'expired'] as const;
const offerStatusValues = ['draft', 'pending_review', 'active', 'rejected', 'accepted', 'closed', 'expired'] as const;

type AdminContentType = 'trade' | 'need' | 'offer';
type AdminContentItem = {
  id: string;
  type: AdminContentType;
  ownerId: string;
  businessProfileId?: string | null;
  businessProfile?: unknown;
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
  if (item.businessProfileId && item.businessProfile?.status !== 'verified') blockers.push(`business status: ${item.businessProfile?.status ?? 'missing'}`);
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
    businessProfileId: trade.businessProfileId ?? null,
    businessProfile: trade.businessProfile ?? null,
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
    businessProfileId: need.businessProfileId ?? null,
    businessProfile: need.businessProfile ?? null,
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
    businessProfileId: offer.businessProfileId ?? null,
    businessProfile: offer.businessProfile ?? null,
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
    const trade = await prisma.trade.findUnique({ where: { id }, include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, need: true, offer: true, _count: { select: { proposals: true } } } });
    return trade ? (await hydrateAdminContent([await toAdminTradeItem(trade)]))[0] : null;
  }
  if (type === 'need') {
    const need = await prisma.need.findUnique({ where: { id }, include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, _count: { select: { trades: true } } } });
    return need ? (await hydrateAdminContent([toAdminNeedItem(need)]))[0] : null;
  }
  const offer = await prisma.offer.findUnique({ where: { id }, include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, _count: { select: { trades: true } } } });
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
      ...(input.businessProfileId ? { businessProfileId: input.businessProfileId } : {}),
      ...(isOneOf(input.status, tradeStatusValues) ? { status: input.status } : {}),
      ...contentSearchWhere(input.q),
    };
    const trades = await prisma.trade.findMany({
      where,
      include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, need: true, offer: true, _count: { select: { proposals: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    for (const trade of trades) content.push(await toAdminTradeItem(trade));
  }

  if (types.includes('need')) {
    const where = {
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      ...(input.businessProfileId ? { businessProfileId: input.businessProfileId } : {}),
      ...(isOneOf(input.status, needStatusValues) ? { status: input.status } : {}),
      ...contentSearchWhere(input.q),
    };
    const needs = await prisma.need.findMany({
      where,
      include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, _count: { select: { trades: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    content.push(...needs.map(toAdminNeedItem));
  }

  if (types.includes('offer')) {
    const where = {
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      ...(input.businessProfileId ? { businessProfileId: input.businessProfileId } : {}),
      ...(isOneOf(input.status, offerStatusValues) ? { status: input.status } : {}),
      ...contentSearchWhere(input.q),
    };
    const offers = await prisma.offer.findMany({
      where,
      include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, _count: { select: { trades: true } } },
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
  if (['approve', 'reject', 'hide', 'restore', 'close'].includes(input.action) && !note) {
    return res.status(400).json({ error: 'admin_note_required', message: 'Add an internal note before approving, rejecting, hiding, restoring, or closing content.' });
  }

  const existing = await loadAdminContentItem(type, contentId);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const isBusinessOwned = Boolean(existing.businessProfileId);
  if ((input.action === 'approve' || input.action === 'reject') && (type === 'trade' || !isBusinessOwned)) {
    return res.status(400).json({ error: 'business_content_action_required', message: 'Approve/reject is only available for Business-owned Needs and Offers.' });
  }
  if ((input.action === 'approve' || input.action === 'restore') && isBusinessOwned && (existing.businessProfile as any)?.status !== 'verified') {
    return res.status(409).json({ error: 'business_profile_not_verified', message: 'Verify the Business profile before approving or restoring its Needs/Offers.' });
  }

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
      const data = input.action === 'approve' || input.action === 'restore'
        ? { status: 'active' as const }
        : input.action === 'reject'
          ? { status: 'rejected' as const }
          : { status: 'closed' as const };
      await prisma.need.update({ where: { id: contentId }, data });
    }
  } else {
    if (input.action !== 'mark_reviewed') {
      const data = input.action === 'approve' || input.action === 'restore'
        ? { status: 'active' as const }
        : input.action === 'reject'
          ? { status: 'rejected' as const }
          : { status: 'closed' as const };
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
    metadata: { ownerId: existing.ownerId, title: existing.title, businessOwned: isBusinessOwned, businessProfile: existing.businessProfile ?? null },
  });
  res.json({ item: updated });
}));


type AdminContentClassificationTargetType = 'need' | 'offer' | 'trade' | 'profile' | 'business_template' | 'business_need' | 'business_offer' | 'business_campaign';


type ContentClassificationRow = {
  id: string;
  targetType: AdminContentClassificationTargetType;
  targetId: string;
  source: string;
  status: string;
  userCategory?: string | null;
  systemCategory?: string | null;
  categoryConfidence?: number | null;
  categoryMismatch: boolean;
  suggestedTags: string[];
  suggestedNewTags: string[];
  safetyCategory: string;
  safetySeverity: string;
  adultRelated: boolean;
  childSafe: boolean;
  spamOrScamRisk: boolean;
  regulatedRisk: boolean;
  suggestedAction: string;
  reason?: string | null;
  reviewedById?: string | null;
  reviewedBy?: unknown;
  reviewedAt?: Date | null;
  adminNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ContentPlacementSignalRow = {
  id: string;
  targetType: AdminContentClassificationTargetType;
  targetId: string;
  source: string;
  status: string;
  sourceClassificationId?: string | null;
  category?: string | null;
  tags: string[];
  suggestedNewTags: string[];
  safetyCategory: string;
  safetySeverity: string;
  adultRelated: boolean;
  childSafe: boolean;
  spamOrScamRisk: boolean;
  regulatedRisk: boolean;
  contextualEligible: boolean;
  businessPlacementEligible: boolean;
  adsPlacementEligible: boolean;
  surfaces: string[];
  reason?: string | null;
  approvedById?: string | null;
  approvedBy?: unknown;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AdminContentIntelligenceTarget = {
  id: string;
  type: AdminContentClassificationTargetType;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  category?: string | null;
  ownerId?: string | null;
  owner?: unknown;
  businessProfileId?: string | null;
  businessProfile?: unknown;
  href?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

function labelContentClassificationTarget(type: AdminContentClassificationTargetType) {
  if (type === 'business_template') return 'business template';
  if (type === 'business_need') return 'business need';
  if (type === 'business_offer') return 'business offer';
  if (type === 'business_campaign') return 'business campaign';
  return type;
}

function classificationTargetHref(type: AdminContentClassificationTargetType, id: string) {
  if (type === 'trade') return `/trades/${id}`;
  if (type === 'need' || type === 'business_need') return `/needs/${id}`;
  if (type === 'offer' || type === 'business_offer') return `/offers/${id}`;
  return null;
}

function contentClassificationQueueWhere(input: any) {
  const where: any = {};
  if (input.targetType !== 'all') where.targetType = input.targetType;
  if (input.source !== 'all') where.source = input.source;
  if (input.status !== 'all') where.status = input.status;
  if (input.safetyCategory !== 'all') where.safetyCategory = input.safetyCategory;
  if (input.safetySeverity !== 'all') where.safetySeverity = input.safetySeverity;
  if (input.suggestedAction !== 'all') where.suggestedAction = input.suggestedAction;
  if (input.systemCategory !== 'all') where.systemCategory = input.systemCategory;
  if (input.categoryMismatch !== 'all') where.categoryMismatch = input.categoryMismatch === 'true';
  if (input.q) {
    where.OR = [
      { targetId: { contains: input.q, mode: 'insensitive' } },
      { userCategory: { contains: input.q, mode: 'insensitive' } },
      { reason: { contains: input.q, mode: 'insensitive' } },
      { adminNote: { contains: input.q, mode: 'insensitive' } },
    ];
  }
  return where;
}

function contentClassificationSnapshot(row: ContentClassificationRow | null | undefined) {
  if (!row) return null;
  return {
    status: row.status,
    source: row.source,
    targetType: row.targetType,
    targetId: row.targetId,
    userCategory: row.userCategory ?? null,
    systemCategory: row.systemCategory ?? null,
    categoryConfidence: row.categoryConfidence ?? null,
    categoryMismatch: row.categoryMismatch,
    suggestedTags: row.suggestedTags,
    suggestedNewTags: row.suggestedNewTags,
    safetyCategory: row.safetyCategory,
    safetySeverity: row.safetySeverity,
    adultRelated: row.adultRelated,
    childSafe: row.childSafe,
    spamOrScamRisk: row.spamOrScamRisk,
    regulatedRisk: row.regulatedRisk,
    suggestedAction: row.suggestedAction,
    adminNote: row.adminNote ?? null,
    reviewedById: row.reviewedById ?? null,
    reviewedAt: row.reviewedAt ?? null,
  };
}

function contentPlacementSignalSnapshot(row: ContentPlacementSignalRow | null | undefined) {
  if (!row) return null;
  return {
    status: row.status,
    source: row.source,
    targetType: row.targetType,
    targetId: row.targetId,
    sourceClassificationId: row.sourceClassificationId ?? null,
    category: row.category ?? null,
    tags: row.tags,
    suggestedNewTags: row.suggestedNewTags,
    safetyCategory: row.safetyCategory,
    safetySeverity: row.safetySeverity,
    adultRelated: row.adultRelated,
    childSafe: row.childSafe,
    spamOrScamRisk: row.spamOrScamRisk,
    regulatedRisk: row.regulatedRisk,
    contextualEligible: row.contextualEligible,
    businessPlacementEligible: row.businessPlacementEligible,
    adsPlacementEligible: row.adsPlacementEligible,
    surfaces: row.surfaces,
    reason: row.reason ?? null,
    approvedById: row.approvedById ?? null,
    approvedAt: row.approvedAt ?? null,
  };
}

function buildContentIntelligenceTarget(type: AdminContentClassificationTargetType, item: any): AdminContentIntelligenceTarget | null {
  if (!item) return null;
  if (type === 'need' || type === 'business_need') {
    return {
      id: item.id,
      type,
      title: item.title,
      description: item.description,
      status: item.status,
      category: item.category ?? null,
      ownerId: item.ownerId ?? null,
      owner: item.owner ?? null,
      businessProfileId: item.businessProfileId ?? null,
      businessProfile: item.businessProfile ?? null,
      href: classificationTargetHref(type, item.id),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  if (type === 'offer' || type === 'business_offer') {
    return {
      id: item.id,
      type,
      title: item.title,
      description: item.description,
      status: item.status,
      category: item.category ?? null,
      ownerId: item.ownerId ?? null,
      owner: item.owner ?? null,
      businessProfileId: item.businessProfileId ?? null,
      businessProfile: item.businessProfile ?? null,
      href: classificationTargetHref(type, item.id),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  if (type === 'trade') {
    return {
      id: item.id,
      type,
      title: item.title,
      description: item.description,
      status: item.status,
      category: item.need?.category ?? item.offer?.category ?? null,
      ownerId: item.ownerId ?? null,
      owner: item.owner ?? null,
      businessProfileId: item.businessProfileId ?? null,
      businessProfile: item.businessProfile ?? null,
      href: classificationTargetHref(type, item.id),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  if (type === 'profile') {
    return {
      id: item.id,
      type,
      title: item.displayName || item.handle || item.user?.email || 'Profile',
      description: item.bio ?? null,
      status: item.user?.trustTier ?? null,
      category: item.countryCode ?? null,
      ownerId: item.userId ?? null,
      owner: item.user ?? null,
      href: null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  if (type === 'business_template') {
    return {
      id: item.id,
      type,
      title: item.title,
      description: item.description,
      status: item.status,
      category: item.category ?? null,
      ownerId: item.businessProfile?.ownerId ?? null,
      owner: item.businessProfile?.owner ?? null,
      businessProfileId: item.businessProfileId ?? null,
      businessProfile: item.businessProfile ?? null,
      href: null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  if (type === 'business_campaign') {
    return {
      id: item.id,
      type,
      title: item.title,
      description: item.description,
      status: item.status,
      category: item.opportunityType ?? null,
      ownerId: item.createdById ?? item.businessProfile?.ownerId ?? null,
      owner: item.createdBy ?? item.businessProfile?.owner ?? null,
      businessProfileId: item.businessProfileId ?? null,
      businessProfile: item.businessProfile ?? null,
      href: null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  return null;
}

async function hydrateContentClassificationTargets(rows: ContentClassificationRow[]) {
  const targets = new Map<string, AdminContentIntelligenceTarget | null>();
  const idsByType = new Map<AdminContentClassificationTargetType, string[]>();
  for (const row of rows) {
    const list = idsByType.get(row.targetType) ?? [];
    list.push(row.targetId);
    idsByType.set(row.targetType, list);
  }

  const needIds = [...new Set([...(idsByType.get('need') ?? []), ...(idsByType.get('business_need') ?? [])])];
  const offerIds = [...new Set([...(idsByType.get('offer') ?? []), ...(idsByType.get('business_offer') ?? [])])];
  const tradeIds = [...new Set(idsByType.get('trade') ?? [])];
  const profileIds = [...new Set(idsByType.get('profile') ?? [])];
  const templateIds = [...new Set(idsByType.get('business_template') ?? [])];
  const campaignIds = [...new Set(idsByType.get('business_campaign') ?? [])];

  const [needs, offers, trades, profiles, templates, campaigns] = await Promise.all([
    needIds.length ? prisma.need.findMany({ where: { id: { in: needIds } }, include: { owner: { select: adminContentUserSelect }, businessProfile: { select: { ...adminLibraryBusinessProfileSelect, owner: { select: adminContentUserSelect } } } } }) : [],
    offerIds.length ? prisma.offer.findMany({ where: { id: { in: offerIds } }, include: { owner: { select: adminContentUserSelect }, businessProfile: { select: { ...adminLibraryBusinessProfileSelect, owner: { select: adminContentUserSelect } } } } }) : [],
    tradeIds.length ? prisma.trade.findMany({ where: { id: { in: tradeIds } }, include: { owner: { select: adminContentUserSelect }, businessProfile: { select: { ...adminLibraryBusinessProfileSelect, owner: { select: adminContentUserSelect } } }, need: true, offer: true } }) : [],
    profileIds.length ? prisma.profile.findMany({ where: { id: { in: profileIds } }, include: { user: { select: adminContentUserSelect } } }) : [],
    templateIds.length ? prisma.inventoryTemplate.findMany({ where: { id: { in: templateIds } }, include: { businessProfile: { select: { ...adminLibraryBusinessProfileSelect, owner: { select: adminContentUserSelect } } } } }) : [],
    campaignIds.length ? prisma.businessCampaign.findMany({ where: { id: { in: campaignIds } }, include: { createdBy: { select: adminContentUserSelect }, businessProfile: { select: { ...adminLibraryBusinessProfileSelect, owner: { select: adminContentUserSelect } } } } }) : [],
  ]);

  for (const item of needs) {
    targets.set(`need:${item.id}`, buildContentIntelligenceTarget('need', item));
    targets.set(`business_need:${item.id}`, buildContentIntelligenceTarget('business_need', item));
  }
  for (const item of offers) {
    targets.set(`offer:${item.id}`, buildContentIntelligenceTarget('offer', item));
    targets.set(`business_offer:${item.id}`, buildContentIntelligenceTarget('business_offer', item));
  }
  for (const item of trades) targets.set(`trade:${item.id}`, buildContentIntelligenceTarget('trade', item));
  for (const item of profiles) targets.set(`profile:${item.id}`, buildContentIntelligenceTarget('profile', item));
  for (const item of templates) targets.set(`business_template:${item.id}`, buildContentIntelligenceTarget('business_template', item));
  for (const item of campaigns) targets.set(`business_campaign:${item.id}`, buildContentIntelligenceTarget('business_campaign', item));

  const signalWhere = rows.map((row) => ({ targetType: row.targetType, targetId: row.targetId }));
  const signalRows = signalWhere.length ? await (prisma as any).contentPlacementSignal.findMany({
    where: { OR: signalWhere },
    include: { approvedBy: { select: adminContentUserSelect } },
  }) as ContentPlacementSignalRow[] : [];
  const signals = new Map(signalRows.map((signal) => [`${signal.targetType}:${signal.targetId}`, signal]));

  return rows.map((row) => ({
    ...row,
    target: targets.get(`${row.targetType}:${row.targetId}`) ?? null,
    placementSignal: signals.get(`${row.targetType}:${row.targetId}`) ?? null,
  }));
}

function contentIntelligenceFlags() {
  const aiStatus = buildAiSuggestionProviderStatus();
  const placementStatus = buildContentPlacementSignalStatus();
  return {
    contentIntelligenceEnabled: env.contentIntelligenceEnabled,
    contentClassificationEnabled: env.contentClassificationEnabled,
    aiModerationSuggestionsEnabled: env.aiModerationSuggestionsEnabled,
    autoModerationActionsEnabled: env.autoModerationActionsEnabled,
    aiProvider: aiStatus.provider,
    aiAdminOnlySuggestionsAvailable: aiStatus.configured,
    aiAdminOnlySuggestionsDisabledReason: aiStatus.configured ? null : aiStatus.disabledReason,
    contentPlacementSignalsEnabled: env.contentPlacementSignalsEnabled,
    businessContextualSignalsEnabled: env.businessContextualSignalsEnabled,
    contextualAdSignalsEnabled: env.contextualAdSignalsEnabled,
    placementSignalsAvailable: placementStatus.configured,
    placementSignalsDisabledReason: placementStatus.configured ? null : placementStatus.disabledReason,
  };
}

async function buildContentClassificationSummary() {
  const client = (prisma as any).contentClassification;
  const unreviewedWhere = { status: { in: ['pending', 'completed', 'failed'] } };
  const [total, needsReview, highRisk, categoryMismatch, adultOrSexual, spamOrScam, regulated, failed] = await Promise.all([
    client.count(),
    client.count({ where: { ...unreviewedWhere, OR: [{ suggestedAction: { in: ['review', 'hide'] } }, { categoryMismatch: true }] } }),
    client.count({ where: { ...unreviewedWhere, safetySeverity: { in: ['high', 'critical'] } } }),
    client.count({ where: { ...unreviewedWhere, categoryMismatch: true } }),
    client.count({ where: { ...unreviewedWhere, safetyCategory: { in: ['adult', 'sexual'] } } }),
    client.count({ where: { ...unreviewedWhere, spamOrScamRisk: true } }),
    client.count({ where: { ...unreviewedWhere, regulatedRisk: true } }),
    client.count({ where: { status: 'failed' } }),
  ]);
  return { total, needsReview, highRisk, categoryMismatch, adultOrSexual, spamOrScam, regulated, failed };
}

adminRoutes.get('/content-intelligence', asyncRoute(async (req, res) => {
  const input = adminListContentClassificationsQuerySchema.parse(req.query);
  const rows = await (prisma as any).contentClassification.findMany({
    where: contentClassificationQueueWhere(input),
    include: { reviewedBy: { select: adminContentUserSelect } },
    orderBy: { updatedAt: 'desc' },
    take: input.take,
  }) as ContentClassificationRow[];
  const [classifications, summary] = await Promise.all([
    hydrateContentClassificationTargets(rows),
    buildContentClassificationSummary(),
  ]);
  res.json({ flags: contentIntelligenceFlags(), summary, classifications });
}));

adminRoutes.patch('/content-intelligence/:classificationId/action', asyncRoute(async (req, res) => {
  const input = adminContentClassificationActionRequestSchema.parse(req.body ?? {});
  const note = input.adminNote?.trim();
  if (input.action === 'override' && !note) {
    return res.status(400).json({ error: 'admin_note_required', message: 'Add an internal note before overriding a content classification.' });
  }

  const client = (prisma as any).contentClassification;
  const existing = await client.findUnique({
    where: { id: req.params.classificationId },
    include: { reviewedBy: { select: adminContentUserSelect } },
  }) as ContentClassificationRow | null;
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const now = new Date();
  const data = input.action === 'mark_reviewed'
    ? {
      status: 'reviewed',
      reviewedById: req.user!.id,
      reviewedAt: now,
      ...(note ? { adminNote: note } : {}),
    }
    : {
      status: 'overridden',
      reviewedById: req.user!.id,
      reviewedAt: now,
      adminNote: note,
      ...(input.systemCategory !== undefined ? { systemCategory: input.systemCategory } : {}),
      ...(input.safetyCategory !== undefined ? { safetyCategory: input.safetyCategory } : {}),
      ...(input.safetySeverity !== undefined ? { safetySeverity: input.safetySeverity } : {}),
      ...(input.suggestedAction !== undefined ? { suggestedAction: input.suggestedAction } : {}),
      ...(input.categoryMismatch !== undefined ? { categoryMismatch: input.categoryMismatch } : {}),
      ...(input.suggestedTags !== undefined ? { suggestedTags: input.suggestedTags } : {}),
      ...(input.suggestedNewTags !== undefined ? { suggestedNewTags: input.suggestedNewTags } : {}),
      ...(input.adultRelated !== undefined ? { adultRelated: input.adultRelated } : {}),
      ...(input.childSafe !== undefined ? { childSafe: input.childSafe } : {}),
      ...(input.spamOrScamRisk !== undefined ? { spamOrScamRisk: input.spamOrScamRisk } : {}),
      ...(input.regulatedRisk !== undefined ? { regulatedRisk: input.regulatedRisk } : {}),
    };

  const updated = await client.update({
    where: { id: existing.id },
    data,
    include: { reviewedBy: { select: adminContentUserSelect } },
  }) as ContentClassificationRow;

  await recordAdminAuditLog(prisma, req.user!.id, {
    action: `content_intelligence.${input.action}`,
    targetType: 'content_classification',
    targetId: existing.id,
    reason: note,
    previousValue: contentClassificationSnapshot(existing),
    nextValue: contentClassificationSnapshot(updated),
    metadata: { targetType: existing.targetType, targetId: existing.targetId, source: existing.source, label: labelContentClassificationTarget(existing.targetType) },
  });

  const [classification] = await hydrateContentClassificationTargets([updated]);
  res.json({ classification });
}));



adminRoutes.post('/content-intelligence/:classificationId/placement-signal', asyncRoute(async (req, res) => {
  try {
    assertContentPlacementSignalsEnabled();
  } catch (error) {
    const typed = error as Error & { statusCode?: number; code?: string };
    return res.status(typed.statusCode ?? 409).json({ error: typed.code ?? 'content_placement_signals_disabled', message: typed.message });
  }

  const client = (prisma as any).contentClassification;
  const existing = await client.findUnique({
    where: { id: req.params.classificationId },
    include: { reviewedBy: { select: adminContentUserSelect } },
  }) as ContentClassificationRow | null;
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (!['reviewed', 'overridden'].includes(existing.status)) {
    return res.status(409).json({ error: 'classification_not_reviewed', message: 'Review or override the classification before syncing contextual placement signals.' });
  }

  const signalClient = (prisma as any).contentPlacementSignal;
  const previous = await signalClient.findUnique({
    where: { targetType_targetId: { targetType: existing.targetType, targetId: existing.targetId } },
    include: { approvedBy: { select: adminContentUserSelect } },
  }) as ContentPlacementSignalRow | null;
  const data = buildContentPlacementSignalData(existing, req.user!.id);
  const signal = await signalClient.upsert({
    where: { targetType_targetId: { targetType: existing.targetType, targetId: existing.targetId } },
    create: data,
    update: data,
    include: { approvedBy: { select: adminContentUserSelect } },
  }) as ContentPlacementSignalRow;

  await recordAdminAuditLog(prisma, req.user!.id, {
    action: 'content_intelligence.sync_placement_signal',
    targetType: 'content_placement_signal',
    targetId: signal.id,
    reason: data.reason,
    previousValue: contentPlacementSignalSnapshot(previous),
    nextValue: contentPlacementSignalSnapshot(signal),
    metadata: {
      targetType: existing.targetType,
      targetId: existing.targetId,
      classificationId: existing.id,
      source: existing.source,
      contextualEligible: signal.contextualEligible,
      businessPlacementEligible: signal.businessPlacementEligible,
      adsPlacementEligible: signal.adsPlacementEligible,
    },
  });

  res.json({ signal });
}));

adminRoutes.post('/content-intelligence/:classificationId/ai-suggestion', asyncRoute(async (req, res) => {
  const input = adminContentClassificationAiSuggestionRequestSchema.parse(req.body ?? {});
  const client = (prisma as any).contentClassification;
  const existing = await client.findUnique({
    where: { id: req.params.classificationId },
    include: { reviewedBy: { select: adminContentUserSelect } },
  }) as ContentClassificationRow | null;
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const [hydrated] = await hydrateContentClassificationTargets([existing]);
  const target = hydrated?.target;
  if (!target) {
    return res.status(404).json({ error: 'target_not_found', message: 'The classified target no longer exists.' });
  }

  const aiInput = {
    targetType: existing.targetType,
    targetId: existing.targetId,
    title: target.title,
    description: target.description,
    userCategory: existing.userCategory ?? target.category ?? null,
    tags: existing.suggestedTags,
    extraText: [existing.reason, target.status, target.category, input.adminNote],
    currentRules: {
      userCategory: existing.userCategory ?? null,
      systemCategory: existing.systemCategory ?? 'other',
      categoryConfidence: existing.categoryConfidence ?? 0.25,
      categoryMismatch: existing.categoryMismatch,
      suggestedTags: existing.suggestedTags,
      suggestedNewTags: existing.suggestedNewTags,
      safetyCategory: existing.safetyCategory ?? 'unknown',
      safetySeverity: existing.safetySeverity ?? 'low',
      adultRelated: existing.adultRelated,
      childSafe: existing.childSafe,
      spamOrScamRisk: existing.spamOrScamRisk,
      regulatedRisk: existing.regulatedRisk,
      suggestedAction: existing.suggestedAction ?? 'review',
      reason: existing.reason ?? '',
    },
  } as any;

  try {
    const result = await classifyContentWithAiSuggestions(aiInput);
    const updated = await client.upsert({
      where: { targetType_targetId_source: { targetType: existing.targetType, targetId: existing.targetId, source: 'ai' } },
      create: {
        targetType: existing.targetType,
        targetId: existing.targetId,
        source: 'ai',
        status: 'completed',
        ...result,
        adminNote: input.adminNote?.trim() || null,
      },
      update: {
        status: 'completed',
        userCategory: result.userCategory,
        systemCategory: result.systemCategory,
        categoryConfidence: result.categoryConfidence,
        categoryMismatch: result.categoryMismatch,
        suggestedTags: result.suggestedTags,
        suggestedNewTags: result.suggestedNewTags,
        safetyCategory: result.safetyCategory,
        safetySeverity: result.safetySeverity,
        adultRelated: result.adultRelated,
        childSafe: result.childSafe,
        spamOrScamRisk: result.spamOrScamRisk,
        regulatedRisk: result.regulatedRisk,
        suggestedAction: result.suggestedAction,
        reason: result.reason,
        reviewedById: null,
        reviewedAt: null,
        adminNote: input.adminNote?.trim() || null,
      },
      include: { reviewedBy: { select: adminContentUserSelect } },
    }) as ContentClassificationRow;

    await recordAdminAuditLog(prisma, req.user!.id, {
      action: 'content_intelligence.ai_suggestion',
      targetType: 'content_classification',
      targetId: updated.id,
      reason: input.adminNote?.trim() || 'Admin requested AI content intelligence suggestion.',
      previousValue: contentClassificationSnapshot(existing),
      nextValue: contentClassificationSnapshot(updated),
      metadata: { targetType: existing.targetType, targetId: existing.targetId, source: 'ai', basedOnClassificationId: existing.id, aiProvider: env.aiProvider },
    });

    const [classification] = await hydrateContentClassificationTargets([updated]);
    res.json({ classification });
  } catch (error) {
    if (error instanceof ContentAiSuggestionError && error.statusCode === 409) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }

    const reason = error instanceof Error ? error.message : 'AI suggestion failed.';
    const failed = await client.upsert({
      where: { targetType_targetId_source: { targetType: existing.targetType, targetId: existing.targetId, source: 'ai' } },
      create: {
        targetType: existing.targetType,
        targetId: existing.targetId,
        source: 'ai',
        status: 'failed',
        userCategory: aiInput.userCategory,
        safetyCategory: 'unknown',
        safetySeverity: 'low',
        childSafe: false,
        suggestedAction: 'review',
        reason,
        adminNote: input.adminNote?.trim() || null,
      },
      update: {
        status: 'failed',
        userCategory: aiInput.userCategory,
        safetyCategory: 'unknown',
        safetySeverity: 'low',
        childSafe: false,
        suggestedAction: 'review',
        reason,
        reviewedById: null,
        reviewedAt: null,
        adminNote: input.adminNote?.trim() || null,
      },
      include: { reviewedBy: { select: adminContentUserSelect } },
    }) as ContentClassificationRow;

    await recordAdminAuditLog(prisma, req.user!.id, {
      action: 'content_intelligence.ai_suggestion_failed',
      targetType: 'content_classification',
      targetId: failed.id,
      reason,
      previousValue: contentClassificationSnapshot(existing),
      nextValue: contentClassificationSnapshot(failed),
      metadata: { targetType: existing.targetType, targetId: existing.targetId, source: 'ai', basedOnClassificationId: existing.id, aiProvider: env.aiProvider },
    });

    res.status(error instanceof ContentAiSuggestionError ? error.statusCode : 502).json({ error: 'ai_suggestion_failed', message: reason });
  }
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
      include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, need: true, offer: true, _count: { select: { proposals: true } } },
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
      include: { owner: { select: adminContentUserSelect }, businessProfile: { select: adminLibraryBusinessProfileSelect }, need: true, offer: true, _count: { select: { proposals: true } } },
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

const adminBusinessProfileStatusFilters = ['all', 'draft', 'active', 'pending_review', 'verified', 'restricted', 'disabled', 'rejected'] as const;
const adminBusinessProfileTypeFilters = ['all', 'business', 'agency', 'brand', 'enterprise'] as const;

const adminBusinessProfileListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.enum(adminBusinessProfileStatusFilters).optional().default('all'),
  type: z.enum(adminBusinessProfileTypeFilters).optional().default('all'),
  take: z.coerce.number().int().min(1).max(250).optional().default(150),
});

const adminBusinessProfileInclude = {
  owner: { select: { id: true, email: true, profile: true, trustTier: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
  members: { include: { user: { select: { id: true, email: true, profile: true, trustTier: true } } }, orderBy: { createdAt: 'asc' as const } },
  moneyProviderAccounts: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  _count: { select: { needs: true, offers: true, trades: true, inventoryTemplates: true, sponsoredPlacements: true, campaigns: true, budgets: true } },
} as const;

function normalizeAdminBusinessProfile(profile: any) {
  return { ...profile, counts: profile._count };
}

function adminBusinessProfileWhere(input: z.infer<typeof adminBusinessProfileListQuerySchema>) {
  const where: Record<string, unknown> = {};
  if (input.status !== 'all') where.status = input.status;
  if (input.type !== 'all') where.type = input.type;
  if (input.q) {
    where.OR = [
      { displayName: { contains: input.q, mode: 'insensitive' as const } },
      { legalName: { contains: input.q, mode: 'insensitive' as const } },
      { handle: { contains: input.q, mode: 'insensitive' as const } },
      { websiteUrl: { contains: input.q, mode: 'insensitive' as const } },
      { countryCode: { contains: input.q, mode: 'insensitive' as const } },
      { owner: { email: { contains: input.q, mode: 'insensitive' as const } } },
      { owner: { profile: { is: { displayName: { contains: input.q, mode: 'insensitive' as const } } } } },
      { owner: { profile: { is: { handle: { contains: input.q, mode: 'insensitive' as const } } } } },
    ];
  }
  return where;
}

async function closeBusinessPublicContentForReview(tx: any, businessProfileId: string) {
  const [needs, offers, trades, inventoryTemplates, sponsoredPlacements, campaigns, budgets] = await Promise.all([
    tx.need.updateMany({ where: { businessProfileId, status: 'active' }, data: { status: 'closed' } }),
    tx.offer.updateMany({ where: { businessProfileId, status: 'active' }, data: { status: 'closed' } }),
    tx.trade.updateMany({ where: { businessProfileId, status: 'active' }, data: { status: 'closed' } }),
    tx.inventoryTemplate.updateMany({ where: { businessProfileId, status: 'active' }, data: { status: 'archived' } }),
    (tx as any).businessSponsoredPlacement?.updateMany({ where: { businessProfileId, status: { in: ['pending_review', 'approved', 'paused'] } }, data: { status: 'archived', archivedAt: new Date() } }) ?? Promise.resolve({ count: 0 }),
    (tx as any).businessCampaign?.updateMany({ where: { businessProfileId, status: { in: ['pending_review', 'approved', 'paused'] } }, data: { status: 'archived', archivedAt: new Date() } }) ?? Promise.resolve({ count: 0 }),
    (tx as any).businessBudget?.updateMany({ where: { businessProfileId, status: { in: ['pending_provider_review', 'pending_admin_review', 'sandbox_ready', 'paused'] } }, data: { status: 'archived', archivedAt: new Date() } }) ?? Promise.resolve({ count: 0 }),
  ]);
  return {
    needsClosed: needs.count,
    offersClosed: offers.count,
    tradesClosed: trades.count,
    inventoryTemplatesArchived: inventoryTemplates.count,
    sponsoredPlacementsArchived: sponsoredPlacements.count,
    campaignsArchived: campaigns.count,
    budgetsArchived: budgets.count,
  };
}

async function businessProfileStatusSummary(where: Record<string, unknown>) {
  const [total, draft, active, pendingReview, verified, restricted, disabled, rejected] = await Promise.all([
    prisma.businessProfile.count({ where: where as any }),
    prisma.businessProfile.count({ where: { ...(where as any), status: 'draft' } }),
    prisma.businessProfile.count({ where: { ...(where as any), status: 'active' } }),
    prisma.businessProfile.count({ where: { ...(where as any), status: 'pending_review' } }),
    prisma.businessProfile.count({ where: { ...(where as any), status: 'verified' } }),
    prisma.businessProfile.count({ where: { ...(where as any), status: 'restricted' } }),
    prisma.businessProfile.count({ where: { ...(where as any), status: 'disabled' } }),
    prisma.businessProfile.count({ where: { ...(where as any), status: 'rejected' } }),
  ]);
  return { total, draft, active, pendingReview, verified, restricted, disabled, rejected };
}

adminRoutes.get('/business-profiles', asyncRoute(async (req, res) => {
  const input = adminBusinessProfileListQuerySchema.parse(req.query);
  const where = adminBusinessProfileWhere(input);
  const [businessProfiles, summary] = await Promise.all([
    prisma.businessProfile.findMany({
      where: where as any,
      include: adminBusinessProfileInclude,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: input.take,
    }),
    businessProfileStatusSummary(where),
  ]);
  const provider = buildMoneyProviderStatus();
  const recentAuditLogs = await (prisma as any).adminAuditLog?.findMany({
    where: { targetType: 'business_profile', targetId: { in: businessProfiles.map((profile) => profile.id) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { admin: { select: { id: true, email: true, profile: true } } },
  }) ?? [];
  res.json({ provider, summary, recentAuditLogs, businessProfiles: businessProfiles.map(normalizeAdminBusinessProfile) });
}));

adminRoutes.patch('/business-profiles/:businessProfileId/action', asyncRoute(async (req, res) => {
  const input = adminBusinessProfileActionRequestSchema.parse(req.body);
  const businessProfileId = req.params.businessProfileId;
  if (!businessProfileId) return res.status(400).json({ error: 'business_profile_id_required' });
  const statusByAction = {
    verify: 'verified',
    restrict: 'restricted',
    disable: 'disabled',
    reject: 'rejected',
    activate: 'active',
  } as const;
  const nextStatus = statusByAction[input.action];
  const destructiveContentActionAllowed = input.action === 'restrict' || input.action === 'disable' || input.action === 'reject';
  if (input.disablePublicContent && !destructiveContentActionAllowed) {
    return res.status(400).json({ error: 'disable_public_content_not_allowed', message: 'Public Business content can only be closed when restricting, disabling, or rejecting a Business profile.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.businessProfile.findUnique({
      where: { id: businessProfileId },
      include: { _count: { select: { needs: true, offers: true, trades: true, inventoryTemplates: true, sponsoredPlacements: true, campaigns: true, budgets: true } } },
    });
    if (!existing) return null;

    const now = new Date();
    const contentAction = input.disablePublicContent ? await closeBusinessPublicContentForReview(tx, existing.id) : null;
    const updated = await tx.businessProfile.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        reviewedAt: now,
        reviewerId: req.user!.id,
        reviewNote: input.note,
        verifiedAt: input.action === 'verify' ? (existing.verifiedAt ?? now) : input.action === 'activate' ? existing.verifiedAt : null,
      },
      include: adminBusinessProfileInclude,
    });

    await recordAdminAuditLog(tx, req.user!.id, {
      action: `business_profile.${input.action}`,
      targetType: 'business_profile',
      targetId: existing.id,
      reason: input.note,
      previousValue: {
        status: existing.status,
        reviewedAt: existing.reviewedAt,
        reviewerId: existing.reviewerId,
        reviewNote: existing.reviewNote,
        verifiedAt: existing.verifiedAt,
        counts: existing._count,
      },
      nextValue: {
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        reviewerId: updated.reviewerId,
        reviewNote: updated.reviewNote,
        verifiedAt: updated.verifiedAt,
        counts: updated._count,
      },
      metadata: {
        businessProfileType: existing.type,
        ownerId: existing.ownerId,
        disablePublicContent: input.disablePublicContent,
        contentAction,
      },
    });

    return { businessProfile: normalizeAdminBusinessProfile(updated), contentAction };
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business or brand profile not found.' });
  res.json(result);
}));

const businessSponsoredPlacementIncludeForAdmin = {
  businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true, ownerId: true } },
  createdBy: { select: { id: true, email: true, profile: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
} as const;

async function loadAdminBusinessSponsoredTarget(businessProfileId: string, targetType: string, targetId: string) {
  if (targetType === 'need') {
    return prisma.need.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, timing: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'offer') {
    return prisma.offer.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, availability: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'inventory_template') {
    return prisma.inventoryTemplate.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, key: true, kind: true, title: true, description: true, status: true, sourceType: true, itemType: true, category: true, languageCode: true, countryCode: true, timing: true, availability: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  return null;
}

async function hydrateAdminBusinessSponsoredPlacements(placements: any[]) {
  return Promise.all(placements.map(async (placement) => ({
    ...placement,
    target: await loadAdminBusinessSponsoredTarget(placement.businessProfileId, placement.targetType, placement.targetId),
  })));
}

function adminSponsoredPlacementWhere(input: z.infer<typeof adminBusinessSponsoredPlacementListQuerySchema>) {
  const where: Record<string, unknown> = {};
  if (input.status !== 'all') where.status = input.status;
  if (input.surface !== 'all') where.surface = input.surface;
  if (input.targetType !== 'all') where.targetType = input.targetType;
  if (input.businessProfileId) where.businessProfileId = input.businessProfileId;
  if (input.q) {
    where.OR = [
      { label: { contains: input.q, mode: 'insensitive' as const } },
      { reviewNote: { contains: input.q, mode: 'insensitive' as const } },
      { targetId: { contains: input.q, mode: 'insensitive' as const } },
      { businessProfile: { displayName: { contains: input.q, mode: 'insensitive' as const } } },
      { businessProfile: { handle: { contains: input.q, mode: 'insensitive' as const } } },
    ];
  }
  return where;
}

async function businessSponsoredPlacementStatusSummary(where: Record<string, unknown>) {
  const [total, draft, pendingReview, approved, rejected, paused, archived] = await Promise.all([
    (prisma as any).businessSponsoredPlacement.count({ where: where as any }),
    (prisma as any).businessSponsoredPlacement.count({ where: { ...(where as any), status: 'draft' } }),
    (prisma as any).businessSponsoredPlacement.count({ where: { ...(where as any), status: 'pending_review' } }),
    (prisma as any).businessSponsoredPlacement.count({ where: { ...(where as any), status: 'approved' } }),
    (prisma as any).businessSponsoredPlacement.count({ where: { ...(where as any), status: 'rejected' } }),
    (prisma as any).businessSponsoredPlacement.count({ where: { ...(where as any), status: 'paused' } }),
    (prisma as any).businessSponsoredPlacement.count({ where: { ...(where as any), status: 'archived' } }),
  ]);
  return { total, draft, pendingReview, approved, rejected, paused, archived };
}

adminRoutes.get('/business-sponsored-placements', asyncRoute(async (req, res) => {
  const input = adminBusinessSponsoredPlacementListQuerySchema.parse(req.query);
  const where = adminSponsoredPlacementWhere(input);
  const [placements, summary] = await Promise.all([
    (prisma as any).businessSponsoredPlacement.findMany({
      where: where as any,
      include: businessSponsoredPlacementIncludeForAdmin,
      orderBy: [{ status: 'asc' }, { surface: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
      take: input.take,
    }),
    businessSponsoredPlacementStatusSummary(where),
  ]);
  const recentAuditLogs = await (prisma as any).adminAuditLog?.findMany({
    where: { targetType: 'business_sponsored_placement', targetId: { in: placements.map((placement: any) => placement.id) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { admin: { select: { id: true, email: true, profile: true } } },
  }) ?? [];
  res.json({ summary, recentAuditLogs, placements: await hydrateAdminBusinessSponsoredPlacements(placements) });
}));

adminRoutes.patch('/business-sponsored-placements/:placementId/action', asyncRoute(async (req, res) => {
  const input = adminBusinessSponsoredPlacementActionRequestSchema.parse(req.body ?? {});
  const placementId = req.params.placementId;
  if (!placementId) return res.status(400).json({ error: 'business_sponsored_placement_id_required' });
  const statusByAction = {
    approve: 'approved',
    reject: 'rejected',
    pause: 'paused',
    archive: 'archived',
    restore: 'approved',
  } as const;
  const nextStatus = statusByAction[input.action];

  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessSponsoredPlacement.findUnique({ where: { id: placementId }, include: businessSponsoredPlacementIncludeForAdmin });
    if (!existing) return null;
    const profile = existing.businessProfile;
    if ((input.action === 'approve' || input.action === 'restore') && profile.status !== 'verified') return { status: 409 as const, error: 'business_profile_not_verified' };
    const target = await loadAdminBusinessSponsoredTarget(existing.businessProfileId, existing.targetType, existing.targetId);
    if ((input.action === 'approve' || input.action === 'restore') && !target) return { status: 409 as const, error: 'sponsored_target_not_eligible' };
    const now = new Date();
    const updated = await (tx as any).businessSponsoredPlacement.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        reviewedAt: now,
        reviewedById: req.user!.id,
        reviewNote: input.note,
        ...(input.action === 'archive' ? { archivedAt: now } : {}),
        ...(input.action === 'restore' || input.action === 'approve' ? { archivedAt: null } : {}),
      },
      include: businessSponsoredPlacementIncludeForAdmin,
    });
    await recordAdminAuditLog(tx, req.user!.id, {
      action: `business_sponsored_placement.${input.action}`,
      targetType: 'business_sponsored_placement',
      targetId: existing.id,
      reason: input.note,
      previousValue: { status: existing.status, reviewedAt: existing.reviewedAt, reviewedById: existing.reviewedById, reviewNote: existing.reviewNote, archivedAt: existing.archivedAt },
      nextValue: { status: updated.status, reviewedAt: updated.reviewedAt, reviewedById: updated.reviewedById, reviewNote: updated.reviewNote, archivedAt: updated.archivedAt },
      metadata: { businessProfileId: existing.businessProfileId, targetType: existing.targetType, targetId: existing.targetId, surface: existing.surface, noTracking: true, noBudget: true },
    });
    return { status: 200 as const, placement: updated, target };
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Sponsored placement not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: result.error === 'business_profile_not_verified' ? 'The Business profile must be verified before approving sponsored placements.' : 'Sponsored placement target must be an active, admin-approved Business Need, Offer, or library item.' });
  res.json({ placement: { ...result.placement, target: result.target ?? await loadAdminBusinessSponsoredTarget(result.placement.businessProfileId, result.placement.targetType, result.placement.targetId) } });
}));




const businessCampaignIncludeForAdmin = {
  businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true, ownerId: true } },
  createdBy: { select: { id: true, email: true, profile: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
  items: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  _count: { select: { items: true, applications: true } },
} as const;

async function loadAdminBusinessCampaignTarget(businessProfileId: string, targetType: string, targetId: string) {
  if (targetType === 'need') {
    return prisma.need.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, timing: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'offer') {
    return prisma.offer.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, title: true, description: true, status: true, itemType: true, category: true, availability: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  if (targetType === 'inventory_template') {
    return prisma.inventoryTemplate.findFirst({
      where: { id: targetId, businessProfileId, status: 'active' },
      select: { id: true, key: true, kind: true, title: true, description: true, status: true, sourceType: true, itemType: true, category: true, languageCode: true, countryCode: true, timing: true, availability: true, mode: true, locationLabel: true, tags: true, updatedAt: true },
    });
  }
  return null;
}

async function hydrateAdminBusinessCampaign(campaign: any) {
  return {
    ...campaign,
    items: await Promise.all((campaign.items ?? []).map(async (item: any) => ({ ...item, target: await loadAdminBusinessCampaignTarget(campaign.businessProfileId, item.targetType, item.targetId) }))),
  };
}

async function hydrateAdminBusinessCampaigns(campaigns: any[]) {
  return Promise.all(campaigns.map((campaign) => hydrateAdminBusinessCampaign(campaign)));
}

function adminBusinessCampaignWhere(input: z.infer<typeof adminBusinessCampaignListQuerySchema>) {
  const where: Record<string, unknown> = {};
  if (input.status !== 'all') where.status = input.status;
  if (input.opportunityType !== 'all') where.opportunityType = input.opportunityType;
  if (input.businessProfileId) where.businessProfileId = input.businessProfileId;
  if (input.q) {
    where.OR = [
      { title: { contains: input.q, mode: 'insensitive' as const } },
      { summary: { contains: input.q, mode: 'insensitive' as const } },
      { description: { contains: input.q, mode: 'insensitive' as const } },
      { eligibility: { contains: input.q, mode: 'insensitive' as const } },
      { deliverables: { contains: input.q, mode: 'insensitive' as const } },
      { businessProfile: { displayName: { contains: input.q, mode: 'insensitive' as const } } },
      { businessProfile: { handle: { contains: input.q, mode: 'insensitive' as const } } },
    ];
  }
  return where;
}

async function businessCampaignStatusSummary(where: Record<string, unknown>) {
  const [total, draft, pendingReview, approved, rejected, paused, archived, completed] = await Promise.all([
    (prisma as any).businessCampaign.count({ where: where as any }),
    (prisma as any).businessCampaign.count({ where: { ...(where as any), status: 'draft' } }),
    (prisma as any).businessCampaign.count({ where: { ...(where as any), status: 'pending_review' } }),
    (prisma as any).businessCampaign.count({ where: { ...(where as any), status: 'approved' } }),
    (prisma as any).businessCampaign.count({ where: { ...(where as any), status: 'rejected' } }),
    (prisma as any).businessCampaign.count({ where: { ...(where as any), status: 'paused' } }),
    (prisma as any).businessCampaign.count({ where: { ...(where as any), status: 'archived' } }),
    (prisma as any).businessCampaign.count({ where: { ...(where as any), status: 'completed' } }),
  ]);
  return { total, draft, pendingReview, approved, rejected, paused, archived, completed };
}

async function adminCampaignHasEligibleItems(campaign: any) {
  const items = campaign.items ?? [];
  if (!items.length) return false;
  for (const item of items) {
    const target = await loadAdminBusinessCampaignTarget(campaign.businessProfileId, item.targetType, item.targetId);
    if (!target) return false;
  }
  return true;
}

const businessBudgetIncludeForAdmin = {
  businessProfile: { select: { id: true, displayName: true, handle: true, type: true, status: true, ownerId: true } },
  campaign: { select: { id: true, title: true, status: true, opportunityType: true } },
  providerAccount: { select: { id: true, provider: true, providerAccountId: true, accountType: true, status: true, country: true, defaultCurrency: true, lastSyncedAt: true } },
  createdBy: { select: { id: true, email: true, profile: true } },
  reviewer: { select: { id: true, email: true, profile: true } },
  ledgerEntries: { orderBy: { createdAt: 'desc' as const }, take: 25 },
} as const;

function adminBusinessBudgetWhere(input: any) {
  const q = input.q?.trim();
  return {
    ...(input.businessProfileId ? { businessProfileId: input.businessProfileId } : {}),
    ...(input.status !== 'all' ? { status: input.status } : {}),
    ...(input.provider !== 'all' ? { provider: input.provider } : {}),
    ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    ...(q ? {
      OR: [
        { purpose: { contains: q, mode: 'insensitive' as const } },
        { riskNote: { contains: q, mode: 'insensitive' as const } },
        { providerExternalId: { contains: q, mode: 'insensitive' as const } },
        { businessProfile: { displayName: { contains: q, mode: 'insensitive' as const } } },
        { campaign: { title: { contains: q, mode: 'insensitive' as const } } },
      ],
    } : {}),
  };
}

async function businessBudgetStatusSummary(where: Record<string, unknown>) {
  const [total, draft, pendingProviderReview, pendingAdminReview, sandboxReady, rejected, paused, archived] = await Promise.all([
    (prisma as any).businessBudget.count({ where: where as any }),
    (prisma as any).businessBudget.count({ where: { ...(where as any), status: 'draft' } }),
    (prisma as any).businessBudget.count({ where: { ...(where as any), status: 'pending_provider_review' } }),
    (prisma as any).businessBudget.count({ where: { ...(where as any), status: 'pending_admin_review' } }),
    (prisma as any).businessBudget.count({ where: { ...(where as any), status: 'sandbox_ready' } }),
    (prisma as any).businessBudget.count({ where: { ...(where as any), status: 'rejected' } }),
    (prisma as any).businessBudget.count({ where: { ...(where as any), status: 'paused' } }),
    (prisma as any).businessBudget.count({ where: { ...(where as any), status: 'archived' } }),
  ]);
  return { total, draft, pendingProviderReview, pendingAdminReview, sandboxReady, rejected, paused, archived };
}

async function findActiveBusinessBudgetProviderAccount(client: any, budget: any) {
  if (!budget.provider || budget.provider === 'none') return null;
  if (budget.providerAccountId) {
    return client.moneyProviderAccount.findFirst({ where: { id: budget.providerAccountId, businessProfileId: budget.businessProfileId, provider: budget.provider, status: 'active' } });
  }
  return client.moneyProviderAccount.findFirst({ where: { businessProfileId: budget.businessProfileId, provider: budget.provider, accountType: { in: ['business', 'brand'] }, status: 'active' }, orderBy: { updatedAt: 'desc' } });
}

adminRoutes.get('/business-budgets', asyncRoute(async (req, res) => {
  const input = adminBusinessBudgetListQuerySchema.parse(req.query);
  const where = adminBusinessBudgetWhere(input);
  const [budgets, summary] = await Promise.all([
    (prisma as any).businessBudget.findMany({
      where: where as any,
      include: businessBudgetIncludeForAdmin,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: input.take,
    }),
    businessBudgetStatusSummary(where),
  ]);
  const recentAuditLogs = await (prisma as any).adminAuditLog?.findMany({
    where: { targetType: 'business_budget', targetId: { in: budgets.map((budget: any) => budget.id) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { admin: { select: { id: true, email: true, profile: true } } },
  }) ?? [];
  res.json({ summary, recentAuditLogs, budgets, moneyProvider: buildMoneyProviderStatus(), sandboxOnly: env.moneyProviderSandboxOnly, noMoneyMoved: true });
}));

adminRoutes.patch('/business-budgets/:budgetId/action', asyncRoute(async (req, res) => {
  const input = adminBusinessBudgetActionRequestSchema.parse(req.body ?? {});
  const budgetId = req.params.budgetId;
  if (!budgetId) return res.status(400).json({ error: 'business_budget_id_required' });

  const statusByAction = {
    approve: 'sandbox_ready',
    reject: 'rejected',
    pause: 'paused',
    archive: 'archived',
    restore: 'pending_admin_review',
  } as const;
  const nextStatus = statusByAction[input.action];

  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessBudget.findUnique({ where: { id: budgetId }, include: businessBudgetIncludeForAdmin });
    if (!existing) return null;
    const providerAccount = await findActiveBusinessBudgetProviderAccount(tx as any, existing);
    if (input.action === 'approve' || input.action === 'restore') {
      if (existing.businessProfile.status !== 'verified') return { status: 409 as const, error: 'business_profile_not_verified' };
      if (!existing.requestedAmountCents || existing.requestedAmountCents <= 0) return { status: 409 as const, error: 'business_budget_amount_required' };
      if (existing.provider === 'none') return { status: 409 as const, error: 'business_budget_provider_required' };
      if (env.moneyProvider !== existing.provider || !env.moneyProviderSandboxOnly || !env.moneyProviderAccountCreationEnabled) return { status: 409 as const, error: 'business_budget_provider_not_ready' };
      if (!providerAccount) return { status: 409 as const, error: 'business_budget_provider_account_required' };
    }
    const now = new Date();
    const updated = await (tx as any).businessBudget.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        reviewedAt: now,
        reviewedById: req.user!.id,
        reviewNote: input.note,
        ...(providerAccount ? { providerAccountId: providerAccount.id } : {}),
        ...(input.action === 'archive' ? { archivedAt: now } : {}),
        ...(input.action === 'restore' || input.action === 'approve' ? { archivedAt: null } : {}),
      },
      include: businessBudgetIncludeForAdmin,
    });
    if (input.action === 'approve') {
      await (tx as any).businessBudgetLedgerEntry.create({
        data: {
          budgetId: existing.id,
          type: 'reserved_preview',
          amountCents: existing.requestedAmountCents,
          currency: existing.currency,
          note: 'Admin marked the provider-backed Business budget as sandbox-ready. No money moved.',
          createdById: req.user!.id,
        },
      });
    }
    await recordAdminAuditLog(tx, req.user!.id, {
      action: `business_budget.${input.action}`,
      targetType: 'business_budget',
      targetId: existing.id,
      reason: input.note,
      previousValue: { status: existing.status, provider: existing.provider, providerAccountId: existing.providerAccountId, requestedAmountCents: existing.requestedAmountCents, reviewedAt: existing.reviewedAt, reviewedById: existing.reviewedById, reviewNote: existing.reviewNote, archivedAt: existing.archivedAt },
      nextValue: { status: updated.status, provider: updated.provider, providerAccountId: updated.providerAccountId, requestedAmountCents: updated.requestedAmountCents, reviewedAt: updated.reviewedAt, reviewedById: updated.reviewedById, reviewNote: updated.reviewNote, archivedAt: updated.archivedAt, noMoneyMoved: true },
      metadata: { businessProfileId: existing.businessProfileId, campaignId: existing.campaignId, sandboxOnly: true, providerExecutionDisabled: true },
    });
    return { status: 200 as const, budget: updated };
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business budget not found.' });
  if (result.status === 409) {
    const messages: Record<string, string> = {
      business_profile_not_verified: 'The Business profile must be verified before approving sandbox budgets.',
      business_budget_amount_required: 'Add a requested budget amount before approving this sandbox budget.',
      business_budget_provider_required: 'A real sandbox money provider is required before approving this Business budget.',
      business_budget_provider_not_ready: 'The configured money provider is not ready for Business budget sandbox review.',
      business_budget_provider_account_required: 'The Business profile needs an active provider-backed Business account before this sandbox budget can be approved.',
    };
    return res.status(409).json({ error: result.error, message: messages[result.error] ?? 'This Business budget cannot be approved.' });
  }
  res.json({ budget: result.budget, noMoneyMoved: true });
}));

adminRoutes.get('/business-campaigns', asyncRoute(async (req, res) => {
  const input = adminBusinessCampaignListQuerySchema.parse(req.query);
  const where = adminBusinessCampaignWhere(input);
  const [campaigns, summary] = await Promise.all([
    (prisma as any).businessCampaign.findMany({
      where: where as any,
      include: businessCampaignIncludeForAdmin,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: input.take,
    }),
    businessCampaignStatusSummary(where),
  ]);
  const recentAuditLogs = await (prisma as any).adminAuditLog?.findMany({
    where: { targetType: 'business_campaign', targetId: { in: campaigns.map((campaign: any) => campaign.id) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { admin: { select: { id: true, email: true, profile: true } } },
  }) ?? [];
  res.json({ summary, recentAuditLogs, campaigns: await hydrateAdminBusinessCampaigns(campaigns) });
}));

adminRoutes.patch('/business-campaigns/:campaignId/action', asyncRoute(async (req, res) => {
  const input = adminBusinessCampaignActionRequestSchema.parse(req.body ?? {});
  const campaignId = req.params.campaignId;
  if (!campaignId) return res.status(400).json({ error: 'business_campaign_id_required' });
  const statusByAction = {
    approve: 'approved',
    reject: 'rejected',
    pause: 'paused',
    archive: 'archived',
    restore: 'approved',
    complete: 'completed',
  } as const;
  const nextStatus = statusByAction[input.action];

  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).businessCampaign.findUnique({ where: { id: campaignId }, include: businessCampaignIncludeForAdmin });
    if (!existing) return null;
    const profile = existing.businessProfile;
    if ((input.action === 'approve' || input.action === 'restore') && profile.status !== 'verified') return { status: 409 as const, error: 'business_profile_not_verified' };
    const hasEligibleItems = await adminCampaignHasEligibleItems(existing);
    if ((input.action === 'approve' || input.action === 'restore') && !hasEligibleItems) return { status: 409 as const, error: 'business_campaign_items_required' };
    const now = new Date();
    const updated = await (tx as any).businessCampaign.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        reviewedAt: now,
        reviewedById: req.user!.id,
        reviewNote: input.note,
        ...(input.action === 'archive' ? { archivedAt: now } : {}),
        ...(input.action === 'restore' || input.action === 'approve' ? { archivedAt: null } : {}),
      },
      include: businessCampaignIncludeForAdmin,
    });
    await recordAdminAuditLog(tx, req.user!.id, {
      action: `business_campaign.${input.action}`,
      targetType: 'business_campaign',
      targetId: existing.id,
      reason: input.note,
      previousValue: { status: existing.status, reviewedAt: existing.reviewedAt, reviewedById: existing.reviewedById, reviewNote: existing.reviewNote, archivedAt: existing.archivedAt },
      nextValue: { status: updated.status, reviewedAt: updated.reviewedAt, reviewedById: updated.reviewedById, reviewNote: updated.reviewNote, archivedAt: updated.archivedAt },
      metadata: { businessProfileId: existing.businessProfileId, opportunityType: existing.opportunityType, itemCount: existing.items?.length ?? 0, noBudget: true, noMoney: true, applicationSkeletonOnly: true },
    });
    return { status: 200 as const, campaign: updated };
  });

  if (!result) return res.status(404).json({ error: 'not_found', message: 'Business campaign not found.' });
  if (result.status === 409) return res.status(409).json({ error: result.error, message: result.error === 'business_profile_not_verified' ? 'The Business profile must be verified before approving campaigns.' : 'Attach at least one active, admin-approved Business item before approving this campaign.' });
  res.json({ campaign: await hydrateAdminBusinessCampaign(result.campaign) });
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
