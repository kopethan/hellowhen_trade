import { Router, type Response } from 'express';
import { acknowledgeMoneySafetyRequestSchema, demoPayoutRequestSchema, demoTopUpRequestSchema, moneyProviderOnboardingLinkRequestSchema, moneyProviderWalletBalancesSyncRequestSchema } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireFreshSensitiveAction } from '../../middleware/auth.js';
import { buildLaunchLimits, limitExceeded } from '../limits/launchLimits.js';
import { acknowledgeMoneySafety, buildMoneySafetyStatus, getMoneySafetyBlock } from '../money/moneySafety.js';
import { getActiveMoneyProvider } from '../money/providers/moneyProviderRegistry.js';
import { MoneyProviderError } from '../money/providers/moneyProvider.types.js';
import { createStripeConnectOnboardingLink, createStripeTransferForPayout, isStripeConnectConfigured, syncStripeConnectAccountByAccountId } from '../stripe/stripeConnect.js';

export const walletRoutes = Router();
walletRoutes.use(requireAuth);

const demoPayoutMetadata = { stripeDemoPayoutAccount: true } as const;
const DEFAULT_PAYOUT_PLATFORM_FEE_RATE_BPS = 1000;

function getPayoutPlatformFeeRateBps() {
  const value = Number.isFinite(env.payoutPlatformFeeRateBps) ? Math.trunc(env.payoutPlatformFeeRateBps) : DEFAULT_PAYOUT_PLATFORM_FEE_RATE_BPS;
  return Math.min(Math.max(value, 0), 5000);
}

function calculatePayoutPlatformFeeCents(amountCents: number, platformFeeRateBps = getPayoutPlatformFeeRateBps()) {
  if (amountCents <= 0 || platformFeeRateBps <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * platformFeeRateBps) / 10000));
}

function getPayoutGrossCents(payout: { amountCents: number; grossAmountCents?: number | null }) {
  return payout.grossAmountCents && payout.grossAmountCents > 0 ? payout.grossAmountCents : payout.amountCents;
}

function getPayoutFeeCents(payout: { amountCents: number; grossAmountCents?: number | null; platformFeeCents?: number | null; netAmountCents?: number | null; platformFeeRateBps?: number | null }) {
  if (typeof payout.platformFeeCents === 'number' && (payout.platformFeeCents > 0 || (payout.netAmountCents ?? 0) > 0)) return payout.platformFeeCents;
  return calculatePayoutPlatformFeeCents(getPayoutGrossCents(payout), payout.platformFeeRateBps ?? getPayoutPlatformFeeRateBps());
}

function getPayoutNetCents(payout: { amountCents: number; grossAmountCents?: number | null; platformFeeCents?: number | null; netAmountCents?: number | null; platformFeeRateBps?: number | null }) {
  if (typeof payout.netAmountCents === 'number' && payout.netAmountCents > 0) return payout.netAmountCents;
  return Math.max(0, getPayoutGrossCents(payout) - getPayoutFeeCents(payout));
}

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

async function getActiveProviderAccountRecordForUser(userId: string) {
  const provider = getActiveMoneyProvider();
  if (provider.provider === 'none' || provider.provider === 'stripe') return null;
  return prisma.moneyProviderAccount.findFirst({
    where: { userId, provider: provider.provider, status: { in: ['pending', 'active'] } },
    orderBy: { updatedAt: 'desc' },
  });
}

function mapStripeConnectPayoutAccount(account: null | { status: string; payoutsEnabled: boolean; chargesEnabled: boolean; detailsSubmitted: boolean; createdAt: Date; onboardingCompletedAt: Date | null; stripeAccountId: string; currentlyDue: string[]; eventuallyDue: string[]; pastDue: string[]; disabledReason: string | null; defaultCurrency: string | null; country: string | null; lastSyncedAt: Date | null }) {
  if (!account) return null;
  const status = account.status === 'enabled' && account.payoutsEnabled
    ? 'connected'
    : account.status === 'onboarding'
      ? 'onboarding'
      : account.status === 'pending'
        ? 'pending'
        : account.status === 'restricted'
          ? 'restricted'
          : account.status === 'disabled'
            ? 'disabled'
            : 'not_connected';
  return {
    provider: 'stripe_connect_test' as const,
    status,
    connectedAt: account.onboardingCompletedAt ? account.onboardingCompletedAt.toISOString() : account.createdAt.toISOString(),
    stripeAccountId: account.stripeAccountId,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    detailsSubmitted: account.detailsSubmitted,
    currentlyDue: account.currentlyDue,
    eventuallyDue: account.eventuallyDue,
    pastDue: account.pastDue,
    disabledReason: account.disabledReason,
    defaultCurrency: account.defaultCurrency,
    country: account.country,
    lastSyncedAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
  };
}

