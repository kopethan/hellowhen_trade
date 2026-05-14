import { Router } from 'express';
import type { MediaAsset, Prisma } from '@prisma/client';
import { createTradeProposalRequestSchema, createTradeRequestSchema, listTradesFeedQuerySchema, updateTradeStatusRequestSchema, type ListTradesFeedQuery } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { buildLaunchLimits, limitExceeded } from '../limits/launchLimits.js';
import { buildMoneySafetyStatus, getMoneySafetyBlock } from '../money/moneySafety.js';
import { mirrorProviderTradeHold, mirrorProviderTradeRefund, mirrorProviderTradeRelease } from '../money/tradeMoney.js';
import { loadMediaByEntityIds, type MediaVisibility } from '../media/media.helpers.js';
import { publicUserPreviewSelect } from '../users/publicUser.js';

export const tradesRoutes = Router();
export const tradeInclude = { owner: { select: publicUserPreviewSelect }, provider: { select: publicUserPreviewSelect }, need: true, offer: true, payment: true, escrow: true } as const;
const feedTradeInclude = {
  owner: { select: { ...publicUserPreviewSelect, settings: { select: { language: true } } } },
  provider: { select: publicUserPreviewSelect },
  need: true,
  offer: true,
  payment: true,
  escrow: true
} as const;
export const proposalInclude = { applicant: { select: publicUserPreviewSelect }, trade: { include: tradeInclude }, proposedNeed: true, proposedOffer: true, messages: { include: { sender: { select: publicUserPreviewSelect } }, orderBy: { createdAt: 'asc' as const } } } as const;

type DeckRelatedEntity = { id: string } | null | undefined;
type TradeWithDeckRelations = { id: string; ownerId?: string; need?: DeckRelatedEntity; offer?: DeckRelatedEntity };
type TradeDeckHydrated<T extends TradeWithDeckRelations> = Omit<T, 'need' | 'offer'> & {
  media: MediaAsset[];
  need: (NonNullable<T['need']> & { media: MediaAsset[] }) | null;
  offer: (NonNullable<T['offer']> & { media: MediaAsset[] }) | null;
};
type ProposalWithTrade = { trade?: TradeWithDeckRelations | null; proposedNeed?: DeckRelatedEntity; proposedOffer?: DeckRelatedEntity };

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
  if (!actorId) return withTradeDeckMedia(trades, 'trade_public');

  const ownerTrades = trades.filter((trade) => trade.ownerId === actorId);
  const publicTrades = trades.filter((trade) => trade.ownerId !== actorId);
  const [ownerHydrated, publicHydrated] = await Promise.all([
    withTradeDeckMedia(ownerTrades, 'owner'),
    withTradeDeckMedia(publicTrades, 'trade_public')
  ]);
  const hydratedById = new Map([...ownerHydrated, ...publicHydrated].map((trade) => [trade.id, trade]));
  return trades.map((trade) => hydratedById.get(trade.id) ?? ({ ...trade, media: [], need: null, offer: null } as TradeDeckHydrated<T>));
}

export async function withProposalTradeMedia<T extends ProposalWithTrade>(proposals: T[], visibility: MediaVisibility = 'owner'): Promise<T[]> {
  const trades = proposals.map((proposal) => proposal.trade).filter((trade): trade is TradeWithDeckRelations => Boolean(trade));
  const proposedNeedIds = proposals.map((proposal) => proposal.proposedNeed?.id).filter((id): id is string => Boolean(id));
  const proposedOfferIds = proposals.map((proposal) => proposal.proposedOffer?.id).filter((id): id is string => Boolean(id));
  const [hydratedTrades, proposedNeedMedia, proposedOfferMedia] = await Promise.all([
    withTradeDeckMedia(trades, visibility),
    loadMediaByEntityIds('need', proposedNeedIds, visibility),
    loadMediaByEntityIds('offer', proposedOfferIds, visibility)
  ]);
  const byTradeId = new Map(hydratedTrades.map((trade) => [trade.id, trade]));
  return proposals.map((proposal) => ({
    ...proposal,
    trade: proposal.trade ? byTradeId.get(proposal.trade.id) ?? proposal.trade : proposal.trade,
    proposedNeed: proposal.proposedNeed ? { ...proposal.proposedNeed, media: proposedNeedMedia.get(proposal.proposedNeed.id) ?? [] } : proposal.proposedNeed,
    proposedOffer: proposal.proposedOffer ? { ...proposal.proposedOffer, media: proposedOfferMedia.get(proposal.proposedOffer.id) ?? [] } : proposal.proposedOffer,
  })) as T[];
}

