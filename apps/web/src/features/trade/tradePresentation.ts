import type { MediaAssetDto, NeedDto, OfferDto, TradeDto } from '@hellowhen/contracts';
import { resolveWebAssetUrl } from '../../lib/api';
import { formatWebShortDate } from '../../lib/webFormat';

export type TradeSide = {
  label: 'I need' | 'I offer';
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
  badge: 'Need reference' | 'Offer sample';
  status?: MediaAssetDto['status'];
};

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

export function resolveTradeMediaUrl(value?: string | null, storageKey?: string | null) {
  return resolveWebAssetUrl(value, storageKey);
}

function deckMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status !== 'removed' && Boolean(asset.url || asset.storageKey));
}

export function getOwnerName(trade: TradeDto) {
  return trade.owner?.profile?.displayName ?? trade.owner?.profile?.handle ?? 'Someone nearby';
}

export function getTradePostType(trade: TradeDto) {
  if (trade.postType === 'open_need' || trade.postType === 'open_offer') return trade.postType;

  // Be defensive for existing/local mock records or older API responses that may
  // not carry postType yet. A trade with only a Need should behave as Open Need;
  // a trade with only an Offer should behave as Open Offer. Accepted open posts
  // keep their explicit postType above once both sides are attached.
  if (trade.need && !trade.offer) return 'open_need';
  if (trade.offer && !trade.need) return 'open_offer';

  return 'need_offer';
}

export function getExchangeLabel(trade: TradeDto) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return 'Open Need';
  if (postType === 'open_offer') return 'Open Offer';
  return 'Need + Offer exchange';
}

export function getTradeHeadline(trade: TradeDto) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return trade.need?.title ?? trade.title;
  if (postType === 'open_offer') return trade.offer?.title ?? trade.title;
  const needTitle = trade.need?.title ?? 'Need details';
  const offerTitle = trade.offer?.title ?? 'Offer details';
  return `${needTitle} ↔ ${offerTitle}`;
}

export function getTradeMode(trade: TradeDto) {
  return trade.need?.mode ?? trade.offer?.mode ?? null;
}

export function getTradeProposalCopy(trade: TradeDto) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') {
    return {
      actionTitle: 'Propose an offer',
      actionButton: 'Send offer proposal',
      signedOutTitle: 'Propose an offer',
      ownerEmpty: 'When someone proposes an offer for this need, the request will appear here.',
      placeholder: 'Tell the creator what you can offer for this need...',
      helper: 'This Open Need is looking for offers. Proposal details stay private between both members.',
      inviteTitle: 'Open for offers',
      inviteBody: 'The creator posted only what they need. Others can propose what they can offer below.',
      responseNeeded: 'Offer proposal',
    };
  }
  if (postType === 'open_offer') {
    return {
      actionTitle: 'Propose a need',
      actionButton: 'Send need proposal',
      signedOutTitle: 'Propose a need',
      ownerEmpty: 'When someone proposes a need for this offer, the request will appear here.',
      placeholder: 'Tell the creator what you need in return for this offer...',
      helper: 'This Open Offer is waiting for needs or requests. Proposal details stay private between both members.',
      inviteTitle: 'Open for needs',
      inviteBody: 'The creator posted only what they offer. Others can propose what they need or want in return below.',
      responseNeeded: 'Need proposal',
    };
  }
  return {
    actionTitle: 'Ask to trade',
    actionButton: 'Send proposal',
    signedOutTitle: 'Ask to trade',
    ownerEmpty: 'When someone asks to trade, the request will appear here.',
    placeholder: 'Write a short note about how you can trade...',
    helper: 'Proposal messages are private between the creator and applicant, but they live here on the Trade Detail page.',
    inviteTitle: 'Need + Offer exchange',
    inviteBody: 'The creator already posted both sides of this exchange. Applicants can ask to trade below.',
    responseNeeded: 'Trade proposal',
  };
}

export function getTradeHowItWorks(trade: TradeDto) {
  const postType = getTradePostType(trade);
  if (postType === 'open_need') return 'The creator posted a Need only. Applicants should propose what they can offer for it.';
  if (postType === 'open_offer') return 'The creator posted an Offer only. Applicants should propose what they need or want in return.';
  return 'The creator posted both a Need and an Offer. Applicants can ask to accept the exchange.';
}

export function getNeedSide(trade: TradeDto): TradeSide {
  return needToSide(trade.need, 'I need');
}

export function getOfferSide(trade: TradeDto): TradeSide {
  return offerToSide(trade.offer, 'I offer');
}

export function needToSide(need: NeedDto | null | undefined, label: 'I need'): TradeSide {
  if (!need) {
    return {
      label,
      kind: 'empty',
      title: 'Need details',
      description: 'Need details will appear here when this trade is loaded from the API.',
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
    metadata: compactJoin([need.category, need.timing, need.mode, need.locationLabel]),
    tags: need.tags ?? [],
    media: need.media ?? [],
  };
}

export function offerToSide(offer: OfferDto | null | undefined, label: 'I offer'): TradeSide {
  if (!offer) {
    return {
      label,
      kind: 'empty',
      title: 'Offer details',
      description: 'Offer details will appear here when this trade is loaded from the API.',
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
    metadata: compactJoin([offer.category, offer.availability, offer.mode, offer.locationLabel]),
    tags: [...(offer.includes ?? []), ...(offer.tags ?? [])],
    media: offer.media ?? [],
  };
}

export function getDeckImages(trade: TradeDto): DeckImage[] {
  const needImages = deckMedia(trade.need?.media).map((media, index) => ({
    id: `need-${media.id}`,
    url: resolveTradeMediaUrl(media.url, media.storageKey),
    alt: `${trade.need?.title ?? 'Need'} reference ${index + 1}`,
    badge: 'Need reference' as const,
    status: media.status,
  }));
  const offerImages = deckMedia(trade.offer?.media).map((media, index) => ({
    id: `offer-${media.id}`,
    url: resolveTradeMediaUrl(media.url, media.storageKey),
    alt: `${trade.offer?.title ?? 'Offer'} sample ${index + 1}`,
    badge: 'Offer sample' as const,
    status: media.status,
  }));
  return [...needImages, ...offerImages];
}

export function formatDateLabel(value?: string | null) {
  return formatWebShortDate(value, 'No date set');
}

export function formatRelativeExpiry(value?: string | null) {
  if (!value) return 'No expiry';
  const label = formatWebShortDate(value, 'Expiry set');
  return label === 'Expiry set' ? label : `Expires ${label}`;
}

export function getExpiryUrgencyBadge(value?: string | null) {
  if (!value) return null;
  const expiresMs = new Date(value).getTime();
  if (!Number.isFinite(expiresMs)) return null;
  const hoursLeft = (expiresMs - Date.now()) / 36e5;
  if (hoursLeft <= 0) return null;
  if (hoursLeft <= 24) return 'Expires soon';
  if (hoursLeft <= 72) return 'Urgent';
  return null;
}
