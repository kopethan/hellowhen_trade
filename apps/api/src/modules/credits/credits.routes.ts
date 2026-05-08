import { Router } from 'express';
import { createCheckoutSessionRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { findCreditPackage, getCreditPackages } from './creditPackages.js';
import { getStripe, isStripeConfigured } from './stripeClient.js';

export const creditsRoutes = Router();

creditsRoutes.get('/packages', (_req, res) => {
  res.json({ packages: getCreditPackages(), stripeConfigured: isStripeConfigured() });
});

creditsRoutes.use(requireAuth);

creditsRoutes.post('/checkout-session', asyncRoute(async (req, res) => {
  const input = createCheckoutSessionRequestSchema.parse(req.body);
  const creditPackage = findCreditPackage(input.packageId);
  if (!creditPackage) return res.status(404).json({ error: 'package_not_found', message: 'Choose a valid credit package.' });

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error: 'stripe_not_configured',
      message: 'Stripe test mode is not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to the API env to test credit purchases.'
    });
  }

  const purchase = await prisma.creditPurchase.create({
    data: {
      userId: req.user!.id,
      creditAmount: creditPackage.creditAmount,
      amountCents: creditPackage.amountCents,
      currency: creditPackage.currency,
      status: 'pending'
    }
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    client_reference_id: purchase.id,
    success_url: `${env.webAppUrl.replace(/\/$/, '')}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.webAppUrl.replace(/\/$/, '')}/wallet/cancel`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: creditPackage.currency,
          unit_amount: creditPackage.amountCents,
          product_data: {
            name: `Hellowhen ${creditPackage.label}`,
            description: 'Wallet top-up for optional trade amounts. Payouts are enabled separately.'
          }
        }
      }
    ],
    metadata: {
      purchaseId: purchase.id,
      userId: req.user!.id,
      creditAmount: String(creditPackage.creditAmount),
      nonWithdrawable: 'true',
      walletMoney: 'optional'
    }
  });

  const updatedPurchase = await prisma.creditPurchase.update({
    where: { id: purchase.id },
    data: { stripeCheckoutSessionId: session.id, checkoutUrl: session.url ?? null }
  });

  res.status(201).json({ checkoutUrl: session.url, sessionId: session.id, purchase: updatedPurchase });
}));

creditsRoutes.get('/purchases/mine', asyncRoute(async (req, res) => {
  const purchases = await prisma.creditPurchase.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json({ purchases });
}));
