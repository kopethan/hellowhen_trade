import { Router } from 'express';
import type { MediaAsset, Prisma } from '@prisma/client';
import { createTradeProposalRequestSchema, createTradeRequestSchema, listTradesFeedQuerySchema, updateTradeStatusRequestSchema, type ListTradesFeedQuery } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { buildLaunchLimits, limitExceeded } from '../limits/launchLimits.js';
import { buildMoneySafetyStatus, getMoneySafetyBlock } from '../money/moneySafety.js';
import { mirrorProviderTradeHold, mirrorProviderTradeRefund, mirrorProviderTradeRelease } from '../money/tradeMoney.js';
import { loadMediaByEntityIds, type MediaVisibility } from '../media/media.helpers.js';

export const tradesRoutes = Router();
const userPreviewSelect = { id: true, profile: true } as const;
export const tradeInclude = { owner: { select: userPreviewSelect }, provider: { select: userPreviewSelect }, need: true, offer: true, payment: true, escrow: true } as const;
export const proposalInclude = { applicant: { select: userPreviewSelect }, trade: { include: tradeInclude }, messages: { include: { sender: { select: userPreviewSelect } }, orderBy: { createdAt: 'asc' as const } } } as const;

type DeckRelatedEntity = { id: string } | null | undefined;
type TradeWithDeckRelations = { id: string; ownerId?: string; need?: DeckRelatedEntity; offer?: DeckRelatedEntity };
type TradeDeckHydrated<T extends TradeWithDeckRelations> = Omit<T, 'need' | 'offer'> & {
  media: MediaAsset[];
  need: (NonNullable<T['need']> & { media: MediaAsset[] }) | null;
  offer: (NonNullable<T['offer']> & { media: MediaAsset[] }) | null;
};
type ProposalWithTrade = { trade?: TradeWithDeckRelations | null };

export async function withTradeDeckMedia<T extends TradeWithDeckRelations>(trades: T[], visibility: MediaVisibility = 'owner'): Promise<Array<TradeDeckHydrated<T>>> {
  const tradeIds = trades.map((trade) => trade.id);
  const needIds = trades.map((trade) => trade.need?.id).filter((id): id is string => Boolean(id));
  const offerIds = trades.map((trade) => trade.offer?.id).filter((id): id is string => Boolean(id));

  const [tradeMedia, needMedia, offerMedia] = await Promise.all([
    loadMediaByEntityIds('trade', tradeIds, visibility),
    loadMediaByEntityIds('need', needIds, visibility),
    loadMediaByEntityIds('offer', offerIds, visibility)
  ]);

  return trades.map((trade) => ({
    ...trade,
    media: tradeMedia.get(trade.id) ?? [],
    need: trade.need ? { ...trade.need, media: needMedia.get(trade.need.id) ?? [] } : null,
    offer: trade.offer ? { ...trade.offer, media: offerMedia.get(trade.offer.id) ?? [] } : null
  })) as Array<TradeDeckHydrated<T>>;
}

export async function withOneTradeDeckMedia<T extends TradeWithDeckRelations>(trade: T, visibility: MediaVisibility = 'owner'): Promise<TradeDeckHydrated<T>> {
  const [result] = await withTradeDeckMedia([trade], visibility);
  return result ?? ({ ...trade, media: [], need: null, offer: null } as TradeDeckHydrated<T>);
}

export async function withTradeDeckMediaForActor<T extends TradeWithDeckRelations>(trades: T[], actorId?: string): Promise<Array<TradeDeckHydrated<T>>> {
  if (!actorId) return withTradeDeckMedia(trades, 'public');

  const ownerTrades = trades.filter((trade) => trade.ownerId === actorId);
  const publicTrades = trades.filter((trade) => trade.ownerId !== actorId);
  const [ownerHydrated, publicHydrated] = await Promise.all([
    withTradeDeckMedia(ownerTrades, 'owner'),
    withTradeDeckMedia(publicTrades, 'public')
  ]);
  const hydratedById = new Map([...ownerHydrated, ...publicHydrated].map((trade) => [trade.id, trade]));
  return trades.map((trade) => hydratedById.get(trade.id) ?? ({ ...trade, media: [], need: null, offer: null } as TradeDeckHydrated<T>));
}