async function buildPayoutSummary(userId: string) {
  const wallet = await ensureWallet(userId);
  const payouts = await prisma.payoutRequest.findMany({ where: { userId }, orderBy: { requestedAt: 'desc' }, take: 25 });
  const connectedMarker = await hasDemoPayoutAccount(userId);
  const stripeConnectAccount = await prisma.stripeConnectAccount.findUnique({ where: { userId } });
  const activeProvider = getActiveMoneyProvider();
  const activeProviderAccount = activeProvider.provider === 'stripe'
    ? null
    : await activeProvider.getConnectedAccount(userId).catch(() => null);
  const activeProviderBalances = activeProvider.provider === 'none'
    ? []
    : (await activeProvider.getWalletBalances({ userId }).catch(() => ({ balances: [] }))).balances;
  const platformFeeRateBps = getPayoutPlatformFeeRateBps();
  const limits = await buildLaunchLimits(prisma, userId);
  const pendingPayouts = payouts.filter((payout) => ['requested', 'approved'].includes(payout.status));
  const paidPayouts = payouts.filter((payout) => payout.status === 'paid');
  const pendingPayoutRequestsGrossCents = pendingPayouts.reduce((sum, payout) => sum + getPayoutGrossCents(payout), 0);
  const pendingPayoutRequestsFeeCents = pendingPayouts.reduce((sum, payout) => sum + getPayoutFeeCents(payout), 0);
  const pendingPayoutRequestsNetCents = pendingPayouts.reduce((sum, payout) => sum + getPayoutNetCents(payout), 0);
  const paidOutGrossCents = paidPayouts.reduce((sum, payout) => sum + getPayoutGrossCents(payout), 0);
  const paidOutFeeCents = paidPayouts.reduce((sum, payout) => sum + getPayoutFeeCents(payout), 0);
  const paidOutNetCents = paidPayouts.reduce((sum, payout) => sum + getPayoutNetCents(payout), 0);
  const estimatedPlatformFeeCents = calculatePayoutPlatformFeeCents(wallet.pendingPayoutCents, platformFeeRateBps);
  const estimatedNetPayoutCents = Math.max(0, wallet.pendingPayoutCents - estimatedPlatformFeeCents);
  const moneySafety = await buildMoneySafetyStatus(prisma, userId);

  return {
    wallet,
    payouts,
    summary: {
      currency: wallet.currency,
      platformFeeRateBps,
      availableForPayoutCents: wallet.pendingPayoutCents,
      availableGrossEarningsCents: wallet.pendingPayoutCents,
      estimatedPlatformFeeCents,
      estimatedNetPayoutCents,
      pendingPayoutRequestsCents: pendingPayoutRequestsNetCents,
      pendingPayoutRequestsGrossCents,
      pendingPayoutRequestsFeeCents,
      pendingPayoutRequestsNetCents,
      paidOutCents: paidOutNetCents,
      paidOutGrossCents,
      paidOutFeeCents,
      paidOutNetCents,
      payoutAccount: activeProviderAccount ?? mapStripeConnectPayoutAccount(stripeConnectAccount) ?? {
        provider: 'stripe_demo' as const,
        status: connectedMarker ? 'connected' as const : 'not_connected' as const,
        connectedAt: connectedMarker ? connectedMarker.createdAt.toISOString() : null,
      },
      moneyProviderConfigured: activeProvider.isConfigured(),
      providerTransferMode: moneySafety.providerTransfersEnabled,
      providerWalletBalances: activeProviderBalances,
      stripeConnectConfigured: isStripeConnectConfigured(),
      stripeConnectTransferMode: env.stripeConnectTransferMode,
      limits,
      moneySafety
    }
  };
}

walletRoutes.get('/me', asyncRoute(async (req, res) => {
  const wallet = await ensureWallet(req.user!.id);
  const provider = getActiveMoneyProvider();
  const providerBalances = provider.provider === 'none'
    ? []
    : (await provider.getWalletBalances({ userId: req.user!.id }).catch(() => ({ balances: [] }))).balances;
  res.json({ wallet, provider: provider.getPublicStatus(), providerBalances });
}));