function containsText(value: string) {
  return { contains: value, mode: 'insensitive' as const };
}

function betaMoneyOff() {
  return !env.moneyFeaturesVisible || env.moneyLaunchMode === 'disabled' || !env.moneyTradesEnabled;
}

function noMoneyTradeWhere(): Prisma.TradeWhereInput {
  return { amountCents: { lte: 0 }, creditAmount: { lte: 0 } };
}

function tradeHasMoneySurface(trade: { amountCents?: number | null; creditAmount?: number | null; payment?: { amountCents?: number | null; creditAmount?: number | null } | null; escrow?: { heldAmountCents?: number | null; heldCredits?: number | null } | null }) {
  return (trade.amountCents ?? 0) > 0
    || (trade.creditAmount ?? 0) > 0
    || (trade.payment?.amountCents ?? 0) > 0
    || (trade.payment?.creditAmount ?? 0) > 0
    || (trade.escrow?.heldAmountCents ?? 0) > 0
    || (trade.escrow?.heldCredits ?? 0) > 0;
}

function betaMoneyDisabledPayload() {
  return {
    error: 'money_trades_disabled',
    message: 'Money, wallet, and credit trades are disabled for the first beta. Create Need + Offer exchanges only.'
  };
}

function proposalSideRequirement(postType?: string | null) {
  if (postType === 'open_need') return 'offer' as const;
  if (postType === 'open_offer') return 'need' as const;
  return null;
}

function inventoryUnavailable(status?: string | null) {
  return status !== 'active';
}


const FEED_URGENCY = {
  expired: -1000,
  expiresWithin24h: 28,
  expiresWithin72h: 18,
  expiresWithin7d: 8,
  expiresWithin14d: 0,
  longExpiry: -6,
  noExpiry: -8,
} as const;

const DISCOVERY_SEED_SALT = 'hellowhen-feed-v1';
const MAX_SEEN_TRADE_PENALTY = 36;

type FeedRankableTrade = {
  id: string;
  ownerId?: string | null;
  postType?: string | null;
  title?: string | null;
  description?: string | null;
  amountCents?: number | null;
  creditAmount?: number | null;
  owner?: {
    profile?: { countryCode?: string | null } | null;
    settings?: { language?: string | null } | null;
  } | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  need?: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
    timing?: string | null;
    mode?: string | null;
    locationLabel?: string | null;
    tags?: string[] | null;
    media?: unknown[] | null;
  } | null;
  offer?: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
    availability?: string | null;
    mode?: string | null;
    locationLabel?: string | null;
    includes?: string[] | null;
    tags?: string[] | null;
    media?: unknown[] | null;
  } | null;
};

type FeedDiscoveryPreferences = {
  language: 'en' | 'fr';
  countryCode?: string;
};

type FeedDiscoveryContext = {
  filters: ListTradesFeedQuery;
  refreshSeed: string;
  seenTradeIds: Set<string>;
  nowMs: number;
  preferences: FeedDiscoveryPreferences;
};

function toDateMs(value?: Date | string | null) {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getExpiryUrgencyBoost(expiresAt: Date | string | null | undefined, nowMs: number) {
  const expiresMs = toDateMs(expiresAt);
  if (!expiresMs) return FEED_URGENCY.noExpiry;

  const hoursLeft = (expiresMs - nowMs) / 36e5;
  if (hoursLeft <= 0) return FEED_URGENCY.expired;
  if (hoursLeft <= 24) return FEED_URGENCY.expiresWithin24h;
  if (hoursLeft <= 72) return FEED_URGENCY.expiresWithin72h;
  if (hoursLeft <= 168) return FEED_URGENCY.expiresWithin7d;
  if (hoursLeft <= 336) return FEED_URGENCY.expiresWithin14d;
  return FEED_URGENCY.longExpiry;
}

function hashStringToUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function seededJitter(seed: string, tradeId: string, spread = 18) {
  return (hashStringToUnit(`${DISCOVERY_SEED_SALT}:${seed}:${tradeId}`) - 0.5) * spread;
}

function normalizeDiscoveryLanguage(value?: string | null): 'en' | 'fr' | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'system') return null;
  const base = normalized.replace('_', '-').split('-')[0];
  return base === 'fr' || base === 'en' ? base : null;
}

function normalizeCountryCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function resolveLanguageFromAcceptLanguage(value: unknown): 'en' | 'fr' | null {
  if (typeof value !== 'string') return null;
  const candidates = value.split(',').map((entry) => entry.split(';')[0]?.trim()).filter(Boolean);
  for (const candidate of candidates) {
    const language = normalizeDiscoveryLanguage(candidate);
    if (language) return language;
  }
  return null;
}

function resolveFeedDiscoveryPreferences(
  filters: ListTradesFeedQuery,
  actorPreferences: { profile?: { countryCode?: string | null } | null; settings?: { language?: string | null } | null } | null | undefined,
  acceptLanguageHeader: unknown,
): FeedDiscoveryPreferences {
  return {
    language: normalizeDiscoveryLanguage(filters.language)
      ?? normalizeDiscoveryLanguage(actorPreferences?.settings?.language)
      ?? resolveLanguageFromAcceptLanguage(acceptLanguageHeader)
      ?? 'en',
    countryCode: normalizeCountryCode(filters.countryCode) ?? normalizeCountryCode(actorPreferences?.profile?.countryCode),
  };
}

function getLocaleAffinityScore(trade: FeedRankableTrade, preferences: FeedDiscoveryPreferences) {
  let score = 0;
  const ownerCountry = normalizeCountryCode(trade.owner?.profile?.countryCode);
  const ownerLanguage = normalizeDiscoveryLanguage(trade.owner?.settings?.language);

  if (preferences.countryCode && ownerCountry) {
    if (ownerCountry === preferences.countryCode) score += 20;
    else if (getFeedModeKey(trade) === 'local') score -= 8;
  }

  if (ownerLanguage) {
    if (ownerLanguage === preferences.language) score += 16;
    else score -= 5;
  }

  return score;
}

function stripFeedRankingOnlyFields<T extends FeedRankableTrade>(trade: T): T {
  if (!trade.owner || typeof trade.owner !== 'object' || !('settings' in trade.owner)) return trade;
  const owner = { ...trade.owner };
  delete (owner as { settings?: unknown }).settings;
  return { ...trade, owner } as T;
}

function textContains(value: string | null | undefined, query: string) {
  return Boolean(value?.toLowerCase().includes(query));
}

function getSearchRelevanceScore(trade: FeedRankableTrade, query?: string) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return 0;

  let score = 0;
  if (textContains(trade.title, normalized)) score += 18;
  if (textContains(trade.need?.title, normalized)) score += 16;
  if (textContains(trade.offer?.title, normalized)) score += 16;
  if (textContains(trade.need?.category, normalized)) score += 10;
  if (textContains(trade.offer?.category, normalized)) score += 10;
  if (textContains(trade.description, normalized)) score += 6;
  if (textContains(trade.need?.description, normalized)) score += 5;
  if (textContains(trade.offer?.description, normalized)) score += 5;
  return score;
}

function getCompletenessScore(trade: FeedRankableTrade) {
  const mediaCount = (trade.need?.media?.length ?? 0) + (trade.offer?.media?.length ?? 0);
  const hasNeedMetadata = Boolean(trade.need?.category || trade.need?.mode || trade.need?.locationLabel || trade.need?.timing || (trade.need?.tags?.length ?? 0) > 0);
  const hasOfferMetadata = Boolean(trade.offer?.category || trade.offer?.mode || trade.offer?.locationLabel || trade.offer?.availability || (trade.offer?.tags?.length ?? 0) > 0 || (trade.offer?.includes?.length ?? 0) > 0);
  let score = 0;
  if (mediaCount > 0) score += 8;
  if (mediaCount > 1) score += 3;
  if (hasNeedMetadata) score += 4;
  if (hasOfferMetadata) score += 4;
  if (trade.need && trade.offer) score += 5;
  if ((trade.amountCents ?? 0) > 0 || (trade.creditAmount ?? 0) > 0) score -= 12;
  return score;
}

function getFreshnessScore(trade: FeedRankableTrade, nowMs: number) {
  const createdMs = toDateMs(trade.createdAt) ?? nowMs;
  const updatedMs = toDateMs(trade.updatedAt) ?? createdMs;
  const ageHours = Math.max(0, (nowMs - createdMs) / 36e5);
  const updatedAgeHours = Math.max(0, (nowMs - updatedMs) / 36e5);
  const createdRecency = Math.max(0, 100 - ageHours * 0.65);
  const updatedRecency = Math.max(0, 16 - updatedAgeHours * 0.22);
  return createdRecency + updatedRecency;
}