export async function withProposalTradeMedia<T extends ProposalWithTrade>(proposals: T[], visibility: MediaVisibility = 'owner'): Promise<T[]> {
  const trades = proposals.map((proposal) => proposal.trade).filter((trade): trade is TradeWithDeckRelations => Boolean(trade));
  const hydratedTrades = await withTradeDeckMedia(trades, visibility);
  const byTradeId = new Map(hydratedTrades.map((trade) => [trade.id, trade]));
  return proposals.map((proposal) => proposal.trade ? { ...proposal, trade: byTradeId.get(proposal.trade.id) ?? proposal.trade } : proposal) as T[];
}

function containsText(value: string) {
  return { contains: value, mode: 'insensitive' as const };
}

function buildFeedWhere(input: ListTradesFeedQuery): Prisma.TradeWhereInput {
  const and: Prisma.TradeWhereInput[] = [
    { status: 'active', isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  ];

  const q = input.q?.trim();
  if (q) {
    const text = containsText(q);
    and.push({
      OR: [
        { title: text },
        { description: text },
        { need: { is: { title: text } } },
        { need: { is: { description: text } } },
        { need: { is: { category: text } } },
        { need: { is: { timing: text } } },
        { need: { is: { locationLabel: text } } },
        { offer: { is: { title: text } } },
        { offer: { is: { description: text } } },
        { offer: { is: { category: text } } },
        { offer: { is: { availability: text } } },
        { offer: { is: { locationLabel: text } } }
      ]
    });
  }

  if (input.mode) {
    and.push({ OR: [{ need: { is: { mode: input.mode } } }, { offer: { is: { mode: input.mode } } }] });
  }

  const category = input.category?.trim();
  if (category) {
    const text = containsText(category);
    and.push({ OR: [{ need: { is: { category: text } } }, { offer: { is: { category: text } } }] });
  }

  if (input.hasMoney) and.push({ amountCents: { gt: 0 } });

  return { AND: and };
}

function tradeMoneySide(trade: { amountCents?: number | null; needId?: string | null; offerId?: string | null }) {
  const amountCents = trade.amountCents ?? 0;
  if (amountCents <= 0) return null;
  if (!trade.needId && trade.offerId) return 'need' as const;
  if (trade.needId && !trade.offerId) return 'offer' as const;
  return 'legacy_optional' as const;
}
function moneyTitle(amountCents: number, currency: string) { return new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100); }

