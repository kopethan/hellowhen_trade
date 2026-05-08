import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { TradeExchangeIcon } from './TradeExchangeIcon';
import { resolveMediaUrl } from '../mediaUrls';
import type { NeedItem, OfferItem, TradeDeckItem } from '../types';

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

export function buildTradeSquareDeckCards(trade: TradeDeckItem, tradeIndex = 0, tradeTotal = 1): TradeSquareDeckCard[] {
  const cards: TradeSquareDeckCard[] = [{ id: `${trade.id}:summary`, kind: 'summary', trade, tradeIndex, tradeTotal }];
  for (const [index, media] of (trade.need?.media ?? []).entries()) cards.push({ id: `${trade.id}:need:${media.id}:${index}`, kind: 'needImage', trade, tradeIndex, tradeTotal, media });
  for (const [index, media] of (trade.offer?.media ?? []).entries()) cards.push({ id: `${trade.id}:offer:${media.id}:${index}`, kind: 'offerImage', trade, tradeIndex, tradeTotal, media });
  return cards;
}

export function renderTradeSquareDeckCard(card: TradeSquareDeckCard, _index: number, _total: number, onOpen: () => void) {
  if (card.kind === 'summary') return <TradeSummaryCard trade={card.trade} tradeIndex={card.tradeIndex} tradeTotal={card.tradeTotal} onOpen={onOpen} />;
  return <TradeImageCard trade={card.trade} kind={card.kind} media={card.media} onOpen={onOpen} />;
}

function getTradeCounter(index: number, total: number) { return `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`; }
function getStatusLabel(status: string) { return status === 'active' ? 'OPEN' : status.replace(/_/g, ' ').toUpperCase(); }
function modeLabel(mode?: string | null) {
  if (mode === 'remote') return 'Remote';
  if (mode === 'local') return 'Local';
  if (mode === 'hybrid') return 'Hybrid';
  return null;
}
function needTitle(trade: TradeDeckItem) { return trade.need?.title || trade.title || 'Open request'; }
function offerTitle(trade: TradeDeckItem) { return trade.offer?.title || 'Open offer'; }
export function needMeta(need?: NeedItem | null) { return need ? [need.category, need.timing, modeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · ') || 'Need details' : 'Need details'; }
export function offerMeta(offer?: OfferItem | null) { return offer ? [offer.includes?.[0], offer.availability, modeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · ') || 'Offer details' : 'Offer details'; }
export function TradeSummaryCard({ trade, tradeIndex, tradeTotal, onOpen }: TradeSummaryCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
      <View style={styles.summaryHeaderRow}>
        <AppText style={styles.summaryHeader}>TRADE · {getTradeCounter(tradeIndex, tradeTotal)}</AppText>
        <AppText style={styles.summaryStatus}>{getStatusLabel(trade.status)}</AppText>
      </View>

      <View style={styles.summaryBody}>
        <View style={styles.tradeSideBlock}>
          <AppText style={styles.sideEyebrow}>I need</AppText>
          <AppText style={styles.sideTitle} numberOfLines={2}>{needTitle(trade)}</AppText>
          <AppText style={styles.sideMeta} numberOfLines={2}>{needMeta(trade.need)}</AppText>
        </View>

        <View style={styles.exchangeRow}>
          <View style={styles.exchangeLine} />
          <View style={styles.exchangeCircle}><TradeExchangeIcon color="#0F172A" size={22} strokeWidth={2.4} /></View>
          <View style={styles.exchangeLine} />
        </View>

        <View style={styles.tradeSideBlock}>
          <AppText style={styles.sideEyebrow}>I offer</AppText>
          <AppText style={styles.sideTitle} numberOfLines={2}>{offerTitle(trade)}</AppText>
          <AppText style={styles.sideMeta} numberOfLines={2}>{offerMeta(trade.offer)}</AppText>
        </View>
      </View>
    </Pressable>
  );
}

export function TradeImageCard({ kind, media, onOpen }: TradeImageCardProps) {
  const isNeed = kind === 'needImage';
  const label = isNeed ? 'Need reference' : 'Offer sample';

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.imageCard, pressed && styles.pressed]}>
      {media?.url ? <Image source={{ uri: resolveMediaUrl(media.url) }} style={styles.fullBleedImage} resizeMode="cover" /> : <View style={styles.imagePlaceholder}><AppText style={styles.imagePlaceholderText}>No approved image</AppText></View>}
      <View style={styles.floatingBadge}><AppText style={styles.floatingBadgeText}>{label}</AppText></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryCard: { flex: 1, paddingHorizontal: 22, paddingVertical: 20, gap: 14, backgroundColor: '#FFFFFF' },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  summaryHeader: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 0.95 },
  summaryStatus: { color: '#0F172A', fontSize: 11, fontWeight: '900', letterSpacing: 0.95 },
  summaryBody: { flex: 1, justifyContent: 'center', gap: 19 },
  tradeSideBlock: { alignItems: 'center', gap: 7 },
  sideEyebrow: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  sideTitle: { color: '#020617', textAlign: 'center', fontSize: 25, lineHeight: 29, fontWeight: '900', letterSpacing: -0.75 },
  sideMeta: { color: '#64748B', textAlign: 'center', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  exchangeRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginVertical: 2 },
  exchangeLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  exchangeCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  imageCard: { flex: 1, overflow: 'hidden', backgroundColor: '#0F172A' },
  fullBleedImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: '#E2E8F0' },
  imagePlaceholderText: { color: '#64748B', fontWeight: '900' },
  floatingBadge: { position: 'absolute', left: 14, top: 14, borderRadius: 999, backgroundColor: 'rgba(15, 23, 42, 0.72)', paddingHorizontal: 10, paddingVertical: 6 },
  floatingBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.35 },
  pressed: { opacity: 0.82 },
});
