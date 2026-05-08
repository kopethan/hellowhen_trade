import { Router } from 'express';
import { demoPayoutRequestSchema, demoTopUpRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const walletRoutes = Router();
walletRoutes.use(requireAuth);

const demoPayoutMetadata = { stripeDemoPayoutAccount: true } as const;

async function getPreferredCurrency(userId: string, fallback = 'eur') {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { preferredCurrency: true } });
  return (profile?.preferredCurrency || fallback).toLowerCase();
}

async function ensureWallet(userId: string, currency?: string) {
  const walletCurrency = (currency || await getPreferredCurrency(userId)).toLowerCase();
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, currency: walletCurrency },
    include: { entries: { orderBy: { createdAt: 'desc' }, take: 25 } }
  });
}

async function hasDemoPayoutAccount(userId: string) {
  const marker = await prisma.creditLedgerEntry.findFirst({
    where: { userId, type: 'adjustment', metadata: { path: ['stripeDemoPayoutAccount'], equals: true } },
    orderBy: { createdAt: 'desc' }
  });
  return marker;
}

async function buildPayoutSummary(userId: string) {
  const wallet = await ensureWallet(userId);
  const payouts = await prisma.payoutRequest.findMany({ where: { userId }, orderBy: { requestedAt: 'desc' }, take: 25 });
  const connectedMarker = await hasDemoPayoutAccount(userId);
  const pendingPayoutRequestsCents = payouts.filter((payout) => ['requested', 'approved'].includes(payout.status)).reduce((sum, payout) => sum + payout.amountCents, 0);
  const paidOutCents = payouts.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + payout.amountCents, 0);

  return {
    wallet,
    payouts,
    summary: {
      currency: wallet.currency,
      availableForPayoutCents: wallet.pendingPayoutCents,
      pendingPayoutRequestsCents,
      paidOutCents,
      payoutAccount: {
        provider: 'stripe_demo' as const,
        status: connectedMarker ? 'connected' as const : 'not_connected' as const,
        connectedAt: connectedMarker ? connectedMarker.createdAt.toISOString() : null,
      }
    }
  };
}

walletRoutes.get('/me', asyncRoute(async (req, res) => {
  const wallet = await ensureWallet(req.user!.id);
  res.json({ wallet });
}));

walletRoutes.get('/ledger', asyncRoute(async (req, res) => {
  const entries = await prisma.creditLedgerEntry.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ entries });
}));

walletRoutes.get('/payouts', asyncRoute(async (req, res) => {
  const { wallet, payouts, summary } = await buildPayoutSummary(req.user!.id);
  res.json({ wallet, payouts, summary });
}));

walletRoutes.post('/demo-top-up', asyncRoute(async (req, res) => {
  const input = demoTopUpRequestSchema.parse(req.body);
  const userId = req.user!.id;
  const currency = input.currency.toLowerCase();
  const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (existingWallet && existingWallet.currency !== currency) return res.status(400).json({ error: 'currency_mismatch', message: `This wallet uses ${existingWallet.currency.toUpperCase()}. Cross-currency demo top-ups are not supported yet.` });

  const wallet = await prisma.$transaction(async (tx) => {
    let current = await tx.wallet.findUnique({ where: { userId } });
    if (!current) current = await tx.wallet.create({ data: { userId, currency } });
    await tx.wallet.update({ where: { id: current.id }, data: { availableBalanceCents: { increment: input.amountCents } } });
    await tx.creditLedgerEntry.create({ data: { userId, walletId: current.id, type: 'test_credit_grant', balanceType: 'purchased', amount: 0, amountCents: input.amountCents, currency, description: 'Stripe demo wallet top-up. No real card was charged.', metadata: { stripeDemo: true, demoTopUp: true } } });
    return tx.wallet.findUniqueOrThrow({ where: { id: current.id }, include: { entries: { orderBy: { createdAt: 'desc' }, take: 25 } } });
  });
  res.status(201).json({ wallet, message: 'Demo wallet money added. No real card was charged.' });
}));

walletRoutes.post('/demo-payout-account', asyncRoute(async (req, res) => {
  const userId = req.user!.id;
  const wallet = await ensureWallet(userId);
  const existing = await hasDemoPayoutAccount(userId);
  if (!existing) {
    await prisma.creditLedgerEntry.create({ data: { userId, walletId: wallet.id, type: 'adjustment', balanceType: 'earned_available', amount: 0, amountCents: 0, currency: wallet.currency, description: 'Stripe demo payout account connected.', metadata: demoPayoutMetadata } });
  }
  const summary = await buildPayoutSummary(userId);
  res.json(summary);
}));

walletRoutes.post('/demo-payout-request', asyncRoute(async (req, res) => {
  const input = demoPayoutRequestSchema.parse(req.body);
  const userId = req.user!.id;
  const currency = input.currency.toLowerCase();
  const connected = await hasDemoPayoutAccount(userId);
  if (!connected) return res.status(400).json({ error: 'payout_account_required', message: 'Connect the Stripe demo payout account first.' });

  const currentWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!currentWallet) return res.status(400).json({ error: 'wallet_not_found', message: 'No wallet balance is available for payout yet.' });
  if (currentWallet.currency !== currency) return res.status(400).json({ error: 'currency_mismatch', message: `This wallet uses ${currentWallet.currency.toUpperCase()}. Cross-currency demo payouts are not supported yet.` });
  if (currentWallet.pendingPayoutCents < input.amountCents) return res.status(400).json({ error: 'insufficient_payout_balance', message: 'You can only request up to your available payout balance.' });

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({ where: { id: currentWallet.id }, data: { pendingPayoutCents: { decrement: input.amountCents } } });
    const payout = await tx.payoutRequest.create({ data: { userId, amount: 0, amountCents: input.amountCents, currency, status: 'paid', reviewedAt: new Date(), paidAt: new Date(), notes: 'Stripe demo payout simulation. No real bank transfer was sent.' } });
    await tx.creditLedgerEntry.create({ data: { userId, walletId: wallet.id, type: 'payout_requested', balanceType: 'earned_pending', amount: 0, amountCents: -input.amountCents, currency, description: 'Stripe demo payout paid from available earnings.', metadata: { stripeDemo: true, payoutId: payout.id } } });
  });

  const summary = await buildPayoutSummary(userId);
  res.status(201).json(summary);
}));
