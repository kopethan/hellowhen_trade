import { Router } from 'express';
import type Stripe from 'stripe';
import {
  getMembershipProductMetadata,
  normalizeMembershipProductHandle,
  type MembershipProductHandle,
  type SubscriptionStatus,
} from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { getStripe, isStripeConfigured } from '../credits/stripeClient.js';

export const stripeMembershipWebhookRoutes = Router();

type StripeMembershipSyncResult = {
  handled: boolean;
  reason: string;
  userId?: string | null;
  productHandle?: MembershipProductHandle | null;
  subscriptionStatus?: SubscriptionStatus | null;
};

type StripeMembershipSubscription = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
  trial_start?: number | null;
  trial_end?: number | null;
  cancel_at?: number | null;
  canceled_at?: number | null;
  ended_at?: number | null;
};

type StripeMembershipInvoice = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
};

function jsonPayload(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function stripeUnixToDate(value: number | null | undefined): Date | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000);
}

function getConfiguredPriceId(productHandle: MembershipProductHandle) {
  switch (productHandle) {
    case 'hellowhen_plus_monthly':
      return env.stripePlusMonthlyPriceId;
    case 'hellowhen_plus_yearly':
      return env.stripePlusYearlyPriceId;
    case 'hellowhen_pro_monthly':
      return env.stripeProMonthlyPriceId;
    case 'hellowhen_pro_yearly':
      return env.stripeProYearlyPriceId;
    default:
      return '';
  }
}

function getMembershipProductHandleFromStripePriceId(priceId: string | null | undefined): MembershipProductHandle | null {
  const raw = priceId?.trim();
  if (!raw) return null;
  const handles: MembershipProductHandle[] = [
    'hellowhen_plus_monthly',
    'hellowhen_plus_yearly',
    'hellowhen_pro_monthly',
    'hellowhen_pro_yearly',
  ];
  return handles.find((handle) => getConfiguredPriceId(handle) === raw) ?? null;
}

function getSubscriptionPrimaryItem(subscription: StripeMembershipSubscription) {
  return subscription.items?.data?.[0] as (Stripe.SubscriptionItem & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  }) | undefined;
}

function getSubscriptionPriceId(subscription: StripeMembershipSubscription) {
  return getSubscriptionPrimaryItem(subscription)?.price?.id ?? null;
}

function getSubscriptionCustomerId(subscription: StripeMembershipSubscription) {
  return typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;
}

function getInvoiceCustomerId(invoice: StripeMembershipInvoice) {
  return typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
}

function getInvoiceSubscriptionId(invoice: StripeMembershipInvoice) {
  return typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;
}

function getSubscriptionUserId(subscription: StripeMembershipSubscription, fallbackUserId?: string | null) {
  return subscription.metadata?.hellowhenUserId?.trim()
    || subscription.metadata?.userId?.trim()
    || fallbackUserId?.trim()
    || null;
}

function getSessionUserId(session: Stripe.Checkout.Session) {
  return session.metadata?.hellowhenUserId?.trim()
    || session.client_reference_id?.trim()
    || null;
}

function getSessionSubscriptionId(session: Stripe.Checkout.Session) {
  return typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
}

function getMembershipProductHandleForSubscription(subscription: StripeMembershipSubscription) {
  const metadataHandle = normalizeMembershipProductHandle(subscription.metadata?.membershipProductHandle);
  if (metadataHandle) return metadataHandle;
  return getMembershipProductHandleFromStripePriceId(getSubscriptionPriceId(subscription));
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status | string | null | undefined): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'paused':
      return 'past_due';
    case 'incomplete_expired':
      return 'expired';
    case 'canceled':
      return 'canceled';
    default:
      return 'none';
  }
}

function shouldTreatSubscriptionAsMembership(subscription: StripeMembershipSubscription) {
  if (subscription.metadata?.membershipSource === 'stripe') return true;
  if (normalizeMembershipProductHandle(subscription.metadata?.membershipProductHandle)) return true;
  return Boolean(getMembershipProductHandleFromStripePriceId(getSubscriptionPriceId(subscription)));
}

