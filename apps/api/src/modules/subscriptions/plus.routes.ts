import { Router } from 'express';
import { evaluatePlusGate, type PlusSubscriptionFeatureFlags } from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getAiAssistUsageSummary } from './aiAssistUsage.js';

export const plusRoutes = Router();

plusRoutes.use(requireAuth);

export function plusConfigSnapshot(): PlusSubscriptionFeatureFlags {
  return {
    plusEnabled: env.plusEnabled,
    plusPublic: env.plusPublic,
    aiAssistEnabled: env.plusAiAssistEnabled,
    customizationEnabled: env.plusCustomizationEnabled,
    adminGrantsEnabled: env.plusAdminGrantsEnabled,
    monthlyPriceCents: Number.isFinite(env.plusMonthlyPriceCents) ? env.plusMonthlyPriceCents : 499,
    monthlyPriceCurrency: env.plusMonthlyPriceCurrency,
    yearlyPriceCents: Number.isFinite(env.plusYearlyPriceCents) ? env.plusYearlyPriceCents : 3999,
    yearlyPriceCurrency: env.plusYearlyPriceCurrency,
    freeMonthlyAiAssistQuota: Number.isFinite(env.freeMonthlyAiAssistQuota) ? env.freeMonthlyAiAssistQuota : 3,
    plusMonthlyAiAssistQuota: Number.isFinite(env.plusMonthlyAiAssistQuota) ? env.plusMonthlyAiAssistQuota : 75,
  };
}

type PlusSnapshotUser = {
  id: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionStatusUpdatedAt: Date | string | null;
  subscriptionState?: {
    id: string;
    tier: string;
    status: string;
    provider: string | null;
    currentPeriodStartedAt: Date | string | null;
    currentPeriodEndsAt: Date | string | null;
    trialStartedAt: Date | string | null;
    trialEndsAt: Date | string | null;
    canceledAt: Date | string | null;
    pastDueAt: Date | string | null;
    expiresAt: Date | string | null;
    lastSyncedAt: Date | string | null;
    adminNote: string | null;
  } | null;
};

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function normalizePlusSnapshot(user: PlusSnapshotUser, aiAssistUsage: Awaited<ReturnType<typeof getAiAssistUsageSummary>>) {
  const config = plusConfigSnapshot();
  const gate = evaluatePlusGate(config, {
    subscriptionTier: user.subscriptionTier,
    subscriptionStatus: user.subscriptionStatus,
  } as any);

  return {
    config,
    state: {
      subscriptionTier: gate.subscriptionTier,
      subscriptionStatus: gate.subscriptionStatus,
      subscriptionStatusUpdatedAt: iso(user.subscriptionStatusUpdatedAt),
    },
    subscriptionState: user.subscriptionState ? {
      id: user.subscriptionState.id,
      tier: user.subscriptionState.tier,
      status: user.subscriptionState.status,
      provider: user.subscriptionState.provider,
      currentPeriodStartedAt: iso(user.subscriptionState.currentPeriodStartedAt),
      currentPeriodEndsAt: iso(user.subscriptionState.currentPeriodEndsAt),
      trialStartedAt: iso(user.subscriptionState.trialStartedAt),
      trialEndsAt: iso(user.subscriptionState.trialEndsAt),
      canceledAt: iso(user.subscriptionState.canceledAt),
      pastDueAt: iso(user.subscriptionState.pastDueAt),
      expiresAt: iso(user.subscriptionState.expiresAt),
      lastSyncedAt: iso(user.subscriptionState.lastSyncedAt),
      adminNote: user.subscriptionState.adminNote,
    } : null,
    access: {
      canSeePlusSurfaces: gate.canSeePlusSurfaces,
      hasPlusAccess: gate.hasPlusAccess,
      blockers: gate.blockers,
      entitlements: gate.entitlements,
    },
    price: gate.price,
    aiAssistUsage,
  };
}

plusRoutes.get('/me', asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionStatusUpdatedAt: true,
      subscriptionState: {
        select: {
          id: true,
          tier: true,
          status: true,
          provider: true,
          currentPeriodStartedAt: true,
          currentPeriodEndsAt: true,
          trialStartedAt: true,
          trialEndsAt: true,
          canceledAt: true,
          pastDueAt: true,
          expiresAt: true,
          lastSyncedAt: true,
          adminNote: true,
        },
      },
    },
  });

  if (!user) return res.status(404).json({ error: 'not_found' });
  const config = plusConfigSnapshot();
  const aiAssistUsage = await getAiAssistUsageSummary(prisma as any, user, config);
  return res.json(normalizePlusSnapshot(user, aiAssistUsage));
}));
