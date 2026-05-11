import React from 'react';
import type { MediaAssetDto, TradePostType } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import { resolveMediaUrl } from '../mediaUrls';
import type { NeedItem, OfferItem, TradeDeckItem } from '../types';
import { TradePosterCard } from './TradePosterCard';

export type TradeSquareDeckCard = {
  id: string;
  kind: 'summary' | 'needImage' | 'offerImage';
  trade: TradeDeckItem;
  tradeIndex: number;
  tradeTotal: number;
  media?: MediaAssetDto;
};

type TradeSummaryCardProps = { trade: TradeDeckItem; tradeIndex: number; tradeTotal: number; onOpen: () => void; };
type TradeImageCardProps = { trade: TradeDeckItem; kind: 'needImage' | 'offerImage'; media?: MediaAssetDto; onOpen: () => void; };

function deckMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status === 'active');
}

function activeMediaUrl(media?: MediaAssetDto | null) {
  if (!media?.url || media.status !== 'active') return null;
  return resolveMediaUrl(media.url);
}

function firstDeckImage(trade: TradeDeckItem) {
  return activeMediaUrl(deckMedia(trade.need?.media)[0]) ?? activeMediaUrl(deckMedia(trade.offer?.media)[0]);
}

export function buildTradeSquareDeckCards(trade: TradeDeckItem, tradeIndex = 0, tradeTotal = 1): TradeSquareDeckCard[] {
  const cards: TradeSquareDeckCard[] = [{ id: `${trade.id}:summary`, kind: 'summary', trade, tradeIndex, tradeTotal }];
  for (const [index, media] of deckMedia(trade.need?.media).entries()) cards.push({ id: `${trade.id}:need:${media.id}:${index}`, kind: 'needImage', trade, tradeIndex, tradeTotal, media });
  for (const [index, media] of deckMedia(trade.offer?.media).entries()) cards.push({ id: `${trade.id}:offer:${media.id}:${index}`, kind: 'offerImage', trade, tradeIndex, tradeTotal, media });
  return cards;
}

export function renderTradeSquareDeckCard(card: TradeSquareDeckCard, _index: number, _total: number, onOpen: () => void) {
  if (card.kind === 'summary') return <TradeSummaryCard trade={card.trade} tradeIndex={card.tradeIndex} tradeTotal={card.tradeTotal} onOpen={onOpen} />;
  return <TradeImageCard trade={card.trade} kind={card.kind} media={card.media} onOpen={onOpen} />;
}

