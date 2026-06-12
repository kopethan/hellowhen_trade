import type Stripe from 'stripe';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { getStripe, isStripeConfigured } from '../credits/stripeClient.js';

type StripeMembershipPortalErrorCode =
  | 'stripe_membership_portal_disabled'
  | 'stripe_membership_portal_not_configured'
  | 'stripe_membership_portal_customer_missing'
  | 'stripe_membership_portal_session_failed';

class StripeMembershipPortalError extends Error {
  statusCode: number;
  code: StripeMembershipPortalErrorCode;
  publicMessage: string;

  constructor(code: StripeMembershipPortalErrorCode, message: string, statusCode = 503) {
    super(message);
    this.name = 'StripeMembershipPortalError';
    this.code = code;
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

function requireStripeMembershipPortal() {
  const stripe = getStripe();
  if (!env.stripeMembershipPortalEnabled) {
    throw new StripeMembershipPortalError('stripe_membership_portal_disabled', 'Stripe Membership customer portal is not enabled.', 403);
  }
  if (!isStripeConfigured() || !stripe) {
    throw new StripeMembershipPortalError('stripe_membership_portal_not_configured', 'Stripe test mode is not configured for Membership customer portal.');
  }
  return stripe;
}

function safeMembershipReturnPath(value: string | undefined, fallback: string) {
  const raw = (value ?? fallback).trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

function webAppUrl(pathname: string) {
  return new URL(pathname, env.webAppUrl).toString();
}

async function getStripeMembershipCustomerId(userId: string) {
  const state = await prisma.subscriptionState.findUnique({
    where: { userId },
    select: {
      provider: true,
      externalCustomerId: true,
      externalSubscriptionId: true,
    },
  });
  const customerId = state?.provider === 'stripe' ? state.externalCustomerId?.trim() : '';
  if (!customerId?.startsWith('cus_')) return null;
  return {
    customerId,
    subscriptionId: state?.externalSubscriptionId ?? null,
  };
}

export async function createStripeMembershipCustomerPortalSession(userId: string) {
  const stripe = requireStripeMembershipPortal();
  const membershipCustomer = await getStripeMembershipCustomerId(userId);
  if (!membershipCustomer) {
    throw new StripeMembershipPortalError(
      'stripe_membership_portal_customer_missing',
      'No Stripe Membership customer is attached to this account yet.',
      409,
    );
  }

  let session: Stripe.BillingPortal.Session;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: membershipCustomer.customerId,
      return_url: webAppUrl(safeMembershipReturnPath(env.stripeMembershipPortalReturnPath, '/account/membership?membership_portal=return')),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe did not create a customer portal session.';
    throw new StripeMembershipPortalError('stripe_membership_portal_session_failed', message);
  }

  if (!session.url) {
    throw new StripeMembershipPortalError('stripe_membership_portal_session_failed', 'Stripe did not return a customer portal URL.');
  }

  return {
    provider: 'stripe' as const,
    mode: 'customer_portal' as const,
    testMode: true,
    sessionId: session.id,
    portalUrl: session.url,
  };
}
