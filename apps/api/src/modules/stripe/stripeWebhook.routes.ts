import { Router } from 'express';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { getStripe } from '../credits/stripeClient.js';
import { syncStripeConnectAccountByAccountId } from './stripeConnect.js';

export const stripeWebhookRoutes = Router();

function jsonPayload(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function markPurchasePaid(session: Stripe.Checkout.Session) {
  const purchaseId = session.metadata?.purchaseId ?? session.client_reference_id ?? undefined;
  if (!purchaseId) return { handled: false, reason: 'missing_purchase_id' };

  const purchase = await prisma.creditPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return { handled: false, reason: 'purchase_not_found' };
  if (purchase.status === 'paid') return { handled: true, reason: 'already_paid' };

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: purchase.userId },
      create: { userId: purchase.userId, purchasedAvailableCredits: 0, earnedPendingCredits: 0, earnedAvailableCredits: 0, heldCredits: 0 },
      update: {}
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { availableBalanceCents: { increment: purchase.amountCents }, currency: purchase.currency }
    });

    await tx.creditLedgerEntry.create({
      data: {
        userId: purchase.userId,
        walletId: wallet.id,
        type: 'credit_purchase',
        balanceType: 'purchased',
        amount: 0,
        amountCents: purchase.amountCents,
        currency: purchase.currency,
        description: `Wallet top-up: ${(purchase.amountCents / 100).toFixed(2)} ${purchase.currency.toUpperCase()}`,
        metadata: {
          purchaseId: purchase.id,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          amountCents: purchase.amountCents,
          currency: purchase.currency,
          nonWithdrawable: true,
          mode: 'stripe_test'
        }
      }
    });

    await tx.creditPurchase.update({
      where: { id: purchase.id },
      data: { status: 'paid', stripeCheckoutSessionId: session.id, stripePaymentIntentId: paymentIntentId, paidAt: new Date() }
    });
  });

  return { handled: true, reason: 'paid' };
}

async function markPurchaseStatus(session: Stripe.Checkout.Session, status: 'failed' | 'expired') {
  const purchaseId = session.metadata?.purchaseId ?? session.client_reference_id ?? undefined;
  await prisma.creditPurchase.updateMany({
    where: purchaseId ? { id: purchaseId, status: 'pending' } : { stripeCheckoutSessionId: session.id, status: 'pending' },
    data: { status }
  });
}

async function recordStripeEvent(event: Stripe.Event) {
  const object = event.data.object as { id?: string };
  const stripeAccountId = typeof event.account === 'string' ? event.account : null;
  const connectAccount = stripeAccountId ? await prisma.stripeConnectAccount.findUnique({ where: { stripeAccountId } }) : null;
  const existing = await prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.processingStatus === 'processed') return { record: existing, duplicate: true };
  const record = await prisma.stripeEvent.upsert({
    where: { stripeEventId: event.id },
    create: { stripeEventId: event.id, type: event.type, livemode: event.livemode, stripeAccountId, stripeConnectAccountId: connectAccount?.id ?? null, objectId: object.id ?? null, payload: jsonPayload(event), processingStatus: 'received' },
    update: { type: event.type, livemode: event.livemode, stripeAccountId, stripeConnectAccountId: connectAccount?.id ?? null, objectId: object.id ?? null, payload: jsonPayload(event), processingStatus: 'received', error: null }
  });
  return { record, duplicate: false };
}

async function handleConnectEvent(event: Stripe.Event) {
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    const updated = await syncStripeConnectAccountByAccountId(account.id, { fromWebhook: true });
    return { handled: Boolean(updated), reason: updated ? 'account_synced' : 'account_not_found' };
  }

  if (event.type === 'account.application.deauthorized') {
    const accountId = typeof event.account === 'string' ? event.account : (event.data.object as { id?: string }).id;
    if (!accountId) return { handled: false, reason: 'missing_account_id' };
    await prisma.stripeConnectAccount.updateMany({ where: { stripeAccountId: accountId }, data: { status: 'disabled', payoutsEnabled: false, chargesEnabled: false, disabledReason: 'account.application.deauthorized', lastWebhookEventAt: new Date() } });
    return { handled: true, reason: 'account_deauthorized' };
  }

  if (event.type === 'transfer.created' || event.type === 'transfer.reversed') {
    const transfer = event.data.object as Stripe.Transfer;
    await prisma.payoutRequest.updateMany({ where: { stripeTransferId: transfer.id }, data: { stripeExternalStatus: event.type === 'transfer.created' ? 'transfer_created' : 'transfer_reversed', stripeEventId: event.id } });
    return { handled: true, reason: 'transfer_recorded' };
  }

  if (event.type === 'payout.failed' || event.type === 'payout.canceled' || event.type === 'payout.paid') {
    const payout = event.data.object as Stripe.Payout;
    const status = event.type === 'payout.paid' ? 'payout_paid' : event.type === 'payout.canceled' ? 'payout_canceled' : 'payout_failed';
    await prisma.payoutRequest.updateMany({
      where: { stripePayoutId: payout.id },
      data: { stripeExternalStatus: status, stripeEventId: event.id, stripeFailureCode: payout.failure_code ?? null, stripeFailureMessage: payout.failure_message ?? null, ...(event.type === 'payout.failed' ? { status: 'rejected' as const } : {}) }
    });
    if (event.type === 'payout.failed' && typeof event.account === 'string') {
      await syncStripeConnectAccountByAccountId(event.account, { fromWebhook: true }).catch(() => null);
    }
    return { handled: true, reason: status };
  }

  return { handled: false, reason: 'ignored' };
}

stripeWebhookRoutes.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret || env.stripeWebhookSecret.includes('replace_me')) {
    return res.status(503).json({ error: 'stripe_webhook_not_configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: 'missing_stripe_signature' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe signature';
    return res.status(400).json({ error: 'stripe_signature_error', message });
  }

  const { record, duplicate } = await recordStripeEvent(event);
  if (duplicate) return res.json({ received: true, duplicate: true });

  try {
    if (event.type === 'checkout.session.completed') {
      await markPurchasePaid(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'checkout.session.expired') {
      await markPurchaseStatus(event.data.object as Stripe.Checkout.Session, 'expired');
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await markPurchaseStatus(event.data.object as Stripe.Checkout.Session, 'failed');
    } else {
      await handleConnectEvent(event);
    }
    await prisma.stripeEvent.update({ where: { id: record.id }, data: { processingStatus: 'processed', processedAt: new Date(), error: null } });
    return res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe webhook processing failed';
    console.error('Stripe webhook processing failed', error);
    await prisma.stripeEvent.update({ where: { id: record.id }, data: { processingStatus: 'failed', error: message } }).catch(() => null);
    return res.status(500).json({ error: 'stripe_webhook_processing_failed' });
  }
});