walletRoutes.get('/ledger', asyncRoute(async (req, res) => {
  const entries = await prisma.creditLedgerEntry.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ entries });
}));

walletRoutes.get('/limits', asyncRoute(async (req, res) => {
  const limits = await buildLaunchLimits(prisma, req.user!.id);
  res.json({ limits });
}));

walletRoutes.get('/money-safety', asyncRoute(async (req, res) => {
  res.json({ moneySafety: await buildMoneySafetyStatus(prisma, req.user!.id) });
}));

walletRoutes.post('/money-safety/acknowledge', asyncRoute(async (req, res) => {
  acknowledgeMoneySafetyRequestSchema.parse(req.body);
  await acknowledgeMoneySafety(prisma, req.user!.id, { ipAddress: req.ip, userAgent: req.get('user-agent') ?? null });
  res.status(201).json({ moneySafety: await buildMoneySafetyStatus(prisma, req.user!.id) });
}));

walletRoutes.get('/payouts', asyncRoute(async (req, res) => {
  const { wallet, payouts, summary } = await buildPayoutSummary(req.user!.id);
  res.json({ wallet, payouts, summary });
}));

function providerErrorResponse(res: Response, error: unknown) {
  if (error instanceof MoneyProviderError) {
    return res.status(error.statusCode).json({ error: error.code, message: error.publicMessage });
  }
  throw error;
}

walletRoutes.get('/provider-account', asyncRoute(async (req, res) => {
  const provider = getActiveMoneyProvider();
  const account = await provider.getConnectedAccount(req.user!.id);
  res.json({ provider: provider.getPublicStatus(), account });
}));

walletRoutes.post('/provider-account/onboarding-link', requireFreshSensitiveAction, asyncRoute(async (req, res) => {
  const userId = req.user!.id;
  const moneySafety = await buildMoneySafetyStatus(prisma, userId);
  const block = getMoneySafetyBlock(moneySafety, 'payout_account');
  if (block) return res.status(block.statusCode).json({ error: block.error, message: block.message, moneySafety });
  const provider = getActiveMoneyProvider();
  try {
    const input = moneyProviderOnboardingLinkRequestSchema.parse(req.body ?? {});
    const result = await provider.createOnboardingLink({ userId, returnUrl: input.returnUrl, refreshUrl: input.refreshUrl });
    res.status(201).json({ ...result, providerConfigured: provider.isConfigured() });
  } catch (error) {
    return providerErrorResponse(res, error);
  }
}));

walletRoutes.post('/provider-account/sync', asyncRoute(async (req, res) => {
  const provider = getActiveMoneyProvider();
  try {
    const account = await provider.syncConnectedAccountStatus({ userId: req.user!.id });
    const summary = await buildPayoutSummary(req.user!.id);
    res.json({ ...summary, provider: provider.getPublicStatus(), providerAccount: account });
  } catch (error) {
    return providerErrorResponse(res, error);
  }
}));


walletRoutes.get('/provider-balances', asyncRoute(async (req, res) => {
  const provider = getActiveMoneyProvider();
  try {
    const result = await provider.getWalletBalances({ userId: req.user!.id });
    res.json({ provider: provider.getPublicStatus(), ...result, moneySafety: await buildMoneySafetyStatus(prisma, req.user!.id) });
  } catch (error) {
    return providerErrorResponse(res, error);
  }
}));

walletRoutes.post('/provider-balances/sync', requireFreshSensitiveAction, asyncRoute(async (req, res) => {
  const userId = req.user!.id;
  const moneySafety = await buildMoneySafetyStatus(prisma, userId);
  const block = getMoneySafetyBlock(moneySafety, 'wallet_balance_sync');
  if (block) return res.status(block.statusCode).json({ error: block.error, message: block.message, moneySafety });
  const provider = getActiveMoneyProvider();
  try {
    const input = moneyProviderWalletBalancesSyncRequestSchema.parse(req.body ?? {});
    const result = await provider.syncWalletBalances({ userId, scaToken: input.scaToken });
    res.json({ provider: provider.getPublicStatus(), ...result, moneySafety });
  } catch (error) {
    return providerErrorResponse(res, error);
  }
}));

