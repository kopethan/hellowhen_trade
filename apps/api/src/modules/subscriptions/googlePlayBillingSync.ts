import crypto from 'node:crypto';
import {
  getMembershipProductMetadata,
  normalizeMembershipProductHandle,
  type MembershipProductHandle,
  type SubscriptionStatus,
} from '@hellowhen/shared';
import { googlePlayPurchaseSyncRequestSchema, type GooglePlaySyncResponse } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

type GoogleSubscriptionV2 = {
  kind?: string;
  regionCode?: string;
  latestOrderId?: string;
  subscriptionState?: string;
  startTime?: string;
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }>;
};

type GoogleAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n').trim();
}

function productHandleFromGoogleProductId(productId: string): MembershipProductHandle | null {
  const handles: MembershipProductHandle[] = [
    'hellowhen_plus_monthly',
    'hellowhen_plus_yearly',
    'hellowhen_pro_monthly',
    'hellowhen_pro_yearly',
  ];
  return handles.find((handle) => getMembershipProductMetadata(handle)?.providerProductKeys.googleProductId === productId) ?? normalizeMembershipProductHandle(productId);
}

function isoToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusFromGoogleSubscription(subscription: GoogleSubscriptionV2, expiry: Date | null): SubscriptionStatus {
  const state = subscription.subscriptionState;
  const expiryIsFuture = Boolean(expiry && expiry.getTime() > Date.now());
  if (state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') return expiryIsFuture ? 'active' : 'expired';
  if (state === 'SUBSCRIPTION_STATE_ON_HOLD' || state === 'SUBSCRIPTION_STATE_PAUSED' || state === 'SUBSCRIPTION_STATE_PENDING') return 'past_due';
  if (state === 'SUBSCRIPTION_STATE_CANCELED') return expiryIsFuture ? 'active' : 'canceled';
  if (state === 'SUBSCRIPTION_STATE_EXPIRED') return 'expired';
  return expiryIsFuture ? 'active' : 'expired';
}

function syncStatusFromSubscriptionStatus(status: SubscriptionStatus): GooglePlaySyncResponse['status'] {
  if (status === 'active' || status === 'trialing') return 'accepted';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled') return 'canceled';
  if (status === 'expired') return 'expired';
  return 'invalid';
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: env.googlePlayMembershipServiceAccountEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), normalizePrivateKey(env.googlePlayMembershipServiceAccountPrivateKey));
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  const payload = await response.json() as GoogleAccessTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'google_play_access_token_failed');
  }
  return payload.access_token;
}

async function fetchGoogleSubscription(packageName: string, purchaseToken: string) {
  const accessToken = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`google_play_subscription_validation_failed_${response.status}`);
  return await response.json() as GoogleSubscriptionV2;
}

async function applyGoogleMembershipGrant(userId: string, options: {
  productHandle: MembershipProductHandle;
  orderId: string | null;
  purchaseToken: string;
  currentPeriodStartedAt: Date | null;
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
        provider: 'google_play',
        externalCustomerId: options.orderId,
        externalSubscriptionId: options.purchaseToken,
        currentPeriodStartedAt: options.currentPeriodStartedAt,
        currentPeriodEndsAt: options.currentPeriodEndsAt,
        trialStartedAt: null,
        trialEndsAt: null,
        canceledAt: options.subscriptionStatus === 'canceled' ? now : null,
        pastDueAt: options.subscriptionStatus === 'past_due' ? now : null,
        expiresAt: options.currentPeriodEndsAt,
        lastSyncedAt: now,
        adminNote: `Google Play Membership sync accepted ${product.handle}.`,
      },
      update: {
        tier: product.tier,
        status: options.subscriptionStatus,
        provider: 'google_play',
        externalCustomerId: options.orderId,
        externalSubscriptionId: options.purchaseToken,
        currentPeriodStartedAt: options.currentPeriodStartedAt,
        currentPeriodEndsAt: options.currentPeriodEndsAt,
        canceledAt: options.subscriptionStatus === 'canceled' ? now : null,
        pastDueAt: options.subscriptionStatus === 'past_due' ? now : null,
        expiresAt: options.currentPeriodEndsAt,
        lastSyncedAt: now,
        adminNote: `Google Play Membership sync accepted ${product.handle}.`,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { subscriptionTier: product.tier, subscriptionStatus: options.subscriptionStatus, subscriptionStatusUpdatedAt: now },
    });
  });
}

