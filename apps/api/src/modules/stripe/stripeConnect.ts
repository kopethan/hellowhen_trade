import type Stripe from 'stripe';
import type { StripeConnectAccount, StripeConnectAccountStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { getStripe, isStripeConfigured } from '../credits/stripeClient.js';

type StripeConnectErrorCode = 'stripe_connect_not_configured' | 'stripe_connect_account_not_ready';

class StripeConnectError extends Error {
  statusCode: number;
  code: StripeConnectErrorCode;
  publicMessage: string;

  constructor(code: StripeConnectErrorCode, message: string, statusCode = 503) {
    super(message);
    this.name = 'StripeConnectError';
    this.code = code;
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

type TransferForPayoutInput = {
  userId: string;
  payoutId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
  currency: string;
};

export function isStripeConnectConfigured() {
  return env.stripeConnectEnabled && isStripeConfigured();
}

function requireStripeConnect() {
  const stripe = getStripe();
  if (!isStripeConnectConfigured() || !stripe) {
    throw new StripeConnectError('stripe_connect_not_configured', 'Stripe Connect test mode is not configured.');
  }
  return stripe;
}

function webAppUrl(pathname: string) {
  return new URL(pathname, env.webAppUrl).toString();
}

function stringArray(value: string[] | null | undefined) {
  return value ?? [];
}

function getAccountStatus(account: Stripe.Account): StripeConnectAccountStatus {
  const currentlyDue = stringArray(account.requirements?.currently_due);
  const pastDue = stringArray(account.requirements?.past_due);

  if (!account.details_submitted) return 'onboarding';
  if (account.payouts_enabled) return 'enabled';
  if (currentlyDue.length > 0 || pastDue.length > 0 || account.requirements?.disabled_reason) return 'restricted';
  return 'pending';
}

function accountData(account: Stripe.Account, existing?: StripeConnectAccount | null) {
  const now = new Date();
  const detailsSubmitted = Boolean(account.details_submitted);
  return {
    status: getAccountStatus(account),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted,
    currentlyDue: stringArray(account.requirements?.currently_due),
    eventuallyDue: stringArray(account.requirements?.eventually_due),
    pastDue: stringArray(account.requirements?.past_due),
    disabledReason: account.requirements?.disabled_reason ?? null,
    defaultCurrency: account.default_currency ?? null,
    country: account.country ?? null,
    onboardingStartedAt: existing?.onboardingStartedAt ?? now,
    onboardingCompletedAt: detailsSubmitted ? (existing?.onboardingCompletedAt ?? now) : existing?.onboardingCompletedAt ?? null,
    lastSyncedAt: now
  };
}

async function upsertStripeConnectAccount(userId: string, account: Stripe.Account) {
  const existing = await prisma.stripeConnectAccount.findUnique({ where: { userId } });
  return prisma.stripeConnectAccount.upsert({
    where: { userId },
    create: {
      userId,
      stripeAccountId: account.id,
      ...accountData(account, existing)
    },
    update: {
      stripeAccountId: account.id,
      ...accountData(account, existing)
    }
  });
}

export async function createStripeConnectOnboardingLink(userId: string) {
  const stripe = requireStripeConnect();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const existing = await prisma.stripeConnectAccount.findUnique({ where: { userId } });

  const stripeAccount = existing
    ? await stripe.accounts.retrieve(existing.stripeAccountId)
    : await stripe.accounts.create({
      type: 'express',
      country: env.stripeConnectCountry,
      email: user?.email ?? undefined,
      capabilities: {
        transfers: { requested: true }
      },
      metadata: { userId }
    });

  const account = await upsertStripeConnectAccount(userId, stripeAccount);
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccount.id,
    refresh_url: webAppUrl(env.stripeConnectRefreshPath),
    return_url: webAppUrl(env.stripeConnectReturnPath),
    type: 'account_onboarding'
  });

  return {
    url: accountLink.url,
    expiresAt: accountLink.expires_at ? new Date(accountLink.expires_at * 1000).toISOString() : null,
    account
  };
}

export async function syncStripeConnectAccountByAccountId(stripeAccountId: string, options: { fromWebhook?: boolean } = {}) {
  const stripe = requireStripeConnect();
  const existing = await prisma.stripeConnectAccount.findUnique({ where: { stripeAccountId } });
  if (!existing) return null;

  const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
  return prisma.stripeConnectAccount.update({
    where: { id: existing.id },
    data: {
      ...accountData(stripeAccount, existing),
      ...(options.fromWebhook ? { lastWebhookEventAt: new Date() } : {})
    }
  });
}

export async function createStripeTransferForPayout(input: TransferForPayoutInput) {
  if (!env.stripeConnectTransferMode) return null;
  const stripe = requireStripeConnect();

  const payout = await prisma.payoutRequest.findUnique({
    where: { id: input.payoutId },
    include: { stripeConnectAccount: true }
  });
  const account = payout?.stripeConnectAccount ?? await prisma.stripeConnectAccount.findUnique({ where: { userId: input.userId } });
  if (!account?.payoutsEnabled || !['enabled', 'pending'].includes(account.status)) {
    throw new StripeConnectError('stripe_connect_account_not_ready', 'Stripe Connect account is not ready for transfers.', 400);
  }
  if (input.netAmountCents <= 0) return null;

  const transfer = await stripe.transfers.create({
    amount: input.netAmountCents,
    currency: input.currency.toLowerCase(),
    destination: account.stripeAccountId,
    metadata: {
      userId: input.userId,
      payoutId: input.payoutId,
      grossAmountCents: String(input.grossAmountCents),
      platformFeeCents: String(input.platformFeeCents),
      netAmountCents: String(input.netAmountCents)
    }
  }, { idempotencyKey: `payout-transfer:${input.payoutId}` });

  await prisma.payoutRequest.update({
    where: { id: input.payoutId },
    data: {
      stripeConnectAccountId: account.id,
      stripeTransferId: transfer.id,
      stripeExternalStatus: 'transfer_created'
    }
  });

  return transfer;
}