async function recordStripeMembershipEvent(event: Stripe.Event) {
  const object = event.data.object as { id?: string };
  const existing = await prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.processingStatus === 'processed') return { record: existing, duplicate: true };
  const record = await prisma.stripeEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      type: event.type,
      livemode: event.livemode,
      objectId: object.id ?? null,
      payload: jsonPayload(event),
      processingStatus: 'received',
    },
    update: {
      type: event.type,
      livemode: event.livemode,
      objectId: object.id ?? null,
      payload: jsonPayload(event),
      processingStatus: 'received',
      error: null,
    },
  });
  return { record, duplicate: false };
}

async function syncStripeMembershipSubscription(
  subscription: StripeMembershipSubscription,
  options: { fallbackUserId?: string | null; eventType?: string } = {},
): Promise<StripeMembershipSyncResult> {
  if (!shouldTreatSubscriptionAsMembership(subscription)) {
    return { handled: false, reason: 'not_membership_subscription' };
  }

  const productHandle = getMembershipProductHandleForSubscription(subscription);
  const product = getMembershipProductMetadata(productHandle);
  if (!product) return { handled: false, reason: 'membership_product_unmapped' };

  const stripeCustomerId = getSubscriptionCustomerId(subscription);
  const stripeSubscriptionId = subscription.id;
  const userIdFromMetadata = getSubscriptionUserId(subscription, options.fallbackUserId);
  const existingState = await prisma.subscriptionState.findFirst({
    where: {
      OR: [
        { externalSubscriptionId: stripeSubscriptionId },
        ...(stripeCustomerId ? [{ externalCustomerId: stripeCustomerId }] : []),
      ],
    },
    select: { userId: true },
  });
  const userId = userIdFromMetadata ?? existingState?.userId ?? null;
  if (!userId) return { handled: false, reason: 'membership_user_unresolved', productHandle };

  const stripeStatus = mapStripeSubscriptionStatus(subscription.status);
  const primaryItem = getSubscriptionPrimaryItem(subscription);
  const periodStart = stripeUnixToDate(subscription.current_period_start ?? primaryItem?.current_period_start);
  const periodEnd = stripeUnixToDate(subscription.current_period_end ?? primaryItem?.current_period_end);
  const trialStart = stripeUnixToDate(subscription.trial_start);
  const trialEnd = stripeUnixToDate(subscription.trial_end);
  const canceledAt = stripeUnixToDate(subscription.canceled_at ?? subscription.cancel_at ?? subscription.ended_at);
  const endedAt = stripeUnixToDate(subscription.ended_at);
  const expiresAt = endedAt ?? periodEnd ?? trialEnd;
  const pastDueAt = stripeStatus === 'past_due' ? new Date() : null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionState.upsert({
      where: { userId },
      create: {
        userId,
        tier: product.tier,
        status: stripeStatus,
        provider: 'stripe',
        externalCustomerId: stripeCustomerId,
        externalSubscriptionId: stripeSubscriptionId,
        currentPeriodStartedAt: periodStart,
        currentPeriodEndsAt: periodEnd,
        trialStartedAt: trialStart,
        trialEndsAt: trialEnd,
        canceledAt,
        pastDueAt,
        expiresAt,
        lastSyncedAt: now,
        adminNote: `Stripe Membership webhook synced ${options.eventType ?? 'subscription'} for ${product.handle}.`,
      },
      update: {
        tier: product.tier,
        status: stripeStatus,
        provider: 'stripe',
        externalCustomerId: stripeCustomerId,
        externalSubscriptionId: stripeSubscriptionId,
        currentPeriodStartedAt: periodStart,
        currentPeriodEndsAt: periodEnd,
        trialStartedAt: trialStart,
        trialEndsAt: trialEnd,
        canceledAt,
        pastDueAt,
        expiresAt,
        lastSyncedAt: now,
        adminNote: `Stripe Membership webhook synced ${options.eventType ?? 'subscription'} for ${product.handle}.`,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: product.tier,
        subscriptionStatus: stripeStatus,
        subscriptionStatusUpdatedAt: now,
      },
    });
  });

  return {
    handled: true,
    reason: 'membership_subscription_synced',
    userId,
    productHandle: product.handle,
    subscriptionStatus: stripeStatus,
  };
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<StripeMembershipSyncResult> {
  const metadataProductHandle = normalizeMembershipProductHandle(session.metadata?.membershipProductHandle);
  if (session.metadata?.membershipSource !== 'stripe' && !metadataProductHandle) {
    return { handled: false, reason: 'not_membership_checkout_session' };
  }

  const stripe = getStripe();
  if (!stripe) return { handled: false, reason: 'stripe_not_configured' };
  const subscriptionId = getSessionSubscriptionId(session);
  if (!subscriptionId) return { handled: false, reason: 'checkout_session_missing_subscription', productHandle: metadataProductHandle };

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncStripeMembershipSubscription(subscription as StripeMembershipSubscription, {
    fallbackUserId: getSessionUserId(session),
    eventType: 'checkout.session.completed',
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription, eventType: string): Promise<StripeMembershipSyncResult> {
  return syncStripeMembershipSubscription(subscription as StripeMembershipSubscription, { eventType });
}

async function handleInvoicePaymentFailed(invoice: StripeMembershipInvoice): Promise<StripeMembershipSyncResult> {
  const stripe = getStripe();
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (stripe && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return syncStripeMembershipSubscription(subscription as StripeMembershipSubscription, { eventType: 'invoice.payment_failed' });
  }

  const stripeCustomerId = getInvoiceCustomerId(invoice);
  if (!stripeCustomerId) return { handled: false, reason: 'invoice_missing_customer' };

  const state = await prisma.subscriptionState.findFirst({ where: { externalCustomerId: stripeCustomerId, provider: 'stripe' } });
  if (!state) return { handled: false, reason: 'membership_state_not_found_for_invoice' };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionState.update({
      where: { id: state.id },
      data: { status: 'past_due', pastDueAt: now, lastSyncedAt: now, adminNote: 'Stripe Membership invoice.payment_failed webhook marked subscription past due.' },
    });
    await tx.user.update({
      where: { id: state.userId },
      data: { subscriptionStatus: 'past_due', subscriptionStatusUpdatedAt: now },
    });
  });

  return {
    handled: true,
    reason: 'membership_invoice_marked_past_due',
    userId: state.userId,
    subscriptionStatus: 'past_due',
  };
}