walletRoutes.get('/stripe-connect', asyncRoute(async (req, res) => {
  const account = await prisma.stripeConnectAccount.findUnique({ where: { userId: req.user!.id } });
  res.json({ stripeConnectConfigured: isStripeConnectConfigured(), account: mapStripeConnectPayoutAccount(account) });
}));

walletRoutes.post('/stripe-connect/account-link', requireFreshSensitiveAction, asyncRoute(async (req, res) => {
  const moneySafety = await buildMoneySafetyStatus(prisma, req.user!.id);
  const block = getMoneySafetyBlock(moneySafety, 'payout_account');
  if (block) return res.status(block.statusCode).json({ error: block.error, message: block.message, moneySafety });
  const result = await createStripeConnectOnboardingLink(req.user!.id);
  const account = await prisma.stripeConnectAccount.findUnique({ where: { id: result.account.id } });
  res.status(201).json({ url: result.url, expiresAt: result.expiresAt, account: mapStripeConnectPayoutAccount(account), stripeConnectConfigured: isStripeConnectConfigured() });
}));

walletRoutes.post('/stripe-connect/sync', asyncRoute(async (req, res) => {
  const current = await prisma.stripeConnectAccount.findUnique({ where: { userId: req.user!.id } });
  const account = current ? await syncStripeConnectAccountByAccountId(current.stripeAccountId) : null;
  const summary = await buildPayoutSummary(req.user!.id);
  res.json({ ...summary, stripeConnect: { account: mapStripeConnectPayoutAccount(account ?? current), configured: isStripeConnectConfigured() } });
}));

walletRoutes.post('/demo-top-up', asyncRoute(async (req, res) => {
  const input = demoTopUpRequestSchema.parse(req.body);
  const userId = req.user!.id;
  const moneySafety = await buildMoneySafetyStatus(prisma, userId);
  const block = getMoneySafetyBlock(moneySafety, 'wallet_top_up');
  if (block) return res.status(block.statusCode).json({ error: block.error, message: block.message, moneySafety });
  const currency = input.currency.toLowerCase();
  const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (existingWallet && existingWallet.currency !== currency) return res.status(400).json({ error: 'currency_mismatch', message: `This wallet uses ${existingWallet.currency.toUpperCase()}. Cross-currency demo top-ups are not supported yet.` });

  const limits = await buildLaunchLimits(prisma, userId);
  const currentExposureCents = limits.walletExposureCents;
  if (!limits.walletTopUpsEnabled) return res.status(403).json(limitExceeded('Wallet top-ups are disabled for your current trust tier. Verify your account or contact support to request higher limits.', { trustTier: limits.effectiveTrustTier }));
  if (currentExposureCents + input.amountCents > limits.walletBalanceCapCents) return res.status(409).json(limitExceeded(`This top-up would go above your launch wallet limit of ${(limits.walletBalanceCapCents / 100).toFixed(2)} ${currency.toUpperCase()}.`, { trustTier: limits.effectiveTrustTier, walletBalanceCapCents: limits.walletBalanceCapCents, walletExposureCents: currentExposureCents }));

  const wallet = await prisma.$transaction(async (tx) => {
    let current = await tx.wallet.findUnique({ where: { userId } });
    if (!current) current = await tx.wallet.create({ data: { userId, currency } });
    await tx.wallet.update({ where: { id: current.id }, data: { availableBalanceCents: { increment: input.amountCents } } });
    await tx.creditLedgerEntry.create({ data: { userId, walletId: current.id, type: 'test_credit_grant', balanceType: 'purchased', amount: 0, amountCents: input.amountCents, currency, description: 'Stripe demo wallet top-up. No real card was charged.', metadata: { stripeDemo: true, demoTopUp: true } } });
    return tx.wallet.findUniqueOrThrow({ where: { id: current.id }, include: { entries: { orderBy: { createdAt: 'desc' }, take: 25 } } });
  });
  res.status(201).json({ wallet, message: 'Demo wallet money added. No real card was charged.' });
}));

