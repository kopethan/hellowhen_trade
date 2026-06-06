import type { MediaAssetDto, NeedDto, OfferDto, TradeDto } from '@hellowhen/contracts';
import type { SupportedLanguage, TranslationValues } from '@hellowhen/i18n';
import { resolveWebAssetUrl } from '../../lib/api';
import { formatWebMoney, formatWebShortDate } from '../../lib/webFormat';
import { durationPresetLabel } from '../inventory/inventoryPresentation';

export type Translator = (key: string, values?: TranslationValues) => string;

export type TradeI18n = {
  t?: Translator;
  language?: SupportedLanguage;
};

function tr(i18n: TradeI18n | undefined, key: string, fallback: string, values?: TranslationValues) {
  const value = i18n?.t?.(key, values);
  return value && value !== key ? value : fallback;
}

export type TradeSide = {
  label: string;
  kind: 'need' | 'offer' | 'empty';
  title: string;
  description: string;
  metadata: string;
  tags: string[];
  media: MediaAssetDto[];
};

export type DeckImage = {
  id: string;
  url: string;
  alt: string;
  badge: string;
  kind: 'need' | 'offer';
  status?: MediaAssetDto['status'];
};

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

export function getNeedTimingBadge(need: NeedDto | null | undefined, i18n?: TradeI18n) {
  if (!need) return '';
  return durationPresetLabel(need.estimatedDurationPreset, i18n);
}

export function getOfferTimingBadge(offer: OfferDto | null | undefined, i18n?: TradeI18n) {
  if (!offer) return '';
  return durationPresetLabel(offer.typicalDurationPreset, i18n);
}

export function getTradeTimingBadge(trade: TradeDto, i18n?: TradeI18n) {
  const needDuration = getNeedTimingBadge(trade.need, i18n);
  const offerDuration = getOfferTimingBadge(trade.offer, i18n);
  if (needDuration && offerDuration && needDuration !== offerDuration) return `${needDuration} ↔ ${offerDuration}`;
  return needDuration || offerDuration;
}

export function resolveTradeMediaUrl(value?: string | null, storageKey?: string | null) {
  return resolveWebAssetUrl(value, storageKey);
}

function deckMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status !== 'removed' && Boolean(asset.url || asset.storageKey));
}

export function getOwnerName(trade: TradeDto, i18n?: TradeI18n) {
  return trade.owner?.profile?.displayName ?? trade.owner?.profile?.handle ?? tr(i18n, 'profile.unknownMember', 'Someone nearby');
}

export function getTradePostType(trade: TradeDto) {
  if (trade.cashPromise) return 'need_offer';
  if (trade.postType === 'open_need' || trade.postType === 'open_offer') return trade.postType;

  // Be defensive for existing/local mock records or older API responses that may
  // not carry postType yet. A trade with only a Need should behave as Open Need;
  // a trade with only an Offer should behave as Open Offer. Accepted open posts
  // keep their explicit postType above once both sides are attached.
  if (trade.need && !trade.offer) return 'open_need';
  if (trade.offer && !trade.need) return 'open_offer';

  return 'need_offer';
}

export function getExchangeLabel(trade: TradeDto, i18n?: TradeI18n) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return tr(i18n, 'trade.postTypes.openNeed', 'Open Need');
  if (postType === 'open_offer') return tr(i18n, 'trade.postTypes.openOffer', 'Open Offer');
  return tr(i18n, 'trade.postTypes.needOfferExchange', 'Need + Offer exchange');
}

export function getTradeHeadline(trade: TradeDto, i18n?: TradeI18n) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return trade.need?.title ?? trade.title;
  if (postType === 'open_offer') return trade.offer?.title ?? trade.title;
  const needTitle = trade.cashPromise?.side === 'need' ? tr(i18n, 'trade.cashPromise.title', 'Cash promise') : trade.need?.title ?? tr(i18n, 'trade.labels.needDetails', 'Need details');
  const offerTitle = trade.cashPromise?.side === 'offer' ? tr(i18n, 'trade.cashPromise.title', 'Cash promise') : trade.offer?.title ?? tr(i18n, 'trade.labels.offerDetails', 'Offer details');
  return `${needTitle} ↔ ${offerTitle}`;
}

export function getTradeMode(trade: TradeDto) {
  return trade.need?.mode ?? trade.offer?.mode ?? null;
}

export function getModeLabel(mode: string | null | undefined, i18n?: TradeI18n) {
  if (mode === 'remote') return tr(i18n, 'trade.modes.remote', 'Remote');
  if (mode === 'local') return tr(i18n, 'trade.modes.local', 'Local');
  if (mode === 'hybrid') return tr(i18n, 'trade.modes.hybrid', 'Hybrid');
  return null;
}

export function getStatusLabel(status: string, i18n?: TradeI18n) {
  return tr(i18n, `trade.statuses.${status}`, status.replace(/_/g, ' '));
}