function getTradeCounter(index: number, total: number) { return `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`; }
function modeLabel(mode?: string | null) {
  if (mode === 'remote') return 'Remote';
  if (mode === 'local') return 'Local';
  if (mode === 'hybrid') return 'Hybrid';
  return null;
}
function moneySide(trade: TradeDeckItem) { const amountCents = trade.amountCents ?? 0; if (amountCents <= 0) return null; if (!trade.need && trade.offer) return 'need' as const; if (trade.need && !trade.offer) return 'offer' as const; return null; }
function moneyLabel(trade: TradeDeckItem) { return formatMoney(trade.amountCents ?? 0, trade.currency ?? 'eur'); }
function needTitle(trade: TradeDeckItem) { return moneySide(trade) === 'need' ? 'Wallet money' : trade.need?.title || trade.title || 'Open request'; }
function offerTitle(trade: TradeDeckItem) { return moneySide(trade) === 'offer' ? 'Wallet money' : trade.offer?.title || 'Open offer'; }
function compactJoin(values: Array<string | null | undefined>) { return values.filter((value): value is string => Boolean(value && value.trim())).join(' · '); }
function compactSideMeta(metadata: string, fallback?: string | null) { return metadata || fallback || ''; }
function tradePostType(trade: TradeDeckItem): TradePostType { return trade.postType ?? 'need_offer'; }
function summaryTitle(trade: TradeDeckItem) {
  const postType = tradePostType(trade);
  if (postType === 'open_need') return needTitle(trade);
  if (postType === 'open_offer') return offerTitle(trade);
  return `${needTitle(trade)} ↔ ${offerTitle(trade)}`;
}
function exchangeEyebrow(trade: TradeDeckItem) {
  const postType = tradePostType(trade);
  if (postType === 'open_need') return 'Open Need · others propose offers';
  if (postType === 'open_offer') return 'Open Offer · others propose needs';
  if (moneySide(trade) === 'need') return 'Money + Offer exchange';
  if (moneySide(trade) === 'offer') return 'Need + Money exchange';
  return 'Need + Offer exchange';
}
function summaryBadge(trade: TradeDeckItem, tradeIndex: number, tradeTotal: number) {
  const prefix = tradePostType(trade) === 'open_need' ? 'Open Need' : tradePostType(trade) === 'open_offer' ? 'Open Offer' : 'Trade';
  return `${prefix} · ${getTradeCounter(tradeIndex, tradeTotal)}`;
}
function getExpiryUrgencyBadge(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return null;
  const hoursLeft = (expiresMs - Date.now()) / 36e5;
  if (hoursLeft <= 0) return null;
  if (hoursLeft <= 24) return 'Expires soon';
  if (hoursLeft <= 72) return 'Urgent';
  return null;
}
function starterChips(trade: TradeDeckItem) { return [getExpiryUrgencyBadge(trade.expiresAt), ...(trade.need?.tags ?? []), ...(trade.offer?.tags ?? [])].filter((chip): chip is string => Boolean(chip)).slice(0, 3); }
export function needMeta(need?: NeedItem | null, trade?: TradeDeckItem) { if (trade && moneySide(trade) === 'need') return moneyLabel(trade); return need ? [need.category, need.timing, modeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · ') || 'Need details' : 'Need details'; }
export function offerMeta(offer?: OfferItem | null, trade?: TradeDeckItem) { if (trade && moneySide(trade) === 'offer') return moneyLabel(trade); return offer ? [offer.includes?.[0], offer.availability, modeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · ') || 'Offer details' : 'Offer details'; }

export function TradeSummaryCard({ trade, tradeIndex, tradeTotal, onOpen }: TradeSummaryCardProps) {
  const postType = tradePostType(trade);
  const summarySubtitle = postType === 'open_need'
    ? compactSideMeta(needMeta(trade.need, trade), trade.need?.description)
    : postType === 'open_offer'
      ? compactSideMeta(offerMeta(trade.offer, trade), trade.offer?.description)
      : compactJoin([compactSideMeta(needMeta(trade.need, trade), trade.need?.description), compactSideMeta(offerMeta(trade.offer, trade), trade.offer?.description)]);

  return (
    <TradePosterCard
      id={`${trade.id}:summary`}
      imageUrl={firstDeckImage(trade)}
      badge={summaryBadge(trade, tradeIndex, tradeTotal)}
      eyebrow={exchangeEyebrow(trade)}
      title={summaryTitle(trade)}
      subtitle={summarySubtitle}
      chips={starterChips(trade)}
      variant="trade"
      onPress={onOpen}
    />
  );
}

export function TradeImageCard({ trade, kind, media, onOpen }: TradeImageCardProps) {
  const isNeed = kind === 'needImage';
  const side = isNeed ? trade.need : trade.offer;
  const sideTitle = isNeed ? needTitle(trade) : offerTitle(trade);
  const sideMeta = isNeed ? needMeta(trade.need, trade) : offerMeta(trade.offer, trade);
  const sideDescription = side?.description;

  return (
    <TradePosterCard
      id={`${trade.id}:${kind}:${media?.id ?? 'fallback'}`}
      imageUrl={activeMediaUrl(media)}
      badge={isNeed ? 'Need reference' : 'Offer sample'}
      eyebrow={isNeed ? 'I need' : 'I offer'}
      title={sideTitle}
      subtitle={compactSideMeta(sideMeta, sideDescription)}
      chips={(side?.tags ?? []).slice(0, 3)}
      variant={isNeed ? 'need' : 'offer'}
      onPress={onOpen}
    />
  );
}