function getFeedCategoryKey(trade: FeedRankableTrade) {
  return (trade.need?.category || trade.offer?.category || 'uncategorized').trim().toLowerCase();
}

function getFeedModeKey(trade: FeedRankableTrade) {
  return (trade.need?.mode || trade.offer?.mode || 'unknown').trim().toLowerCase();
}

function getFeedDiscoveryScore(trade: FeedRankableTrade, context: FeedDiscoveryContext) {
  const seenPenalty = context.seenTradeIds.has(trade.id) ? MAX_SEEN_TRADE_PENALTY : 0;
  const filterMatchBoost = context.filters.mode && (trade.need?.mode === context.filters.mode || trade.offer?.mode === context.filters.mode) ? 8 : 0;
  const categoryFilter = context.filters.category?.trim().toLowerCase();
  const categoryMatchBoost = categoryFilter && (textContains(trade.need?.category, categoryFilter) || textContains(trade.offer?.category, categoryFilter)) ? 8 : 0;

  return getFreshnessScore(trade, context.nowMs)
    + getExpiryUrgencyBoost(trade.expiresAt, context.nowMs)
    + getCompletenessScore(trade)
    + getSearchRelevanceScore(trade, context.filters.q)
    + getLocaleAffinityScore(trade, context.preferences)
    + filterMatchBoost
    + categoryMatchBoost
    + seededJitter(context.refreshSeed, trade.id)
    - seenPenalty;
}

function diversifyRankedTrades<T extends FeedRankableTrade>(ranked: T[], context: FeedDiscoveryContext) {
  const remaining = [...ranked];
  const result: T[] = [];
  const recentOwners: string[] = [];
  const recentCategories: string[] = [];
  const recentPostTypes: string[] = [];

  while (remaining.length) {
    let bestIndex = 0;
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < Math.min(remaining.length, 18); index += 1) {
      const trade = remaining[index];
      const ownerKey = trade.ownerId || 'unknown';
      const categoryKey = getFeedCategoryKey(trade);
      const postTypeKey = trade.postType || 'need_offer';
      const modeKey = getFeedModeKey(trade);
      const baseRankPenalty = index * 0.7;
      const ownerPenalty = recentOwners.includes(ownerKey) ? 18 : 0;
      const categoryPenalty = categoryKey !== 'uncategorized' && recentCategories.includes(categoryKey) ? 9 : 0;
      const postTypePenalty = recentPostTypes.filter((value) => value === postTypeKey).length >= 2 ? 7 : 0;
      const modeBoost = context.filters.mode && modeKey === context.filters.mode ? 3 : 0;
      const adjustedScore = getFeedDiscoveryScore(trade, context) + modeBoost - baseRankPenalty - ownerPenalty - categoryPenalty - postTypePenalty;

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    result.push(next);
    recentOwners.push(next.ownerId || 'unknown');
    recentCategories.push(getFeedCategoryKey(next));
    recentPostTypes.push(next.postType || 'need_offer');
    if (recentOwners.length > 3) recentOwners.shift();
    if (recentCategories.length > 4) recentCategories.shift();
    if (recentPostTypes.length > 4) recentPostTypes.shift();
  }

  return result;
}

function buildFeedRefreshSeed(input: ListTradesFeedQuery, actorId?: string) {
  const requestedSeed = input.refreshSeed?.trim();
  if (requestedSeed) return requestedSeed;
  const dayBucket = Math.floor(Date.now() / 86_400_000);
  return `${actorId ?? 'anonymous'}:${dayBucket}`;
}

function sortTradesForDiscovery<T extends FeedRankableTrade>(trades: T[], filters: ListTradesFeedQuery, actorId: string | undefined, preferences: FeedDiscoveryPreferences) {
  const context: FeedDiscoveryContext = {
    filters,
    refreshSeed: buildFeedRefreshSeed(filters, actorId),
    seenTradeIds: new Set(filters.seenTradeIds ?? []),
    nowMs: Date.now(),
    preferences,
  };
  const ranked = [...trades].sort((left, right) => {
    const scoreDelta = getFeedDiscoveryScore(right, context) - getFeedDiscoveryScore(left, context);
    if (Math.abs(scoreDelta) > 0.001) return scoreDelta;

    const createdDelta = (toDateMs(right.createdAt) ?? 0) - (toDateMs(left.createdAt) ?? 0);
    if (createdDelta !== 0) return createdDelta;
    return left.id.localeCompare(right.id);
  });

  return diversifyRankedTrades(ranked, context);
}

