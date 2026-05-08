import { Router } from 'express';
import type { MediaAsset, Prisma } from '@prisma/client';
import { createTradeProposalRequestSchema, createTradeRequestSchema, listTradesFeedQuerySchema, updateTradeStatusRequestSchema, type ListTradesFeedQuery } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { loadMediaByEntityIds, type MediaVisibility } from '../media/media.helpers.js';

export const tradesRoutes = Router();
const userPreviewSelect = { id: true, profile: true } as const;
export const tradeInclude = { owner: { select: userPreviewSelect }, provider: { select: userPreviewSelect }, need: true, offer: true, payment: true, escrow: true } as const;
export const proposalInclude = { applicant: { select: userPreviewSelect }, trade: { include: tradeInclude }, messages: { include: { sender: { select: userPreviewSelect } }, orderBy: { createdAt: 'asc' as const } } } as const;

type DeckRelatedEntity = { id: string } | null | undefined;
type TradeWithDeckRelations = { id: string; need?: DeckRelatedEntity; offer?: DeckRelatedEntity };
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

export async function holdOwnerCreditsForProposal(tradeId: string, proposalId: string, ownerId: string, applicantId: string) {
  return prisma.$transaction(async (tx) => {
    const trade = await tx.trade.findUnique({ where: { id: tradeId }, include: { payment: true } });
    if (!trade) throw Object.assign(new Error('not_found'), { code: 'NOT_FOUND' });
    if (trade.ownerId !== ownerId) throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
    if (trade.status !== 'active') throw Object.assign(new Error('invalid_trade_status_transition'), { code: 'INVALID_TRADE_STATUS_TRANSITION' });
    if (trade.providerId || trade.payment?.status === 'held') throw Object.assign(new Error('trade_already_has_provider'), { code: 'TRADE_ALREADY_HAS_PROVIDER' });

    const amountCents = trade.amountCents ?? 0;
    const currency = trade.currency || 'eur';

    if (amountCents > 0) {
      let wallet = await tx.wallet.findUnique({ where: { userId: ownerId } });
      if (!wallet) wallet = await tx.wallet.create({ data: { userId: ownerId, currency } });
      if (wallet.availableBalanceCents < amountCents) throw Object.assign(new Error('insufficient_wallet_balance'), { code: 'INSUFFICIENT_WALLET_BALANCE' });

      const updatedWallet = await tx.wallet.update({ where: { id: wallet.id }, data: { availableBalanceCents: { decrement: amountCents }, heldBalanceCents: { increment: amountCents }, currency } });
      await tx.creditLedgerEntry.create({ data: { userId: ownerId, walletId: updatedWallet.id, tradeId: trade.id, type: 'trade_hold', balanceType: 'held', amount: 0, amountCents, currency, description: `Wallet money held after accepting proposal for trade: ${trade.title}`, metadata: { proposalId, applicantId, walletMoney: true } } });
      await tx.tradePayment.upsert({ where: { tradeId: trade.id }, update: { buyerId: ownerId, sellerId: applicantId, creditAmount: 0, amountCents, currency, status: 'held' }, create: { tradeId: trade.id, buyerId: ownerId, sellerId: applicantId, creditAmount: 0, amountCents, currency, status: 'held' } });
      await tx.tradeEscrow.upsert({ where: { tradeId: trade.id }, update: { heldCredits: 0, heldAmountCents: amountCents, currency, holdReleasedAt: null }, create: { tradeId: trade.id, heldCredits: 0, heldAmountCents: amountCents, currency } });
    }

    await tx.tradeProposal.update({ where: { id: proposalId }, data: { status: 'accepted', respondedAt: new Date() } });
    await tx.tradeProposal.updateMany({ where: { tradeId: trade.id, id: { not: proposalId }, status: 'pending' }, data: { status: 'declined', respondedAt: new Date() } });
    return tx.trade.update({ where: { id: trade.id }, data: { providerId: applicantId, status: 'in_progress', isPublic: false }, include: tradeInclude });
  });
}