stripeMembershipWebhookRoutes.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!env.subscriptionsEnabled) return res.status(503).json({ error: 'subscriptions_disabled' });
  if (!env.stripeMembershipWebhookEnabled) return res.status(503).json({ error: 'stripe_membership_webhook_disabled' });
  if (!isStripeConfigured() || !stripe || !env.stripeMembershipWebhookSecret || env.stripeMembershipWebhookSecret.includes('replace_me')) {
    return res.status(503).json({ error: 'stripe_membership_webhook_not_configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) return res.status(400).json({ error: 'missing_stripe_signature' });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'stripe_membership_webhook_raw_body_required' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeMembershipWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe signature';
    return res.status(400).json({ error: 'stripe_membership_signature_error', message });
  }

  const { record, duplicate } = await recordStripeMembershipEvent(event);
  if (duplicate) return res.json({ received: true, duplicate: true });

  try {
    let result: StripeMembershipSyncResult = { handled: false, reason: 'ignored' };
    if (event.type === 'checkout.session.completed') {
      result = await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      result = await handleSubscriptionEvent(event.data.object as Stripe.Subscription, event.type);
    } else if (event.type === 'invoice.payment_failed') {
      result = await handleInvoicePaymentFailed(event.data.object as StripeMembershipInvoice);
    }

    await prisma.stripeEvent.update({
      where: { id: record.id },
      data: {
        processingStatus: 'processed',
        processedAt: new Date(),
        error: result.handled ? null : result.reason,
      },
    });

    return res.json({ received: true, membership: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe Membership webhook processing failed';
    console.error('Stripe Membership webhook processing failed', error);
    await prisma.stripeEvent.update({ where: { id: record.id }, data: { processingStatus: 'failed', error: message } }).catch(() => null);
    return res.status(500).json({ error: 'stripe_membership_webhook_processing_failed' });
  }
});