export function publicTradeVisibilityWhere(now = new Date()): Prisma.TradeWhereInput {
  return {
    AND: [
      { status: 'active', isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { owner: { trustTier: { not: 'restricted' } } },
      { OR: [{ needId: null }, { need: { is: { status: 'active' } } }] },
      { OR: [{ offerId: null }, { offer: { is: { status: 'active' } } }] },
    ],
  };
}

function buildFeedWhere(input: ListTradesFeedQuery): Prisma.TradeWhereInput {
  const and: Prisma.TradeWhereInput[] = [publicTradeVisibilityWhere()];

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

  if (input.postType) {
    and.push({ postType: input.postType });
  }

  if (!env.moneyFeaturesVisible || env.moneyLaunchMode === 'disabled') {
    and.push(noMoneyTradeWhere());
  } else if (input.hasMoney) {
    and.push({ amountCents: { gt: 0 } });
  }

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
    if (amountCents > 0 && betaMoneyOff()) throw Object.assign(new Error('money_trades_disabled'), { code: 'MONEY_TRADES_DISABLED' });
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

    const proposal = await tx.tradeProposal.findUnique({ where: { id: proposalId }, select: { id: true, applicantId: true, proposedNeedId: true, proposedOfferId: true } });
    if (!proposal || proposal.applicantId !== applicantId) throw Object.assign(new Error('not_found'), { code: 'NOT_FOUND' });

    const acceptedSideUpdate: { needId?: string; offerId?: string } = {};
    if (trade.postType === 'open_need') {
      if (!proposal.proposedOfferId) throw Object.assign(new Error('proposal_offer_required'), { code: 'PROPOSAL_SIDE_REQUIRED' });
      const proposedOffer = await tx.offer.findFirst({ where: { id: proposal.proposedOfferId, ownerId: applicantId } });
      if (!proposedOffer || inventoryUnavailable(proposedOffer.status)) throw Object.assign(new Error('invalid_proposal_offer'), { code: 'PROPOSAL_SIDE_UNAVAILABLE' });
      acceptedSideUpdate.offerId = proposedOffer.id;
    }
    if (trade.postType === 'open_offer') {
      if (!proposal.proposedNeedId) throw Object.assign(new Error('proposal_need_required'), { code: 'PROPOSAL_SIDE_REQUIRED' });
      const proposedNeed = await tx.need.findFirst({ where: { id: proposal.proposedNeedId, ownerId: applicantId } });
      if (!proposedNeed || inventoryUnavailable(proposedNeed.status)) throw Object.assign(new Error('invalid_proposal_need'), { code: 'PROPOSAL_SIDE_UNAVAILABLE' });
      acceptedSideUpdate.needId = proposedNeed.id;
    }

    await tx.tradeProposal.update({ where: { id: proposalId }, data: { status: 'accepted', respondedAt: new Date() } });
    await tx.tradeProposal.updateMany({ where: { tradeId: trade.id, id: { not: proposalId }, status: 'pending' }, data: { status: 'declined', respondedAt: new Date() } });
    return tx.trade.update({ where: { id: trade.id }, data: { ...acceptedSideUpdate, providerId: applicantId, status: 'in_progress', isPublic: false }, include: tradeInclude });
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
  const requestedTake = input.take ?? 50;
  const candidateTake = Math.min(100, Math.max(requestedTake, requestedTake * 3));
  const actorPreferences = actorId
    ? await prisma.user.findUnique({ where: { id: actorId }, select: { profile: { select: { countryCode: true } }, settings: { select: { language: true } } } })
    : null;
  const preferences = resolveFeedDiscoveryPreferences(input, actorPreferences, req.headers['accept-language']);
  const trades = await prisma.trade.findMany({ where: buildFeedWhere(input), include: feedTradeInclude, orderBy: { createdAt: 'desc' }, take: candidateTake });
  const hydratedTrades = await withTradeDeckMediaForActor(trades, actorId);
  const filteredTrades = input.hasImages
    ? hydratedTrades.filter((trade) => (trade.need?.media?.length ?? 0) + (trade.offer?.media?.length ?? 0) > 0)
    : hydratedTrades;
  res.json({ trades: sortTradesForDiscovery(filteredTrades, input, actorId, preferences).slice(0, requestedTake).map(stripFeedRankingOnlyFields) });
}));
tradesRoutes.get('/mine', requireAuth, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const trades = await prisma.trade.findMany({ where: { AND: [{ OR: [{ ownerId: actorId }, { providerId: actorId }] }, ...(betaMoneyOff() ? [noMoneyTradeWhere()] : [])] }, include: tradeInclude, orderBy: { createdAt: 'desc' } });
  res.json({ trades: await withTradeDeckMedia(trades, 'owner') });
}));
tradesRoutes.get('/:tradeId', optionalAuth, asyncRoute(async (req, res) => {
  const actorId = req.user?.id;
  const participantAccess: Prisma.TradeWhereInput[] = actorId
    ? [{ ownerId: actorId }, { providerId: actorId }, { proposals: { some: { applicantId: actorId } } }]
    : [];
  const trade = await prisma.trade.findFirst({
    where: {
      id: req.params.tradeId,
      AND: [...(betaMoneyOff() ? [noMoneyTradeWhere()] : [])],
      OR: [publicTradeVisibilityWhere(), ...participantAccess],
    },
    include: tradeInclude,
  });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const isParticipant = actorId && (trade.ownerId === actorId || trade.providerId === actorId);
  const visibility: MediaVisibility = isParticipant ? 'owner' : trade.isPublic && trade.status === 'active' ? 'trade_public' : 'public';
  res.json({ trade: await withOneTradeDeckMedia(trade, visibility) });
}));