export async function holdOwnerCreditsForProposal(tradeId: string, proposalId: string, ownerId: string, applicantId: string) {
  const mirrorInput: { current: { buyerId: string; sellerId: string; amountCents: number; currency: string; moneySide: ReturnType<typeof tradeMoneySide> } | null } = { current: null };
  const acceptedTrade = await prisma.$transaction(async (tx) => {
    const trade = await tx.trade.findUnique({ where: { id: tradeId }, include: { payment: true } });
    if (!trade) throw Object.assign(new Error('not_found'), { code: 'NOT_FOUND' });
    if (trade.ownerId !== ownerId) throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
    if (trade.status !== 'active') throw Object.assign(new Error('invalid_trade_status_transition'), { code: 'INVALID_TRADE_STATUS_TRANSITION' });
    if (trade.providerId || trade.payment?.status === 'held') throw Object.assign(new Error('trade_already_has_provider'), { code: 'TRADE_ALREADY_HAS_PROVIDER' });

    const amountCents = trade.amountCents ?? 0;
    const currency = trade.currency || 'eur';
    const moneySide = tradeMoneySide(trade);

    if (amountCents > 0) {
      const buyerId = moneySide === 'need' ? applicantId : ownerId;
      const sellerId = moneySide === 'need' ? ownerId : applicantId;
      let wallet = await tx.wallet.findUnique({ where: { userId: buyerId } });
      if (!wallet) wallet = await tx.wallet.create({ data: { userId: buyerId, currency } });
      if (wallet.availableBalanceCents < amountCents) throw Object.assign(new Error('insufficient_wallet_balance'), { code: 'INSUFFICIENT_WALLET_BALANCE' });
      const updatedWallet = await tx.wallet.update({ where: { id: wallet.id }, data: { availableBalanceCents: { decrement: amountCents }, heldBalanceCents: { increment: amountCents }, currency } });
      await tx.creditLedgerEntry.create({ data: { userId: buyerId, walletId: updatedWallet.id, tradeId: trade.id, type: 'trade_hold', balanceType: 'held', amount: 0, amountCents, currency, description: `Wallet money held after accepting proposal for trade: ${trade.title}`, metadata: { proposalId, applicantId, moneySide, walletMoney: true } } });
      await tx.tradePayment.upsert({ where: { tradeId: trade.id }, update: { buyerId, sellerId, creditAmount: 0, amountCents, currency, status: 'held' }, create: { tradeId: trade.id, buyerId, sellerId, creditAmount: 0, amountCents, currency, status: 'held' } });
      await tx.tradeEscrow.upsert({ where: { tradeId: trade.id }, update: { heldCredits: 0, heldAmountCents: amountCents, currency, holdReleasedAt: null }, create: { tradeId: trade.id, heldCredits: 0, heldAmountCents: amountCents, currency } });
      mirrorInput.current = { buyerId, sellerId, amountCents, currency, moneySide };
    }

    await tx.tradeProposal.update({ where: { id: proposalId }, data: { status: 'accepted', respondedAt: new Date() } });
    await tx.tradeProposal.updateMany({ where: { tradeId: trade.id, id: { not: proposalId }, status: 'pending' }, data: { status: 'declined', respondedAt: new Date() } });
    return tx.trade.update({ where: { id: trade.id }, data: { providerId: applicantId, status: 'in_progress', isPublic: false }, include: tradeInclude });
  });

  const mirror = mirrorInput.current;
  if (mirror) {
    await mirrorProviderTradeHold({ tradeId, proposalId, buyerId: mirror.buyerId, sellerId: mirror.sellerId, amountCents: mirror.amountCents, currency: mirror.currency, moneySide: mirror.moneySide });
  }
  return acceptedTrade;
}

