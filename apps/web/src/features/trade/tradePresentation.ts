import type { MediaAssetDto, NeedDto, OfferDto, TradeDto } from '@hellowhen/contracts';
import { formatWebMoney, formatWebShortDate } from '../../lib/webFormat';

export type TradeSide = {
  label: 'I need' | 'I offer';
  kind: 'need' | 'offer' | 'money' | 'empty';
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
};

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

export function getOwnerName(trade: TradeDto) {
  return trade.owner?.profile?.displayName ?? trade.owner?.profile?.handle ?? 'Someone nearby';
}

export function getExchangeLabel(trade: TradeDto) {
  if ((trade.amountCents ?? 0) > 0) return formatWebMoney(trade.amountCents ?? 0, trade.currency ?? 'eur');
  return 'Service-for-service';
}

export function getTradeMode(trade: TradeDto) {
  return trade.need?.mode ?? trade.offer?.mode ?? null;
}

export function getNeedSide(trade: TradeDto): TradeSide {
  const moneyLabel = getExchangeLabel(trade);
  const need = trade.need;
  if (!need && (trade.amountCents ?? 0) > 0) {
    return {
      label: 'I need',
      kind: 'money',
      title: 'Wallet money',
      description: `${moneyLabel} requested through the demo wallet flow.`,
      metadata: 'Money request',
      tags: [],
      media: [],
    };
  }
  return needToSide(need, 'I need');
}

export function getOfferSide(trade: TradeDto): TradeSide {
  const moneyLabel = getExchangeLabel(trade);
  const offer = trade.offer;
  if (!offer && (trade.amountCents ?? 0) > 0) {
    return {
      label: 'I offer',
      kind: 'money',
      title: 'Wallet money',
      description: `${moneyLabel} offered through the demo wallet flow.`,
      metadata: 'Money offer',
      tags: [],
      media: [],
    };
  }
  return offerToSide(offer, 'I offer');
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
  const needImages = (trade.need?.media ?? []).map((media, index) => ({
    id: `need-${media.id}`,
    url: media.url,
    alt: `${trade.need?.title ?? 'Need'} reference ${index + 1}`,
    badge: 'Need reference' as const,
  }));
  const offerImages = (trade.offer?.media ?? []).map((media, index) => ({
    id: `offer-${media.id}`,
    url: media.url,
    alt: `${trade.offer?.title ?? 'Offer'} sample ${index + 1}`,
    badge: 'Offer sample' as const,
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
