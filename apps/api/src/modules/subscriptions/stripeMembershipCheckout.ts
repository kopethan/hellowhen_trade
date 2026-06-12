import type Stripe from 'stripe';
import { createMembershipCheckoutSessionRequestSchema, type MembershipCheckoutProductHandle } from '@hellowhen/contracts';
import { getMembershipProductMetadata } from '@hellowhen/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { getStripe, isStripeConfigured } from '../credits/stripeClient.js';

export { createMembershipCheckoutSessionRequestSchema };

type StripeMembershipCheckoutErrorCode =
  | 'stripe_membership_checkout_disabled'
  | 'stripe_membership_checkout_not_configured'
  | 'stripe_membership_product_unavailable'
  | 'stripe_membership_price_not_configured'
  | 'stripe_membership_session_failed';

class StripeMembershipCheckoutError extends Error {
  statusCode: number;
  code: StripeMembershipCheckoutErrorCode;
  publicMessage: string;

  constructor(code: StripeMembershipCheckoutErrorCode, message: string, statusCode = 503) {
    super(message);
    this.name = 'StripeMembershipCheckoutError';
    this.code = code;
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

type CheckoutUser = {
  id: string;
  email: string;
  profile: { displayName: string | null } | null;
  subscriptionState: {
    provider: string | null;
    externalCustomerId: string | null;
  } | null;
};

const stripeCheckoutSessionPlaceholder = '{CHECKOUT_SESSION_ID}';

function requireStripeMembershipCheckout() {
  const stripe = getStripe();
  if (!env.stripeMembershipCheckoutEnabled) {
    throw new StripeMembershipCheckoutError('stripe_membership_checkout_disabled', 'Stripe Membership checkout is not enabled.', 403);
  }
  if (!isStripeConfigured() || !stripe) {
    throw new StripeMembershipCheckoutError('stripe_membership_checkout_not_configured', 'Stripe test mode is not configured for Membership checkout.');
  }
  return stripe;
}

function safeMembershipReturnPath(value: string | undefined, fallback: string) {
  const raw = (value ?? fallback).trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

function webAppUrl(pathname: string) {
  return new URL(pathname, env.webAppUrl).toString()
    .replace('%7BCHECKOUT_SESSION_ID%7D', stripeCheckoutSessionPlaceholder)
    .replace('%7bCHECKOUT_SESSION_ID%7d', stripeCheckoutSessionPlaceholder);
}

function getConfiguredPriceId(productHandle: MembershipCheckoutProductHandle) {
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

function isConfiguredStripePriceId(value: string) {
  const raw = value.trim();
  return raw.startsWith('price_') && !raw.includes('replace_me') && !raw.includes('change-me');
}

function assertProductAvailable(productHandle: MembershipCheckoutProductHandle) {
  const product = getMembershipProductMetadata(productHandle);
  if (!product) {
    throw new StripeMembershipCheckoutError('stripe_membership_product_unavailable', 'This Membership product is not available.', 400);
  }
  if (product.tier === 'plus' && !env.plusEnabled) {
    throw new StripeMembershipCheckoutError('stripe_membership_product_unavailable', 'Plus Membership is not enabled.', 403);
  }
  if (product.tier === 'pro' && !env.proAccountsEnabled) {
    throw new StripeMembershipCheckoutError('stripe_membership_product_unavailable', 'Pro Membership is not enabled.', 403);
  }
  const priceId = getConfiguredPriceId(productHandle);
  if (!isConfiguredStripePriceId(priceId)) {
    throw new StripeMembershipCheckoutError('stripe_membership_price_not_configured', 'Stripe price ID is not configured for this Membership product.');
  }
  return { product, priceId };
}

async function upsertStripeCustomerId(user: CheckoutUser, stripe: Stripe) {
  const existingCustomerId = user.subscriptionState?.externalCustomerId?.trim();
  if (existingCustomerId?.startsWith('cus_')) return existingCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.profile?.displayName ?? undefined,
    metadata: {
      hellowhenUserId: user.id,
      membershipBilling: 'true',
    },
  });

  await prisma.subscriptionState.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tier: 'free',
      status: 'none',
      provider: 'stripe',
      externalCustomerId: customer.id,
      lastSyncedAt: new Date(),
      adminNote: 'Stripe Membership customer created. Entitlement sync waits for BILLING3 webhooks.',
    },
    update: {
      externalCustomerId: customer.id,
      lastSyncedAt: new Date(),
      adminNote: 'Stripe Membership customer created. Entitlement sync waits for BILLING3 webhooks.',
    },
  });

  return customer.id;
}

function checkoutMetadata(userId: string, productHandle: MembershipCheckoutProductHandle) {
  const product = getMembershipProductMetadata(productHandle)!;
  return {
    hellowhenUserId: userId,
    membershipSource: 'stripe',
    membershipPurchaseChannel: 'web',
    membershipProductHandle: product.handle,
    membershipTier: product.tier,
    membershipInterval: product.interval,
  };
}

export async function createStripeMembershipCheckoutSession(userId: string, productHandle: MembershipCheckoutProductHandle) {
  const stripe = requireStripeMembershipCheckout();
  const { product, priceId } = assertProductAvailable(productHandle);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
      subscriptionState: { select: { provider: true, externalCustomerId: true } },
    },
  });
  if (!user) {
    throw new StripeMembershipCheckoutError('stripe_membership_session_failed', 'Could not create a Membership checkout session.', 404);
  }

  const customerId = await upsertStripeCustomerId(user, stripe);
  const metadata = checkoutMetadata(user.id, productHandle);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: webAppUrl(safeMembershipReturnPath(env.stripeMembershipSuccessPath, '/account/membership?membership_checkout=success&session_id={CHECKOUT_SESSION_ID}')),
    cancel_url: webAppUrl(safeMembershipReturnPath(env.stripeMembershipCancelPath, '/account/membership?membership_checkout=cancelled')),
    allow_promotion_codes: true,
    metadata,
    subscription_data: { metadata },
  });

  if (!session.url) {
    throw new StripeMembershipCheckoutError('stripe_membership_session_failed', 'Stripe did not return a checkout URL.');
  }

  return {
    provider: 'stripe' as const,
    mode: 'subscription' as const,
    testMode: true,
    sessionId: session.id,
    checkoutUrl: session.url,
    productHandle: product.handle,
    tier: product.tier,
    interval: product.interval,
  };
}