tradesRoutes.get('/feed', optionalAuth, asyncRoute(async (req, res) => {
  const input = listTradesFeedQuerySchema.parse(req.query);
  const actorId = req.user?.id;
  const trades = await prisma.trade.findMany({ where: buildFeedWhere(input), include: tradeInclude, orderBy: { createdAt: 'desc' }, take: input.take ?? 50 });
  const hydratedTrades = await withTradeDeckMediaForActor(trades, actorId);
  const filteredTrades = input.hasImages
    ? hydratedTrades.filter((trade) => (trade.need?.media?.length ?? 0) + (trade.offer?.media?.length ?? 0) > 0)
    : hydratedTrades;
  res.json({ trades: filteredTrades });
}));
tradesRoutes.get('/mine', requireAuth, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const trades = await prisma.trade.findMany({ where: { OR: [{ ownerId: actorId }, { providerId: actorId }] }, include: tradeInclude, orderBy: { createdAt: 'desc' } });
  res.json({ trades: await withTradeDeckMedia(trades, 'owner') });
}));
tradesRoutes.get('/:tradeId', optionalAuth, asyncRoute(async (req, res) => {
  const actorId = req.user?.id;
  const trade = await prisma.trade.findFirst({ where: { id: req.params.tradeId, OR: [{ isPublic: true }, ...(actorId ? [{ ownerId: actorId }, { providerId: actorId }, { proposals: { some: { applicantId: actorId } } }] : [])] }, include: tradeInclude });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const visibility: MediaVisibility = actorId && (trade.ownerId === actorId || trade.providerId === actorId) ? 'owner' : 'public';
  res.json({ trade: await withOneTradeDeckMedia(trade, visibility) });
}));
tradesRoutes.post('/', requireAuth, asyncRoute(async (req, res) => {
  const input = createTradeRequestSchema.parse(req.body);
  const actorId = req.user!.id;

  const needIsMoney = input.needKind === 'money';
  const offerIsMoney = input.offerKind === 'money';
  const [need, offer, wallet] = await Promise.all([
    needIsMoney ? Promise.resolve(null) : prisma.need.findFirst({ where: { id: input.needId, ownerId: actorId } }),
    offerIsMoney ? Promise.resolve(null) : prisma.offer.findFirst({ where: { id: input.offerId, ownerId: actorId } }),
    offerIsMoney && input.amountCents > 0 ? prisma.wallet.findUnique({ where: { userId: actorId } }) : Promise.resolve(null)
  ]);
  if (!needIsMoney && !need) return res.status(400).json({ error: 'invalid_need', message: 'Choose one of your saved needs for this trade.' });
  if (!offerIsMoney && !offer) return res.status(400).json({ error: 'invalid_offer', message: 'Choose one of your saved offers for this trade.' });
  if (need && ['fulfilled', 'closed', 'expired'].includes(need.status)) return res.status(409).json({ error: 'need_not_available', message: 'This need is no longer available for a public trade.' });
  if (offer && ['accepted', 'closed', 'expired'].includes(offer.status)) return res.status(409).json({ error: 'offer_not_available', message: 'This offer is no longer available for a public trade.' });
  const limits = await buildLaunchLimits(prisma, actorId);
  const isMoneyTrade = input.amountCents > 0 || needIsMoney || offerIsMoney;
  if (isMoneyTrade) {
    const moneySafety = await buildMoneySafetyStatus(prisma, actorId);
    const block = getMoneySafetyBlock(moneySafety, 'money_trade');
    if (block) return res.status(block.statusCode).json({ error: block.error, message: block.message, moneySafety });
  }
  const activeCount = isMoneyTrade ? limits.activeMoneyTradeCount : limits.activeServiceTradeCount;
  const activeLimit = isMoneyTrade ? limits.moneyActiveTradeLimit : limits.serviceActiveTradeLimit;
  if (activeCount >= activeLimit) return res.status(409).json(limitExceeded(isMoneyTrade ? 'You reached your active money-trade launch limit. Complete trades or verify your account to raise the limit.' : 'You reached your active service-trade launch limit. Complete trades or verify your account to raise the limit.', { trustTier: limits.effectiveTrustTier, activeCount, activeLimit }));
  if (isMoneyTrade && !limits.moneyTradesEnabled) return res.status(403).json(limitExceeded('Money trades are disabled for the beta launch. Create service, goods, or other exchange trades instead.', { trustTier: limits.effectiveTrustTier }));
  if (isMoneyTrade && input.amountCents > limits.perTradeMoneyCapCents) return res.status(409).json(limitExceeded(`Money trades are limited to ${(limits.perTradeMoneyCapCents / 100).toFixed(2)} ${input.currency.toUpperCase()} for your current trust tier.`, { trustTier: limits.effectiveTrustTier, perTradeMoneyCapCents: limits.perTradeMoneyCapCents }));
  if (offerIsMoney && input.amountCents > 0 && (!wallet || wallet.availableBalanceCents < input.amountCents)) return res.status(400).json({ error: 'insufficient_wallet_balance', message: 'You can only offer money that is available in your wallet.' });
  const moneyLabel = moneyTitle(input.amountCents, input.currency);
  const needTitle = needIsMoney ? moneyLabel : need!.title;
  const offerTitle = offerIsMoney ? moneyLabel : offer!.title;
  const needDescription = needIsMoney ? `Wallet money requested: ${moneyLabel}` : need!.description;
  const offerDescription = offerIsMoney ? `Wallet money offered: ${moneyLabel}` : offer!.description;
  const title = input.title?.trim() || `${needTitle} <-> ${offerTitle}`;
  const description = input.description?.trim() || `I need: ${needDescription}

I offer: ${offerDescription}`;

  const trade = await prisma.trade.create({
    data: { ownerId: actorId, title, description, creditAmount: input.creditAmount, amountCents: input.amountCents, currency: input.currency, needId: need?.id ?? null, offerId: offer?.id ?? null, status: 'active', isPublic: true, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null },
    include: tradeInclude
  });

  // Trade-level media is intentionally no longer attached here. The new deck design
  // renders media from the selected Need and Offer, which keeps admin review scoped
  // to reusable user inventory instead of one-off public trades.
  res.status(201).json({ trade: await withOneTradeDeckMedia(trade, 'owner') });
}));
tradesRoutes.get('/:tradeId/proposals', requireAuth, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const trade = await prisma.trade.findUnique({ where: { id: req.params.tradeId } });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const proposals = await prisma.tradeProposal.findMany({ where: trade.ownerId === actorId ? { tradeId: trade.id } : { tradeId: trade.id, applicantId: actorId }, include: proposalInclude, orderBy: { createdAt: 'desc' } });
  res.json({ proposals: await withProposalTradeMedia(proposals, 'owner') });
}));
tradesRoutes.post('/:tradeId/proposals', requireAuth, asyncRoute(async (req, res) => {
  const input = createTradeProposalRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const trade = await prisma.trade.findFirst({ where: { id: req.params.tradeId, status: 'active', isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  if (!trade) return res.status(404).json({ error: 'not_found', message: 'This trade is no longer open for proposals.' });
  if (trade.ownerId === actorId) return res.status(400).json({ error: 'cannot_propose_to_own_trade', message: 'You cannot send a proposal to your own trade.' });
  const existing = await prisma.tradeProposal.findUnique({ where: { tradeId_applicantId: { tradeId: trade.id, applicantId: actorId } }, include: proposalInclude });
  if (existing && existing.status === 'pending') return res.status(409).json({ error: 'proposal_already_exists', message: 'You already have a pending proposal for this trade.', proposal: existing });
  if (existing && existing.status === 'accepted') return res.status(409).json({ error: 'proposal_already_accepted', message: 'Your proposal was already accepted.', proposal: existing });
  const proposal = await prisma.$transaction(async (tx) => {
    const proposalRecord = existing ? await tx.tradeProposal.update({ where: { id: existing.id }, data: { message: input.message, status: 'pending', respondedAt: null } }) : await tx.tradeProposal.create({ data: { tradeId: trade.id, applicantId: actorId, message: input.message } });
    await tx.proposalMessage.create({ data: { proposalId: proposalRecord.id, senderId: actorId, body: input.message } });
    return tx.tradeProposal.findUniqueOrThrow({ where: { id: proposalRecord.id }, include: proposalInclude });
  });
  res.status(existing ? 200 : 201).json({ proposal: (await withProposalTradeMedia([proposal], 'owner'))[0] });
}));
export async function releaseHeldWalletMoney(tx: Prisma.TransactionClient, trade: { id: string; title: string; providerId?: string | null }) {
  const payment = await tx.tradePayment.findUnique({ where: { tradeId: trade.id } });
  if (!payment || payment.status !== 'held' || payment.amountCents <= 0) return;
  const buyerWallet = await tx.wallet.findUnique({ where: { userId: payment.buyerId } });
  if (!buyerWallet) throw new Error('missing_buyer_wallet');
  const sellerId = payment.sellerId ?? trade.providerId ?? payment.buyerId;
  let sellerWallet = await tx.wallet.findUnique({ where: { userId: sellerId } });
  if (!sellerWallet) sellerWallet = await tx.wallet.create({ data: { userId: sellerId, currency: payment.currency } });
  await tx.wallet.update({ where: { id: buyerWallet.id }, data: { heldBalanceCents: { decrement: payment.amountCents } } });
  await tx.creditLedgerEntry.create({ data: { userId: payment.buyerId, walletId: buyerWallet.id, tradeId: trade.id, type: 'trade_release', balanceType: 'held', amount: 0, amountCents: -payment.amountCents, currency: payment.currency, description: `Wallet hold released after payer confirmation for trade: ${trade.title}`, metadata: { providerId: sellerId, walletMoney: true, releasedByPayerConfirmation: true } } });
  await tx.wallet.update({ where: { id: sellerWallet.id }, data: { pendingPayoutCents: { increment: payment.amountCents }, currency: payment.currency } });
  await tx.creditLedgerEntry.create({ data: { userId: sellerId, walletId: sellerWallet.id, tradeId: trade.id, type: 'earned_pending', balanceType: 'earned_pending', amount: 0, amountCents: payment.amountCents, currency: payment.currency, description: `Wallet money pending payout after confirmed trade: ${trade.title}`, metadata: { payoutEligibleLater: true, walletMoney: true } } });
  await tx.tradePayment.update({ where: { id: payment.id }, data: { status: 'released' } });
  await tx.tradeEscrow.updateMany({ where: { tradeId: trade.id }, data: { holdReleasedAt: new Date() } });
}

export async function refundHeldWalletMoney(tx: Prisma.TransactionClient, trade: { id: string; title: string }, actorId: string) {
  const payment = await tx.tradePayment.findUnique({ where: { tradeId: trade.id } });
  if (!payment || payment.amountCents <= 0) return;
  const buyerWallet = await tx.wallet.findUnique({ where: { userId: payment.buyerId } });
  if (payment.status === 'held') {
    if (buyerWallet) {
      const wallet = await tx.wallet.update({ where: { id: buyerWallet.id }, data: { heldBalanceCents: { decrement: payment.amountCents }, availableBalanceCents: { increment: payment.amountCents } } });
      await tx.creditLedgerEntry.create({ data: { userId: payment.buyerId, walletId: wallet.id, tradeId: trade.id, type: 'trade_refund', balanceType: 'held', amount: 0, amountCents: -payment.amountCents, currency: payment.currency, description: `Wallet hold refunded for cancelled trade: ${trade.title}`, metadata: { cancelledBy: actorId, walletMoney: true } } });
      await tx.creditLedgerEntry.create({ data: { userId: payment.buyerId, walletId: wallet.id, tradeId: trade.id, type: 'trade_refund', balanceType: 'purchased', amount: 0, amountCents: payment.amountCents, currency: payment.currency, description: `Wallet money returned after cancelled trade: ${trade.title}`, metadata: { cancelledBy: actorId, walletMoney: true } } });
    }
  } else if (payment.status === 'released') {
    const sellerId = payment.sellerId;
    const sellerWallet = sellerId ? await tx.wallet.findUnique({ where: { userId: sellerId } }) : null;
    if (!sellerWallet || !buyerWallet || sellerWallet.pendingPayoutCents < payment.amountCents) throw Object.assign(new Error('released_money_not_reversible'), { code: 'RELEASED_MONEY_NOT_REVERSIBLE' });
    {
      await tx.wallet.update({ where: { id: sellerWallet.id }, data: { pendingPayoutCents: { decrement: payment.amountCents } } });
      await tx.creditLedgerEntry.create({ data: { userId: sellerId!, walletId: sellerWallet.id, tradeId: trade.id, type: 'trade_refund', balanceType: 'earned_pending', amount: 0, amountCents: -payment.amountCents, currency: payment.currency, description: `Admin reversed pending payout for disputed trade: ${trade.title}`, metadata: { reversedBy: actorId, walletMoney: true } } });
      const wallet = await tx.wallet.update({ where: { id: buyerWallet.id }, data: { availableBalanceCents: { increment: payment.amountCents } } });
      await tx.creditLedgerEntry.create({ data: { userId: payment.buyerId, walletId: wallet.id, tradeId: trade.id, type: 'trade_refund', balanceType: 'purchased', amount: 0, amountCents: payment.amountCents, currency: payment.currency, description: `Wallet money returned after admin dispute resolution: ${trade.title}`, metadata: { reversedBy: actorId, walletMoney: true } } });
    }
  } else {
    return;
  }
  await tx.tradePayment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
  await tx.tradeEscrow.updateMany({ where: { tradeId: trade.id }, data: { holdReleasedAt: new Date() } });
}

tradesRoutes.patch('/:tradeId/status', requireAuth, asyncRoute(async (req, res) => {
  const input = updateTradeStatusRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const trade = await prisma.trade.findUnique({ where: { id: req.params.tradeId }, include: tradeInclude });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const isOwner = trade.ownerId === actorId;
  const isProvider = trade.providerId === actorId;
  if (!isOwner && !isProvider) return res.status(403).json({ error: 'forbidden' });
  if (input.status === trade.status) return res.json({ trade: await withOneTradeDeckMedia(trade, 'owner') });
  if (trade.status === 'disputed' && input.status !== 'cancelled') return res.status(409).json({ error: 'trade_disputed', message: 'This trade is disputed. Admin must resolve the money flow before it can continue.' });

  if (input.status === 'submitted') {
    if (trade.status !== 'in_progress') return res.status(409).json({ error: 'invalid_trade_status_transition' });
    const payment = trade.payment;
    if (payment?.status === 'held' && payment.amountCents > 0 && payment.sellerId !== actorId) {
      return res.status(403).json({ error: 'payer_cannot_submit_delivery', message: 'The person receiving wallet money must mark delivery first. The payer confirms and releases money after reviewing it.' });
    }
    const updated = await prisma.trade.update({ where: { id: trade.id }, data: { status: 'submitted', deliverySubmittedById: actorId, deliverySubmittedAt: new Date() }, include: tradeInclude });
    return res.json({ trade: await withOneTradeDeckMedia(updated, 'owner') });
  }

  if (input.status === 'completed') {
    if (trade.status !== 'submitted') return res.status(409).json({ error: 'delivery_confirmation_required', message: 'The provider must mark delivery before the other party can confirm completion.' });
    const payment = trade.payment;
    if (payment?.status === 'held' && payment.amountCents > 0 && payment.buyerId !== actorId) {
      return res.status(403).json({ error: 'payer_confirmation_required', message: 'Only the wallet-money payer can confirm and release held money.' });
    }
    if (trade.deliverySubmittedById === actorId) {
      return res.status(403).json({ error: 'self_confirmation_blocked', message: 'The person who marked delivery cannot also confirm completion.' });
    }
    const releasePayment = payment;
    const updated = await prisma.$transaction(async (tx) => {
      await releaseHeldWalletMoney(tx, trade);
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'completed', isPublic: false, closedAt: new Date(), confirmedById: actorId, confirmedAt: new Date() }, include: tradeInclude });
    });
    if (releasePayment?.status === 'held' && releasePayment.amountCents > 0 && releasePayment.sellerId) {
      await mirrorProviderTradeRelease({ tradeId: trade.id, buyerId: releasePayment.buyerId, sellerId: releasePayment.sellerId, amountCents: releasePayment.amountCents, currency: releasePayment.currency, confirmedById: actorId });
    }
    return res.json({ trade: await withOneTradeDeckMedia(updated, 'owner') });
  }

  if (input.status === 'disputed') {
    if (!['active', 'in_progress', 'submitted'].includes(trade.status)) return res.status(409).json({ error: 'invalid_trade_status_transition' });
    const updated = await prisma.trade.update({ where: { id: trade.id }, data: { status: 'disputed', isPublic: false, disputedById: actorId, disputedAt: new Date() }, include: tradeInclude });
    return res.json({ trade: await withOneTradeDeckMedia(updated, 'owner') });
  }

  if (input.status === 'cancelled') {
    if (!isOwner && !(isProvider && ['in_progress', 'submitted'].includes(trade.status))) return res.status(403).json({ error: 'forbidden' });
    if (['completed', 'cancelled', 'closed'].includes(trade.status)) return res.status(409).json({ error: 'invalid_trade_status_transition' });
    const refundPayment = trade.payment;
    const updated = await prisma.$transaction(async (tx) => {
      await refundHeldWalletMoney(tx, trade, actorId);
      await tx.tradeProposal.updateMany({ where: { tradeId: trade.id, status: 'pending' }, data: { status: 'declined', respondedAt: new Date() } });
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'cancelled', isPublic: false, closedAt: new Date() }, include: tradeInclude });
    });
    if (refundPayment && ['held', 'released'].includes(refundPayment.status) && refundPayment.amountCents > 0) {
      await mirrorProviderTradeRefund({ tradeId: trade.id, buyerId: refundPayment.buyerId, sellerId: refundPayment.sellerId, amountCents: refundPayment.amountCents, currency: refundPayment.currency, refundedById: actorId, wasReleased: refundPayment.status === 'released', reason: 'trade_cancelled' });
    }
    return res.json({ trade: await withOneTradeDeckMedia(updated, 'owner') });
  }
  return res.status(409).json({ error: 'invalid_trade_status_transition' });
}));
tradesRoutes.post('/:tradeId/close', requireAuth, asyncRoute(async (req, res) => {
  const trade = await prisma.trade.findFirst({ where: { id: req.params.tradeId, ownerId: req.user!.id } });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const closed = await prisma.trade.update({ where: { id: trade.id }, data: { status: 'closed', isPublic: false, closedAt: new Date() }, include: tradeInclude });
  res.json({ trade: await withOneTradeDeckMedia(closed, 'owner') });
}));
