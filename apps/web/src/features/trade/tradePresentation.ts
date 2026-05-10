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

export function getExchangeLabel(_trade: TradeDto) {
  return 'Need + Offer exchange';
}

export function getTradeMode(trade: TradeDto) {
  return trade.need?.mode ?? trade.offer?.mode ?? null;
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