export async function syncGooglePlayPurchase(userId: string, input: unknown): Promise<GooglePlaySyncResponse> {
  const body = googlePlayPurchaseSyncRequestSchema.parse(input);
  const packageName = body.packageName?.trim() || env.googlePlayMembershipPackageName;
  const requestedHandle = productHandleFromGoogleProductId(body.productId);
  const requestedProduct = getMembershipProductMetadata(requestedHandle);
  if (!env.subscriptionsEnabled || !env.plusEnabled || !env.googlePlayMembershipPurchaseSyncEnabled) {
    return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: false, grantApplied: false, status: 'not_configured', message: 'Google Play Membership sync is disabled.', productId: body.productId, orderId: body.orderId ?? null };
  }
  if (!requestedHandle || !requestedProduct) {
    return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: false, grantApplied: false, status: 'invalid', message: 'Google product ID is not mapped to a Hellowhen Membership product.', productId: body.productId, orderId: body.orderId ?? null };
  }
  if (!env.googlePlayMembershipServerValidationEnabled) {
    return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: false, grantApplied: false, status: 'pending_validation', message: 'Google Play purchase received, but server validation is not enabled yet.', productId: body.productId, productHandle: requestedHandle, tier: requestedProduct.tier, orderId: body.orderId ?? null };
  }
  if (!packageName || !env.googlePlayMembershipServiceAccountEmail || !env.googlePlayMembershipServiceAccountPrivateKey) {
    return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: false, grantApplied: false, status: 'not_configured', message: 'Google Play server validation credentials are missing.', productId: body.productId, productHandle: requestedHandle, tier: requestedProduct.tier, orderId: body.orderId ?? null };
  }

  let subscription: GoogleSubscriptionV2;
  try {
    subscription = await fetchGoogleSubscription(packageName, body.purchaseToken);
  } catch (error) {
    return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: false, grantApplied: false, status: 'invalid', message: error instanceof Error ? error.message : 'Google Play validation failed.', productId: body.productId, productHandle: requestedHandle, tier: requestedProduct.tier, orderId: body.orderId ?? null };
  }

  const lineItem = subscription.lineItems?.find((item) => item.productId === body.productId) ?? subscription.lineItems?.[0];
  const validatedProductId = lineItem?.productId ?? body.productId;
  const productHandle = productHandleFromGoogleProductId(validatedProductId);
  const product = getMembershipProductMetadata(productHandle);
  if (!productHandle || !product || productHandle !== requestedHandle) {
    return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: false, grantApplied: false, status: 'invalid', message: 'Google Play subscription product does not match the requested Membership product.', productId: validatedProductId, orderId: subscription.latestOrderId ?? body.orderId ?? null };
  }

  const currentPeriodStartedAt = isoToDate(subscription.startTime);
  const currentPeriodEndsAt = isoToDate(lineItem?.expiryTime);
  const subscriptionStatus = statusFromGoogleSubscription(subscription, currentPeriodEndsAt);
  const syncStatus = syncStatusFromSubscriptionStatus(subscriptionStatus);
  const orderId = subscription.latestOrderId ?? body.orderId ?? null;

  if (syncStatus !== 'accepted') {
    return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: false, grantApplied: false, status: syncStatus, message: `Google Play subscription is ${subscription.subscriptionState ?? 'not active'}.`, productId: validatedProductId, productHandle, tier: product.tier, subscriptionStatus, orderId, currentPeriodEndsAt: currentPeriodEndsAt?.toISOString() ?? null };
  }

  await applyGoogleMembershipGrant(userId, { productHandle, orderId, purchaseToken: body.purchaseToken, currentPeriodStartedAt, currentPeriodEndsAt, subscriptionStatus });
  return { provider: 'google_play', mode: 'google_play_sync', testMode: true, accepted: true, grantApplied: true, status: 'accepted', message: 'Google Play Membership purchase synced.', productId: validatedProductId, productHandle, tier: product.tier, subscriptionStatus, orderId, currentPeriodEndsAt: currentPeriodEndsAt?.toISOString() ?? null };
}
