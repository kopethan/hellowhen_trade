import { Router } from 'express';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { resolveMembershipEntitlement, serializeMembershipEntitlement } from './membershipEntitlements.js';
import { createMembershipCheckoutSessionRequestSchema, createStripeMembershipCheckoutSession } from './stripeMembershipCheckout.js';
import { createStripeMembershipCustomerPortalSession } from './stripeMembershipPortal.js';
import { syncAppleStoreKitPurchase } from './appleStoreKitSync.js';
import { syncGooglePlayPurchase } from './googlePlayBillingSync.js';

export const subscriptionsRoutes = Router();

subscriptionsRoutes.use(requireAuth);

type SubscriptionSnapshotRow = {
  id: string;
  accountKind: string;
  professionalStatus: string;
  professionalStatusUpdatedAt: Date | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionStatusUpdatedAt: Date | null;
  professionalProfileId: string | null;
  professionalProfileDisplayName: string | null;
  professionalProfileHeadline: string | null;
  professionalProfileBio: string | null;
  professionalProfileCategory: string | null;
  professionalProfileSpecialties: string[] | null;
  professionalProfileWebsiteUrl: string | null;
  professionalProfilePortfolioUrl: string | null;
  professionalProfileCountryCode: string | null;
  professionalProfilePreferredCurrency: string | null;
  professionalProfileStatus: string | null;
  professionalProfileStatusNote: string | null;
  professionalProfileReviewedAt: Date | null;
  subscriptionStateId: string | null;
  subscriptionStateTier: string | null;
  subscriptionStateStatus: string | null;
  subscriptionStateProvider: string | null;
  currentPeriodStartedAt: Date | null;
  currentPeriodEndsAt: Date | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
  pastDueAt: Date | null;
  expiresAt: Date | null;
  identityVerificationStateId: string | null;
  identityVerificationProvider: string | null;
  identityVerificationStatus: string | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  verificationExpiresAt: Date | null;
  rejectionReason: string | null;
};

function resolveRowMembershipEntitlement(row: SubscriptionSnapshotRow) {
  return resolveMembershipEntitlement({
    id: row.id,
    subscriptionTier: row.subscriptionTier,
    subscriptionStatus: row.subscriptionStatus,
    subscriptionStatusUpdatedAt: row.subscriptionStatusUpdatedAt,
    subscriptionState: row.subscriptionStateId ? {
      id: row.subscriptionStateId,
      tier: row.subscriptionStateTier,
      status: row.subscriptionStateStatus,
      provider: row.subscriptionStateProvider,
      currentPeriodStartedAt: row.currentPeriodStartedAt,
      currentPeriodEndsAt: row.currentPeriodEndsAt,
      trialStartedAt: row.trialStartedAt,
      trialEndsAt: row.trialEndsAt,
      canceledAt: row.canceledAt,
      pastDueAt: row.pastDueAt,
      expiresAt: row.expiresAt,
    } : null,
  });
}

function hasProAccess(row: SubscriptionSnapshotRow) {
  const entitlement = resolveRowMembershipEntitlement(row);
  return row.professionalStatus === 'verified'
    && entitlement.accessState.subscriptionTier === 'pro'
    && (entitlement.accessState.subscriptionStatus === 'trialing' || entitlement.accessState.subscriptionStatus === 'active');
}

function proAccessBlockers(row: SubscriptionSnapshotRow) {
  const entitlement = resolveRowMembershipEntitlement(row);
  const blockers: string[] = [];
  if (row.professionalStatus !== 'verified') blockers.push('identity_not_verified');
  if (entitlement.accessState.subscriptionTier !== 'pro') blockers.push('not_on_pro_tier');
  if (entitlement.accessState.subscriptionStatus !== 'trialing' && entitlement.accessState.subscriptionStatus !== 'active') blockers.push('subscription_not_active');
  return blockers;
}