walletRoutes.post('/demo-payout-account', requireFreshSensitiveAction, asyncRoute(async (req, res) => {
  const userId = req.user!.id;
  const moneySafety = await buildMoneySafetyStatus(prisma, userId);
  const block = getMoneySafetyBlock(moneySafety, 'payout_account');
  if (block) return res.status(block.statusCode).json({ error: block.error, message: block.message, moneySafety });
  const wallet = await ensureWallet(userId);
  const existing = await hasDemoPayoutAccount(userId);
  if (!existing) {
    await prisma.user.update({ where: { id: userId }, data: { trustTier: 'stripe_verified', trustTierUpdatedAt: new Date(), trustTierNote: 'Stripe demo payout account connected. Replace with real Connect verification before public money launch.' } }).catch(() => null);
    await prisma.creditLedgerEntry.create({ data: { userId, walletId: wallet.id, type: 'adjustment', balanceType: 'earned_available', amount: 0, amountCents: 0, currency: wallet.currency, description: 'Stripe demo payout account connected.', metadata: demoPayoutMetadata } });
  }
  const summary = await buildPayoutSummary(userId);
  res.json(summary);
}));

walletRoutes.post('/demo-payout-request', requireFreshSensitiveAction, asyncRoute(async (req, res) => {
  const input = demoPayoutRequestSchema.parse(req.body);
  const userId = req.user!.id;
  const moneySafety = await buildMoneySafetyStatus(prisma, userId);
  const block = getMoneySafetyBlock(moneySafety, 'payout_request');
  if (block) return res.status(block.statusCode).json({ error: block.error, message: block.message, moneySafety });
  const currency = input.currency.toLowerCase();
  const connected = await hasDemoPayoutAccount(userId);
  const activeProvider = getActiveMoneyProvider();
  const [stripeConnectAccount, providerAccount] = await Promise.all([
    prisma.stripeConnectAccount.findUnique({ where: { userId } }),
    getActiveProviderAccountRecordForUser(userId),
  ]);
  const stripeConnectReady = activeProvider.provider === 'stripe' && Boolean(stripeConnectAccount?.payoutsEnabled && ['enabled', 'pending'].includes(stripeConnectAccount.status));
  const providerReady = Boolean(providerAccount && activeProvider.provider !== 'none' && activeProvider.provider !== 'stripe');
  if (!connected && !stripeConnectReady && !providerReady) {
    const providerLabel = activeProvider.provider === 'airwallex' ? 'Airwallex sandbox connected account' : isStripeConnectConfigured() ? 'Stripe Connect test onboarding' : 'Stripe demo payout account';
    return res.status(400).json({ error: 'payout_account_required', message: `Complete ${providerLabel} first.` });
  }

  const openDispute = await prisma.trade.findFirst({
    where: { status: 'disputed', payment: { is: { sellerId: userId, status: { in: ['held', 'released'] } } } },
    select: { id: true, title: true, disputeTicketId: true },
  });
  if (openDispute) return res.status(409).json({ error: 'payout_blocked_by_trade_dispute', message: 'A reported money trade is under admin review. Payouts are paused until the dispute is resolved.', tradeId: openDispute.id, ticketId: openDispute.disputeTicketId });

  const currentWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!currentWallet) return res.status(400).json({ error: 'wallet_not_found', message: 'No wallet balance is available for payout yet.' });
  if (currentWallet.currency !== currency) return res.status(400).json({ error: 'currency_mismatch', message: `This wallet uses ${currentWallet.currency.toUpperCase()}. Cross-currency demo payouts are not supported yet.` });
  if (currentWallet.pendingPayoutCents < input.amountCents) return res.status(400).json({ error: 'insufficient_payout_balance', message: 'You can only request up to your available payout balance.' });

  const limits = await buildLaunchLimits(prisma, userId);
  if (!limits.payoutsEnabled) return res.status(403).json(limitExceeded('Payouts are disabled for your current trust tier. Complete payout verification or contact support to request a higher limit.', { trustTier: limits.effectiveTrustTier }));
  if (input.amountCents < limits.minimumPayoutCents) return res.status(400).json(limitExceeded(`Minimum payout is ${(limits.minimumPayoutCents / 100).toFixed(2)} ${currency.toUpperCase()}.`, { minimumPayoutCents: limits.minimumPayoutCents }));
  if (limits.weeklyRequestedPayoutGrossCents + input.amountCents > limits.weeklyPayoutCapCents) return res.status(409).json(limitExceeded(`This payout would go above your weekly launch payout limit of ${(limits.weeklyPayoutCapCents / 100).toFixed(2)} ${currency.toUpperCase()}.`, { weeklyPayoutCapCents: limits.weeklyPayoutCapCents, weeklyRequestedPayoutGrossCents: limits.weeklyRequestedPayoutGrossCents }));

  const platformFeeRateBps = getPayoutPlatformFeeRateBps();
  const grossAmountCents = input.amountCents;
  const platformFeeCents = calculatePayoutPlatformFeeCents(grossAmountCents, platformFeeRateBps);
  const netAmountCents = Math.max(0, grossAmountCents - platformFeeCents);

  const manualReview = moneySafety.requiresManualPayoutReview;

  const payout = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({ where: { id: currentWallet.id }, data: { pendingPayoutCents: { decrement: grossAmountCents } } });
    const payout = await tx.payoutRequest.create({ data: { userId, amount: 0, amountCents: grossAmountCents, grossAmountCents, platformFeeCents, netAmountCents, platformFeeRateBps, currency, status: manualReview ? 'requested' : 'paid', reviewedAt: manualReview ? null : new Date(), paidAt: manualReview ? null : new Date(), notes: manualReview ? 'Manual payout review required by launch safety settings.' : (stripeConnectReady || providerReady) && moneySafety.providerTransfersEnabled ? 'Provider sandbox transfer requested. No production bank payout was sent.' : 'Stripe demo payout simulation. No real bank transfer was sent.', stripeConnectAccountId: stripeConnectAccount?.id ?? null, stripeExternalStatus: manualReview ? 'manual_review_requested' : stripeConnectReady ? 'connect_ready' : 'demo_paid', provider: providerReady ? activeProvider.provider : stripeConnectReady ? 'stripe' : undefined, providerAccountId: providerAccount?.id ?? null, providerExternalStatus: manualReview ? 'manual_review_requested' : providerReady ? 'provider_ready' : null } });
    if (platformFeeCents > 0) {
      await tx.creditLedgerEntry.create({ data: { userId, walletId: wallet.id, type: 'platform_fee', balanceType: 'earned_pending', amount: 0, amountCents: -platformFeeCents, currency, description: `${platformFeeRateBps / 100}% platform fee on payout-eligible earnings.`, metadata: { stripeDemo: !stripeConnectReady && !providerReady, stripeConnectTest: stripeConnectReady, provider: providerReady ? activeProvider.provider : null, payoutId: payout.id, grossAmountCents, platformFeeRateBps } } });
    }
    await tx.creditLedgerEntry.create({ data: { userId, walletId: wallet.id, type: 'payout_requested', balanceType: 'earned_pending', amount: 0, amountCents: -netAmountCents, currency, description: manualReview ? 'Payout request held for manual review after platform fee.' : (stripeConnectReady || providerReady) && moneySafety.providerTransfersEnabled ? 'Provider sandbox payout transfer after platform fee.' : 'Stripe demo payout paid after platform fee. No real bank transfer was sent.', metadata: { stripeDemo: !stripeConnectReady && !providerReady, stripeConnectTest: stripeConnectReady, provider: providerReady ? activeProvider.provider : null, payoutId: payout.id, grossAmountCents, platformFeeCents, netAmountCents, platformFeeRateBps } } });
    return payout;
  });

  if (!manualReview && (stripeConnectReady || providerReady) && moneySafety.providerTransfersEnabled) {
    try {
      const transfer = await activeProvider.createPayoutTransfer({ userId, payoutId: payout.id, grossAmountCents, platformFeeCents, netAmountCents, currency, requestedById: userId });
      if (transfer) {
        await prisma.payoutRequest.update({ where: { id: payout.id }, data: { notes: 'Provider sandbox transfer created. Connected account payout timing is managed by the selected provider test mode.', stripeExternalStatus: activeProvider.provider === 'stripe' ? 'transfer_created' : undefined, providerExternalStatus: transfer.externalStatus ?? transfer.status, providerTransferId: transfer.providerTransactionId ?? transfer.id, providerPayoutId: transfer.id } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider transfer failed';
      await prisma.payoutRequest.update({ where: { id: payout.id }, data: { stripeExternalStatus: activeProvider.provider === 'stripe' ? 'transfer_failed' : undefined, stripeFailureMessage: activeProvider.provider === 'stripe' ? message : undefined, providerExternalStatus: activeProvider.provider !== 'stripe' ? 'transfer_failed' : undefined, providerFailureMessage: activeProvider.provider !== 'stripe' ? message : undefined } }).catch(() => null);
    }
  }

  const summary = await buildPayoutSummary(userId);
  res.status(201).json(summary);
}));