export function getTradeProposalCopy(trade: TradeDto, i18n?: TradeI18n) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') {
    return {
      actionTitle: tr(i18n, 'trade.proposals.proposeOffer', 'Propose an offer'),
      actionButton: tr(i18n, 'trade.proposals.sendOfferProposal', 'Send offer proposal'),
      signedOutTitle: tr(i18n, 'trade.proposals.proposeOffer', 'Propose an offer'),
      ownerEmpty: tr(i18n, 'trade.proposals.ownerEmptyOpenNeed', 'When someone proposes an offer for this need, the request will appear here.'),
      placeholder: tr(i18n, 'trade.proposals.placeholderOpenNeed', 'Tell the creator what you can offer for this need...'),
      helper: tr(i18n, 'trade.proposals.helperOpenNeed', 'This Open Need is looking for offers. Proposal details stay private between both members.'),
      inviteTitle: tr(i18n, 'trade.proposals.openForOffers', 'Open for offers'),
      inviteBody: tr(i18n, 'trade.proposals.inviteOpenNeedBody', 'The creator posted only what they need. Others can propose what they can offer below.'),
      responseNeeded: tr(i18n, 'trade.proposals.offerProposal', 'Offer proposal'),
    };
  }
  if (postType === 'open_offer') {
    return {
      actionTitle: tr(i18n, 'trade.proposals.proposeNeed', 'Propose a need'),
      actionButton: tr(i18n, 'trade.proposals.sendNeedProposal', 'Send need proposal'),
      signedOutTitle: tr(i18n, 'trade.proposals.proposeNeed', 'Propose a need'),
      ownerEmpty: tr(i18n, 'trade.proposals.ownerEmptyOpenOffer', 'When someone proposes a need for this offer, the request will appear here.'),
      placeholder: tr(i18n, 'trade.proposals.placeholderOpenOffer', 'Tell the creator what you need in return for this offer...'),
      helper: tr(i18n, 'trade.proposals.helperOpenOffer', 'This Open Offer is waiting for needs or requests. Proposal details stay private between both members.'),
      inviteTitle: tr(i18n, 'trade.proposals.openForNeeds', 'Open for needs'),
      inviteBody: tr(i18n, 'trade.proposals.inviteOpenOfferBody', 'The creator posted only what they offer. Others can propose what they need or want in return below.'),
      responseNeeded: tr(i18n, 'trade.proposals.needProposal', 'Need proposal'),
    };
  }
  return {
    actionTitle: tr(i18n, 'trade.proposals.askToTrade', 'Ask to trade'),
    actionButton: tr(i18n, 'trade.proposals.sendProposal', 'Send proposal'),
    signedOutTitle: tr(i18n, 'trade.proposals.askToTrade', 'Ask to trade'),
    ownerEmpty: tr(i18n, 'trade.proposals.ownerEmptyNeedOffer', 'When someone asks to trade, the request will appear here.'),
    placeholder: tr(i18n, 'trade.proposals.placeholderNeedOffer', 'Write a short note about how you can trade...'),
    helper: tr(i18n, 'trade.proposals.helperNeedOffer', 'Proposal messages are private between the creator and applicant, but they live here on the Trade Detail page.'),
    inviteTitle: tr(i18n, 'trade.postTypes.needOfferExchange', 'Need + Offer exchange'),
    inviteBody: tr(i18n, 'trade.proposals.inviteNeedOfferBody', 'The creator already posted both sides of this exchange. Applicants can ask to trade below.'),
    responseNeeded: tr(i18n, 'trade.proposals.tradeProposal', 'Trade proposal'),
  };
}

export function getTradeHowItWorks(trade: TradeDto, i18n?: TradeI18n) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return tr(i18n, 'trade.detail.howOpenNeedWorks', 'The creator posted a Need only. Applicants should propose what they can offer for it.');
  if (postType === 'open_offer') return tr(i18n, 'trade.detail.howOpenOfferWorks', 'The creator posted an Offer only. Applicants should propose what they need or want in return.');
  return tr(i18n, 'trade.detail.howNeedOfferWorks', 'The creator posted both a Need and an Offer. Applicants can ask to accept the exchange.');
}

export function getNeedSide(trade: TradeDto, i18n?: TradeI18n): TradeSide {
  if (trade.cashPromise?.side === 'need') return cashPromiseToSide(trade, tr(i18n, 'trade.labels.iNeed', 'I need'), 'need', i18n);
  return needToSide(trade.need, tr(i18n, 'trade.labels.iNeed', 'I need'), i18n);
}

export function getOfferSide(trade: TradeDto, i18n?: TradeI18n): TradeSide {
  if (trade.cashPromise?.side === 'offer') return cashPromiseToSide(trade, tr(i18n, 'trade.labels.iOffer', 'I offer'), 'offer', i18n);
  return offerToSide(trade.offer, tr(i18n, 'trade.labels.iOffer', 'I offer'), i18n);
}

