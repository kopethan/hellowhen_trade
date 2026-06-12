import { Router } from 'express';
import { evaluatePlusGate, type PlusSubscriptionFeatureFlags } from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getAiAssistUsageSummary } from './aiAssistUsage.js';
import {
  membershipEntitlementAsAiAssistUser,
  membershipEntitlementUserSelect,
  resolveMembershipEntitlement,
  serializeMembershipEntitlement,
  type MembershipEntitlementUserRow,
} from './membershipEntitlements.js';

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

type PlusSnapshotUser = MembershipEntitlementUserRow;

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function normalizePlusSnapshot(user: PlusSnapshotUser, aiAssistUsage: Awaited<ReturnType<typeof getAiAssistUsageSummary>>) {
  const config = plusConfigSnapshot();
  const entitlement = resolveMembershipEntitlement(user);
  const gate = evaluatePlusGate(config, entitlement.accessState as any);

  return {
    config,
    state: {
      subscriptionTier: entitlement.appState.subscriptionTier,
      subscriptionStatus: entitlement.appState.subscriptionStatus,
      subscriptionStatusUpdatedAt: iso(entitlement.appState.subscriptionStatusUpdatedAt),
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
    entitlement: serializeMembershipEntitlement(entitlement),
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
      ...membershipEntitlementUserSelect,
    },
  });

  if (!user) return res.status(404).json({ error: 'not_found' });
  const config = plusConfigSnapshot();
  const entitlement = resolveMembershipEntitlement(user);
  const aiAssistUsage = await getAiAssistUsageSummary(prisma as any, membershipEntitlementAsAiAssistUser(user.id, entitlement), config);
  return res.json(normalizePlusSnapshot(user, aiAssistUsage));
}));