tradesRoutes.get('/feed', asyncRoute(async (req, res) => {
  const input = listTradesFeedQuerySchema.parse(req.query);
  const trades = await prisma.trade.findMany({ where: buildFeedWhere(input), include: tradeInclude, orderBy: { createdAt: 'desc' }, take: input.take ?? 50 });
  const hydratedTrades = await withTradeDeckMedia(trades, 'public');
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

  const [need, offer] = await Promise.all([
    prisma.need.findFirst({ where: { id: input.needId, ownerId: actorId } }),
    prisma.offer.findFirst({ where: { id: input.offerId, ownerId: actorId } })
  ]);

  if (!need) return res.status(400).json({ error: 'invalid_need', message: 'Choose one of your saved needs for this trade.' });
  if (!offer) return res.status(400).json({ error: 'invalid_offer', message: 'Choose one of your saved offers for this trade.' });
  if (['fulfilled', 'closed', 'expired'].includes(need.status)) return res.status(409).json({ error: 'need_not_available', message: 'This need is no longer available for a public trade.' });
  if (['accepted', 'closed', 'expired'].includes(offer.status)) return res.status(409).json({ error: 'offer_not_available', message: 'This offer is no longer available for a public trade.' });

  const title = input.title?.trim() || `${need.title} <-> ${offer.title}`;
  const description = input.description?.trim() || `I need: ${need.description}\n\nI offer: ${offer.description}`;

  const trade = await prisma.trade.create({
    data: {
      ownerId: actorId,
      title,
      description,
      creditAmount: input.creditAmount,
      amountCents: input.amountCents,
      currency: input.currency,
      needId: need.id,
      offerId: offer.id,
      status: 'active',
      isPublic: true,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    },
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
tradesRoutes.patch('/:tradeId/status', requireAuth, asyncRoute(async (req, res) => {
  const input = updateTradeStatusRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const trade = await prisma.trade.findUnique({ where: { id: req.params.tradeId }, include: tradeInclude });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const isOwner = trade.ownerId === actorId;
  const isProvider = trade.providerId === actorId;
  if (!isOwner && !isProvider) return res.status(403).json({ error: 'forbidden' });
  if (input.status === trade.status) return res.json({ trade: await withOneTradeDeckMedia(trade, 'owner') });
  if (input.status === 'completed') {
    if (!isOwner) return res.status(403).json({ error: 'forbidden', message: 'Only the trade owner can complete this trade.' });
    if (!['in_progress', 'submitted'].includes(trade.status)) return res.status(409).json({ error: 'invalid_trade_status_transition' });
    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.tradePayment.findUnique({ where: { tradeId: trade.id } });
      if (payment?.status === 'held' && payment.amountCents > 0) {
        const buyerWallet = await tx.wallet.findUnique({ where: { userId: payment.buyerId } });
        if (!buyerWallet) throw new Error('missing_buyer_wallet');
        const sellerId = payment.sellerId ?? trade.providerId ?? payment.buyerId;
        let sellerWallet = await tx.wallet.findUnique({ where: { userId: sellerId } });
        if (!sellerWallet) sellerWallet = await tx.wallet.create({ data: { userId: sellerId, currency: payment.currency } });
        await tx.wallet.update({ where: { id: buyerWallet.id }, data: { heldBalanceCents: { decrement: payment.amountCents } } });
        await tx.creditLedgerEntry.create({ data: { userId: payment.buyerId, walletId: buyerWallet.id, tradeId: trade.id, type: 'trade_release', balanceType: 'held', amount: 0, amountCents: -payment.amountCents, currency: payment.currency, description: `Wallet hold released for completed trade: ${trade.title}`, metadata: { providerId: sellerId, walletMoney: true } } });
        await tx.wallet.update({ where: { id: sellerWallet.id }, data: { pendingPayoutCents: { increment: payment.amountCents }, currency: payment.currency } });
        await tx.creditLedgerEntry.create({ data: { userId: sellerId, walletId: sellerWallet.id, tradeId: trade.id, type: 'earned_pending', balanceType: 'earned_pending', amount: 0, amountCents: payment.amountCents, currency: payment.currency, description: `Wallet money pending payout for completed trade: ${trade.title}`, metadata: { payoutEligibleLater: true, walletMoney: true } } });
        await tx.tradePayment.update({ where: { id: payment.id }, data: { status: 'released' } });
        await tx.tradeEscrow.updateMany({ where: { tradeId: trade.id }, data: { holdReleasedAt: new Date() } });
      }
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'completed', isPublic: false, closedAt: new Date() }, include: tradeInclude });
    });
    return res.json({ trade: await withOneTradeDeckMedia(updated, 'owner') });
  }
  if (input.status === 'cancelled') {
    if (!isOwner && !(isProvider && trade.status === 'in_progress')) return res.status(403).json({ error: 'forbidden' });
    if (['completed', 'cancelled', 'closed'].includes(trade.status)) return res.status(409).json({ error: 'invalid_trade_status_transition' });
    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.tradePayment.findUnique({ where: { tradeId: trade.id } });
      if (payment?.status === 'held' && payment.amountCents > 0) {
        const buyerWallet = await tx.wallet.findUnique({ where: { userId: payment.buyerId } });
        if (buyerWallet) {
          const wallet = await tx.wallet.update({ where: { id: buyerWallet.id }, data: { heldBalanceCents: { decrement: payment.amountCents }, availableBalanceCents: { increment: payment.amountCents } } });
          await tx.creditLedgerEntry.create({ data: { userId: payment.buyerId, walletId: wallet.id, tradeId: trade.id, type: 'trade_refund', balanceType: 'held', amount: 0, amountCents: -payment.amountCents, currency: payment.currency, description: `Wallet hold refunded for cancelled trade: ${trade.title}`, metadata: { cancelledBy: actorId, walletMoney: true } } });
          await tx.creditLedgerEntry.create({ data: { userId: payment.buyerId, walletId: wallet.id, tradeId: trade.id, type: 'trade_refund', balanceType: 'purchased', amount: 0, amountCents: payment.amountCents, currency: payment.currency, description: `Wallet money returned after cancelled trade: ${trade.title}`, metadata: { cancelledBy: actorId, walletMoney: true } } });
        }
        await tx.tradePayment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
        await tx.tradeEscrow.updateMany({ where: { tradeId: trade.id }, data: { holdReleasedAt: new Date() } });
      }
      await tx.tradeProposal.updateMany({ where: { tradeId: trade.id, status: 'pending' }, data: { status: 'declined', respondedAt: new Date() } });
      return tx.trade.update({ where: { id: trade.id }, data: { status: 'cancelled', isPublic: false, closedAt: new Date() }, include: tradeInclude });
    });
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