function normalizeSnapshot(row: SubscriptionSnapshotRow) {
  const entitlement = resolveRowMembershipEntitlement(row);
  const proAccess = hasProAccess(row);

  return {
    config: {
      subscriptionsEnabled: env.subscriptionsEnabled,
      proAccountsEnabled: env.proAccountsEnabled,
      proAccountsVisible: env.proAccountsVisible,
      proTrialsEnabled: env.proTrialsEnabled,
      identityVerificationEnabled: env.identityVerificationEnabled,
      monthlyPriceCents: env.proMonthlyPriceCents,
      monthlyPriceCurrency: env.proMonthlyPriceCurrency,
      trialDays: env.proTrialDays,
    },
    state: {
      accountKind: row.accountKind,
      professionalStatus: row.professionalStatus,
      professionalStatusUpdatedAt: row.professionalStatusUpdatedAt,
      subscriptionTier: row.subscriptionTier,
      subscriptionStatus: row.subscriptionStatus,
      subscriptionStatusUpdatedAt: row.subscriptionStatusUpdatedAt,
    },
    professionalProfile: row.professionalProfileId ? {
      id: row.professionalProfileId,
      displayName: row.professionalProfileDisplayName,
      headline: row.professionalProfileHeadline,
      professionalBio: row.professionalProfileBio,
      category: row.professionalProfileCategory,
      specialties: row.professionalProfileSpecialties ?? [],
      websiteUrl: row.professionalProfileWebsiteUrl,
      portfolioUrl: row.professionalProfilePortfolioUrl,
      countryCode: row.professionalProfileCountryCode,
      preferredCurrency: row.professionalProfilePreferredCurrency,
      status: row.professionalProfileStatus,
      statusNote: row.professionalProfileStatusNote,
      reviewedAt: row.professionalProfileReviewedAt,
    } : null,
    subscriptionState: row.subscriptionStateId ? {
      id: row.subscriptionStateId,
      tier: row.subscriptionStateTier,
      status: row.subscriptionStateStatus,
      provider: row.subscriptionStateProvider,
      currentPeriodStartedAt: row.currentPeriodStartedAt,
      currentPeriodEndsAt: row.currentPeriodEndsAt,
      trialStartedAt: row.trialStartedAt,
      trialEndsAt: row.trialEndsAt,
      canceledAt: row.canceledAt,
      pastDueAt: row.pastDueAt,
      expiresAt: row.expiresAt,
    } : null,
    identityVerificationState: row.identityVerificationStateId ? {
      id: row.identityVerificationStateId,
      provider: row.identityVerificationProvider,
      status: row.identityVerificationStatus,
      submittedAt: row.submittedAt,
      verifiedAt: row.verifiedAt,
      rejectedAt: row.rejectedAt,
      expiresAt: row.verificationExpiresAt,
      rejectionReason: row.rejectionReason,
    } : null,
    entitlement: serializeMembershipEntitlement(entitlement),
    access: {
      hasProAccess: proAccess,
      blockers: proAccess ? [] : proAccessBlockers(row),
    },
  };
}


subscriptionsRoutes.post('/checkout-session', requireActiveAccount, asyncRoute(async (req, res) => {
  const body = createMembershipCheckoutSessionRequestSchema.parse(req.body);
  const session = await createStripeMembershipCheckoutSession(req.user!.id, body.productHandle);
  res.json(session);
}));

subscriptionsRoutes.post('/customer-portal-session', requireActiveAccount, asyncRoute(async (req, res) => {
  const session = await createStripeMembershipCustomerPortalSession(req.user!.id);
  res.json(session);
}));

subscriptionsRoutes.post('/apple/storekit-sync', requireActiveAccount, asyncRoute(async (req, res) => {
  const result = await syncAppleStoreKitPurchase(req.user!.id, req.body);
  res.json(result);
}));

subscriptionsRoutes.post('/google/play-sync', requireActiveAccount, asyncRoute(async (req, res) => {
  const result = await syncGooglePlayPurchase(req.user!.id, req.body);
  res.json(result);
}));

subscriptionsRoutes.get('/me', asyncRoute(async (req, res) => {
  const rows = await prisma.$queryRaw<SubscriptionSnapshotRow[]>`
    SELECT
      u."id",
      u."accountKind"::text AS "accountKind",
      u."professionalStatus"::text AS "professionalStatus",
      u."professionalStatusUpdatedAt",
      u."subscriptionTier"::text AS "subscriptionTier",
      u."subscriptionStatus"::text AS "subscriptionStatus",
      u."subscriptionStatusUpdatedAt",
      pp."id" AS "professionalProfileId",
      pp."displayName" AS "professionalProfileDisplayName",
      pp."headline" AS "professionalProfileHeadline",
      pp."professionalBio" AS "professionalProfileBio",
      pp."category" AS "professionalProfileCategory",
      pp."specialties" AS "professionalProfileSpecialties",
      pp."websiteUrl" AS "professionalProfileWebsiteUrl",
      pp."portfolioUrl" AS "professionalProfilePortfolioUrl",
      pp."countryCode" AS "professionalProfileCountryCode",
      pp."preferredCurrency" AS "professionalProfilePreferredCurrency",
      pp."status"::text AS "professionalProfileStatus",
      pp."statusNote" AS "professionalProfileStatusNote",
      pp."reviewedAt" AS "professionalProfileReviewedAt",
      ss."id" AS "subscriptionStateId",
      ss."tier"::text AS "subscriptionStateTier",
      ss."status"::text AS "subscriptionStateStatus",
      ss."provider" AS "subscriptionStateProvider",
      ss."currentPeriodStartedAt",
      ss."currentPeriodEndsAt",
      ss."trialStartedAt",
      ss."trialEndsAt",
      ss."canceledAt",
      ss."pastDueAt",
      ss."expiresAt",
      ivs."id" AS "identityVerificationStateId",
      ivs."provider"::text AS "identityVerificationProvider",
      ivs."status"::text AS "identityVerificationStatus",
      ivs."submittedAt",
      ivs."verifiedAt",
      ivs."rejectedAt",
      ivs."expiresAt" AS "verificationExpiresAt",
      ivs."rejectionReason"
    FROM "User" u
    LEFT JOIN "ProfessionalProfile" pp ON pp."userId" = u."id"
    LEFT JOIN "SubscriptionState" ss ON ss."userId" = u."id"
    LEFT JOIN "IdentityVerificationState" ivs ON ivs."userId" = u."id"
    WHERE u."id" = ${req.user!.id}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(normalizeSnapshot(row));
}));
