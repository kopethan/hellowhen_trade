import { Router } from 'express';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { getStripe } from '../credits/stripeClient.js';

export const stripeWebhookRoutes = Router();

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
      data: { purchasedAvailableCredits: { increment: purchase.creditAmount } }
    });

    await tx.creditLedgerEntry.create({
      data: {
        userId: purchase.userId,
        walletId: wallet.id,
        type: 'credit_purchase',
        balanceType: 'purchased',
        amount: purchase.creditAmount,
        description: `Stripe test purchase: ${purchase.creditAmount} non-withdrawable credits`,
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

  try {
    if (event.type === 'checkout.session.completed') {
      await markPurchasePaid(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'checkout.session.expired') {
      await markPurchaseStatus(event.data.object as Stripe.Checkout.Session, 'expired');
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await markPurchaseStatus(event.data.object as Stripe.Checkout.Session, 'failed');
    }
    return res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed', error);
    return res.status(500).json({ error: 'stripe_webhook_processing_failed' });
  }
});
