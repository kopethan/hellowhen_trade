import {
  getMembershipProductMetadata,
  normalizeMembershipProductHandle,
  type MembershipProductHandle,
  type SubscriptionStatus,
} from '@hellowhen/shared';
import { syncAppleStoreKitPurchaseRequestSchema, type AppleStoreKitSyncResponse } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

function dateFromMs(value: number | null | undefined): Date | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value);
}

function productHandleFromAppleProductId(productId: string): MembershipProductHandle | null {
  const handles: MembershipProductHandle[] = [
    'hellowhen_plus_monthly',
    'hellowhen_plus_yearly',
    'hellowhen_pro_monthly',
    'hellowhen_pro_yearly',
  ];
  return handles.find((handle) => getMembershipProductMetadata(handle)?.providerProductKeys.appleProductId === productId) ?? normalizeMembershipProductHandle(productId);
}

async function applyAppleMembershipGrant(userId: string, options: {
  productHandle: MembershipProductHandle;
  transactionId: string;
  originalTransactionId: string | null;
  currentPeriodEndsAt: Date | null;
  subscriptionStatus: SubscriptionStatus;
}) {
  const product = getMembershipProductMetadata(options.productHandle);
  if (!product) return;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionState.upsert({
      where: { userId },
      create: {
        userId,
        tier: product.tier,
        status: options.subscriptionStatus,
        provider: 'apple_app_store',
        externalCustomerId: options.originalTransactionId,
        externalSubscriptionId: options.transactionId,
        currentPeriodStartedAt: null,
        currentPeriodEndsAt: options.currentPeriodEndsAt,
        trialStartedAt: null,
        trialEndsAt: null,
        canceledAt: options.subscriptionStatus === 'canceled' ? now : null,
        pastDueAt: options.subscriptionStatus === 'past_due' ? now : null,
        expiresAt: options.currentPeriodEndsAt,
        lastSyncedAt: now,
        adminNote: `Apple StoreKit Membership sync accepted ${product.handle}.`,
      },
      update: {
        tier: product.tier,
        status: options.subscriptionStatus,
        provider: 'apple_app_store',
        externalCustomerId: options.originalTransactionId,
        externalSubscriptionId: options.transactionId,
        currentPeriodEndsAt: options.currentPeriodEndsAt,
        canceledAt: options.subscriptionStatus === 'canceled' ? now : null,
        pastDueAt: options.subscriptionStatus === 'past_due' ? now : null,
        expiresAt: options.currentPeriodEndsAt,
        lastSyncedAt: now,
        adminNote: `Apple StoreKit Membership sync accepted ${product.handle}.`,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { subscriptionTier: product.tier, subscriptionStatus: options.subscriptionStatus, subscriptionStatusUpdatedAt: now },
    });
  });
}

export async function syncAppleStoreKitPurchase(userId: string, input: unknown): Promise<AppleStoreKitSyncResponse> {
  const body = syncAppleStoreKitPurchaseRequestSchema.parse(input);
  const productHandle = productHandleFromAppleProductId(body.productId);
  const product = getMembershipProductMetadata(productHandle);
  if (!env.subscriptionsEnabled || !env.plusEnabled || !env.appleMembershipPurchaseSyncEnabled) {
    return { provider: 'apple_app_store', mode: 'storekit_sync', testMode: true, accepted: false, grantApplied: false, status: 'not_configured', message: 'Apple StoreKit Membership sync is disabled.', productId: body.productId };
  }
  if (!productHandle || !product) {
    return { provider: 'apple_app_store', mode: 'storekit_sync', testMode: true, accepted: false, grantApplied: false, status: 'invalid', message: 'Apple product ID is not mapped to a Hellowhen Membership product.', productId: body.productId };
  }
  if (!env.appleMembershipServerValidationEnabled) {
    return { provider: 'apple_app_store', mode: 'storekit_sync', testMode: true, accepted: false, grantApplied: false, status: 'pending_validation', message: 'StoreKit purchase received, but server validation is not enabled yet.', productId: body.productId, productHandle, tier: product.tier, originalTransactionId: body.originalTransactionId ?? undefined };
  }
  const periodEnd = dateFromMs(body.expirationDate);
  const isActive = !periodEnd || periodEnd.getTime() > Date.now();
  if (!isActive) {
    return { provider: 'apple_app_store', mode: 'storekit_sync', testMode: true, accepted: false, grantApplied: false, status: 'expired', message: 'Apple transaction is expired.', productId: body.productId, productHandle, tier: product.tier, subscriptionStatus: 'expired', originalTransactionId: body.originalTransactionId ?? undefined, currentPeriodEndsAt: periodEnd?.toISOString() ?? null };
  }
  await applyAppleMembershipGrant(userId, {
    productHandle,
    transactionId: body.transactionId,
    originalTransactionId: body.originalTransactionId ?? body.appAccountToken ?? null,
    currentPeriodEndsAt: periodEnd,
    subscriptionStatus: 'active',
  });
  return { provider: 'apple_app_store', mode: 'storekit_sync', testMode: true, accepted: true, grantApplied: true, status: 'accepted', message: 'Apple StoreKit Membership purchase synced.', productId: body.productId, productHandle, tier: product.tier, subscriptionStatus: 'active', originalTransactionId: body.originalTransactionId ?? undefined, currentPeriodEndsAt: periodEnd?.toISOString() ?? null };
}