const tradeDeleteAllowedStatuses = ['draft', 'active', 'expired', 'cancelled', 'closed'] as const;
const tradeDuplicateBlockingStatuses = ['draft', 'active', 'funded', 'in_progress', 'submitted', 'disputed'] as const;

tradesRoutes.delete('/:tradeId', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const trade = await prisma.trade.findFirst({ where: { id: req.params.tradeId, ownerId: actorId }, include: tradeInclude });
  if (!trade) return res.status(404).json({ error: 'not_found' });

  if (!tradeDeleteAllowedStatuses.includes(trade.status as typeof tradeDeleteAllowedStatuses[number])) {
    return res.status(409).json({
      error: 'trade_not_deletable',
      message: 'This trade cannot be deleted while it is in progress, submitted, completed, or disputed.'
    });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.tradeProposal.updateMany({
      where: { tradeId: trade.id, status: 'pending' },
      data: { status: 'declined', respondedAt: new Date() }
    });

    return tx.trade.update({
      where: { id: trade.id },
      data: { status: 'closed', isPublic: false, closedAt: trade.closedAt ?? new Date() },
      include: tradeInclude
    });
  });

  res.json({ trade: await withOneTradeDeckMedia(deleted, 'owner'), deleted: true });
}));
tradesRoutes.post('/', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createTradeRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const postType = input.postType ?? 'need_offer';

  const needsOwnNeed = postType === 'need_offer' || postType === 'open_need';
  const needsOwnOffer = postType === 'need_offer' || postType === 'open_offer';
  const needIsMoney = postType === 'need_offer' && input.needKind === 'money';
  const offerIsMoney = postType === 'need_offer' && input.offerKind === 'money';
  const isMoneyPayload = input.amountCents > 0 || input.creditAmount > 0 || needIsMoney || offerIsMoney;
  if (isMoneyPayload && betaMoneyOff()) {
    return res.status(403).json(betaMoneyDisabledPayload());
  }
  if (input.creditAmount > 0) {
    return res.status(400).json({
      error: 'credits_disabled',
      message: 'Credits are disabled for the first beta. Create Need + Offer exchanges only.'
    });
  }
  if (postType !== 'need_offer' && isMoneyPayload) {
    return res.status(400).json({
      error: 'open_post_money_disabled',
      message: 'Open Need and Open Offer posts cannot include wallet money yet.'
    });
  }

  const [need, offer, wallet] = await Promise.all([
    needsOwnNeed && !needIsMoney ? prisma.need.findFirst({ where: { id: input.needId, ownerId: actorId } }) : Promise.resolve(null),
    needsOwnOffer && !offerIsMoney ? prisma.offer.findFirst({ where: { id: input.offerId, ownerId: actorId } }) : Promise.resolve(null),
    offerIsMoney && input.amountCents > 0 ? prisma.wallet.findUnique({ where: { userId: actorId } }) : Promise.resolve(null)
  ]);
  if (needsOwnNeed && !needIsMoney && !need) return res.status(400).json({ error: 'invalid_need', message: postType === 'open_need' ? 'Choose one of your saved needs for this Open Need post.' : 'Choose one of your saved needs for this trade.' });
  if (needsOwnOffer && !offerIsMoney && !offer) return res.status(400).json({ error: 'invalid_offer', message: postType === 'open_offer' ? 'Choose one of your saved offers for this Open Offer post.' : 'Choose one of your saved offers for this trade.' });
  if (need && ['fulfilled', 'closed', 'expired'].includes(need.status)) return res.status(409).json({ error: 'need_not_available', message: 'This need is no longer available for a public trade.' });
  if (offer && ['accepted', 'closed', 'expired'].includes(offer.status)) return res.status(409).json({ error: 'offer_not_available', message: 'This offer is no longer available for a public trade.' });

  if (postType === 'need_offer' && need && offer) {
    const existingTrade = await prisma.trade.findFirst({
      where: { ownerId: actorId, postType, needId: need.id, offerId: offer.id, status: { in: [...tradeDuplicateBlockingStatuses] } },
      select: { id: true, status: true, title: true }
    });
    if (existingTrade) {
      return res.status(409).json({
        error: 'duplicate_trade_pair',
        message: 'You already have an active trade using this exact Need and Offer. Delete or close the existing trade before creating it again.',
        tradeId: existingTrade.id,
        tradeStatus: existingTrade.status,
        tradeTitle: existingTrade.title
      });
    }
  }

  if (postType === 'open_need' && need) {
    const existingTrade = await prisma.trade.findFirst({
      where: { ownerId: actorId, postType, needId: need.id, status: { in: [...tradeDuplicateBlockingStatuses] } },
      select: { id: true, status: true, title: true }
    });
    if (existingTrade) {
      return res.status(409).json({
        error: 'duplicate_open_need',
        message: 'You already have an active Open Need using this Need. Delete or close the existing post before publishing it again.',
        tradeId: existingTrade.id,
        tradeStatus: existingTrade.status,
        tradeTitle: existingTrade.title
      });
    }
  }

  if (postType === 'open_offer' && offer) {
    const existingTrade = await prisma.trade.findFirst({
      where: { ownerId: actorId, postType, offerId: offer.id, status: { in: [...tradeDuplicateBlockingStatuses] } },
      select: { id: true, status: true, title: true }
    });
    if (existingTrade) {
      return res.status(409).json({
        error: 'duplicate_open_offer',
        message: 'You already have an active Open Offer using this Offer. Delete or close the existing post before publishing it again.',
        tradeId: existingTrade.id,
        tradeStatus: existingTrade.status,
        tradeTitle: existingTrade.title
      });
    }
  }

  const limits = await buildLaunchLimits(prisma, actorId);
  const isMoneyTrade = isMoneyPayload;
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
  const needTitle = needIsMoney ? moneyLabel : need?.title;
  const offerTitle = offerIsMoney ? moneyLabel : offer?.title;
  const needDescription = needIsMoney ? `Wallet money requested: ${moneyLabel}` : need?.description;
  const offerDescription = offerIsMoney ? `Wallet money offered: ${moneyLabel}` : offer?.description;

  const title = input.title?.trim() || (
    postType === 'open_need'
      ? `Open Need: ${needTitle}`
      : postType === 'open_offer'
        ? `Open Offer: ${offerTitle}`
        : `${needTitle} <-> ${offerTitle}`
  );
  const description = input.description?.trim() || (
    postType === 'open_need'
      ? `I need: ${needDescription}\n\nOthers can propose offers.`
      : postType === 'open_offer'
        ? `I offer: ${offerDescription}\n\nOthers can propose needs.`
        : `I need: ${needDescription}\n\nI offer: ${offerDescription}`
  );

  const trade = await prisma.trade.create({
    data: { ownerId: actorId, postType, title, description, creditAmount: 0, amountCents: input.amountCents, currency: input.currency, needId: need?.id ?? null, offerId: offer?.id ?? null, status: 'active', isPublic: true, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null },
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
tradesRoutes.post('/:tradeId/proposals', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createTradeProposalRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const trade = await prisma.trade.findFirst({ where: { id: req.params.tradeId, ...publicTradeVisibilityWhere() } });
  if (!trade) return res.status(404).json({ error: 'not_found', message: 'This trade is no longer open for proposals.' });
  if (betaMoneyOff() && tradeHasMoneySurface(trade)) return res.status(403).json(betaMoneyDisabledPayload());
  if (trade.ownerId === actorId) return res.status(400).json({ error: 'cannot_propose_to_own_trade', message: 'You cannot send a proposal to your own trade.' });

  const requiredSide = proposalSideRequirement(trade.postType);
  let proposedNeedId: string | null = null;
  let proposedOfferId: string | null = null;

  if (input.proposedNeedId && input.proposedOfferId) {
    return res.status(400).json({ error: 'proposal_side_mismatch', message: 'Choose either one Need or one Offer for this proposal, not both.' });
  }

  if (requiredSide === 'offer') {
    if (!input.proposedOfferId) return res.status(400).json({ error: 'proposal_offer_required', message: 'Choose one of your saved Offers to propose for this Open Need.' });
    const offer = await prisma.offer.findFirst({ where: { id: input.proposedOfferId, ownerId: actorId } });
    if (!offer || inventoryUnavailable(offer.status)) return res.status(400).json({ error: 'invalid_proposal_offer', message: 'Choose an active Offer from your account.' });
    proposedOfferId = offer.id;
  } else if (requiredSide === 'need') {
    if (!input.proposedNeedId) return res.status(400).json({ error: 'proposal_need_required', message: 'Choose one of your saved Needs to propose for this Open Offer.' });
    const need = await prisma.need.findFirst({ where: { id: input.proposedNeedId, ownerId: actorId } });
    if (!need || inventoryUnavailable(need.status)) return res.status(400).json({ error: 'invalid_proposal_need', message: 'Choose an active Need from your account.' });
    proposedNeedId = need.id;
  } else if (input.proposedOfferId) {
    const offer = await prisma.offer.findFirst({ where: { id: input.proposedOfferId, ownerId: actorId } });
    if (!offer || inventoryUnavailable(offer.status)) return res.status(400).json({ error: 'invalid_proposal_offer', message: 'Choose an active Offer from your account.' });
    proposedOfferId = offer.id;
  } else if (input.proposedNeedId) {
    const need = await prisma.need.findFirst({ where: { id: input.proposedNeedId, ownerId: actorId } });
    if (!need || inventoryUnavailable(need.status)) return res.status(400).json({ error: 'invalid_proposal_need', message: 'Choose an active Need from your account.' });
    proposedNeedId = need.id;
  }

  const existing = await prisma.tradeProposal.findUnique({ where: { tradeId_applicantId: { tradeId: trade.id, applicantId: actorId } }, include: proposalInclude });
  if (existing && existing.status === 'pending') return res.status(409).json({ error: 'proposal_already_exists', message: 'You already have a pending proposal for this trade.', proposal: existing });
  if (existing && existing.status === 'accepted') return res.status(409).json({ error: 'proposal_already_accepted', message: 'Your proposal was already accepted.', proposal: existing });
  const proposal = await prisma.$transaction(async (tx) => {
    const proposalRecord = existing
      ? await tx.tradeProposal.update({ where: { id: existing.id }, data: { message: input.message, proposedNeedId, proposedOfferId, status: 'pending', respondedAt: null } })
      : await tx.tradeProposal.create({ data: { tradeId: trade.id, applicantId: actorId, message: input.message, proposedNeedId, proposedOfferId } });
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

tradesRoutes.patch('/:tradeId/status', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateTradeStatusRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const trade = await prisma.trade.findUnique({ where: { id: req.params.tradeId }, include: tradeInclude });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const isOwner = trade.ownerId === actorId;
  const isProvider = trade.providerId === actorId;
  if (!isOwner && !isProvider) return res.status(403).json({ error: 'forbidden' });
  if (input.status === trade.status) return res.json({ trade: await withOneTradeDeckMedia(trade, 'owner') });
  if (trade.status === 'disputed' && input.status !== 'cancelled') return res.status(409).json({ error: 'trade_disputed', message: 'This trade is disputed. Admin must resolve the money flow before it can continue.' });
  if (betaMoneyOff() && tradeHasMoneySurface(trade)) return res.status(403).json(betaMoneyDisabledPayload());

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
tradesRoutes.post('/:tradeId/close', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const trade = await prisma.trade.findFirst({ where: { id: req.params.tradeId, ownerId: req.user!.id } });
  if (!trade) return res.status(404).json({ error: 'not_found' });
  const closed = await prisma.trade.update({ where: { id: trade.id }, data: { status: 'closed', isPublic: false, closedAt: new Date() }, include: tradeInclude });
  res.json({ trade: await withOneTradeDeckMedia(closed, 'owner') });
}));