function cashPromiseToSide(trade: TradeDto, label: string, kind: 'need' | 'offer', i18n?: TradeI18n): TradeSide {
  const cashPromise = trade.cashPromise;
  const amountLabel = cashPromise ? formatWebMoney(cashPromise.amountCents, cashPromise.currency ?? 'eur') : '';
  return {
    label,
    kind,
    title: tr(i18n, 'trade.cashPromise.title', 'Cash promise'),
    description: cashPromise?.note || tr(i18n, 'trade.cashPromise.outsideAppBody', 'Cash is arranged outside Hellowhen. Hellowhen does not process, hold, protect, refund, or guarantee this cash.'),
    metadata: compactJoin([amountLabel, tr(i18n, 'trade.cashPromise.notProcessed', 'Not processed by Hellowhen')]),
    tags: [tr(i18n, 'trade.cashPromise.outsideAppTitle', 'Outside-app cash arrangement')],
    media: [],
  };
}

export function needToSide(need: NeedDto | null | undefined, label: string, i18n?: TradeI18n): TradeSide {
  if (!need) {
    return {
      label,
      kind: 'empty',
      title: tr(i18n, 'trade.labels.needDetails', 'Need details'),
      description: tr(i18n, 'trade.detail.needDetailsFallback', 'Need details will appear here when this trade is loaded from the API.'),
      metadata: '',
      tags: [],
      media: [],
    };
  }

  return {
    label,
    kind: 'need',
    title: need.title,
    description: need.description,
    metadata: compactJoin([need.category, getNeedTimingBadge(need, i18n), getModeLabel(need.mode, i18n), need.locationLabel]),
    tags: need.tags ?? [],
    media: need.media ?? [],
  };
}

export function offerToSide(offer: OfferDto | null | undefined, label: string, i18n?: TradeI18n): TradeSide {
  if (!offer) {
    return {
      label,
      kind: 'empty',
      title: tr(i18n, 'trade.labels.offerDetails', 'Offer details'),
      description: tr(i18n, 'trade.detail.offerDetailsFallback', 'Offer details will appear here when this trade is loaded from the API.'),
      metadata: '',
      tags: [],
      media: [],
    };
  }

  return {
    label,
    kind: 'offer',
    title: offer.title,
    description: offer.description,
    metadata: compactJoin([offer.category, getOfferTimingBadge(offer, i18n), getModeLabel(offer.mode, i18n), offer.locationLabel]),
    tags: [...(offer.includes ?? []), ...(offer.tags ?? [])],
    media: offer.media ?? [],
  };
}

export function getDeckImages(trade: TradeDto, i18n?: TradeI18n): DeckImage[] {
  const needBadge = tr(i18n, 'trade.labels.needReference', 'Need reference');
  const offerBadge = tr(i18n, 'trade.labels.offerSample', 'Offer sample');
  const needFallback = tr(i18n, 'inventory.labels.need', 'Need');
  const offerFallback = tr(i18n, 'inventory.labels.offer', 'Offer');
  const needImages = deckMedia(trade.need?.media).map((media, index) => ({
    id: `need-${media.id}`,
    url: resolveTradeMediaUrl(media.url, media.storageKey),
    alt: `${trade.need?.title ?? needFallback} ${needBadge.toLowerCase()} ${index + 1}`,
    badge: needBadge,
    kind: 'need' as const,
    status: media.status,
  }));
  const offerImages = deckMedia(trade.offer?.media).map((media, index) => ({
    id: `offer-${media.id}`,
    url: resolveTradeMediaUrl(media.url, media.storageKey),
    alt: `${trade.offer?.title ?? offerFallback} ${offerBadge.toLowerCase()} ${index + 1}`,
    badge: offerBadge,
    kind: 'offer' as const,
    status: media.status,
  }));
  return [...needImages, ...offerImages];
}

export function formatDateLabel(value?: string | null, i18n?: TradeI18n) {
  return formatWebShortDate(value, tr(i18n, 'trade.expiry.noDateSet', 'No date set'), i18n?.language);
}

export function formatRelativeExpiry(value?: string | null, i18n?: TradeI18n) {
  if (!value) return tr(i18n, 'trade.expiry.noExpiry', 'No expiry');
  const expirySet = tr(i18n, 'trade.expiry.expirySet', 'Expiry set');
  const label = formatWebShortDate(value, expirySet, i18n?.language);
  return label === expirySet ? label : tr(i18n, 'trade.expiry.expires', 'Expires {{date}}', { date: label });
}

export function getExpiryUrgencyBadge(value?: string | null, i18n?: TradeI18n) {
  if (!value) return null;
  const expiresMs = new Date(value).getTime();
  if (!Number.isFinite(expiresMs)) return null;
  const hoursLeft = (expiresMs - Date.now()) / 36e5;
  if (hoursLeft <= 0) return null;
  if (hoursLeft <= 24) return tr(i18n, 'trade.expiry.expiresSoon', 'Expires soon');
  if (hoursLeft <= 72) return tr(i18n, 'trade.expiry.urgent', 'Urgent');
  return null;
}
