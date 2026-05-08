import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { truncateText } from '@hellowhen/shared';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { AppText } from '../../../components/AppText';
import { CreditPill, SemanticBadge, StatusBadge } from '../../../components/SemanticUI';
import { TradeExchangeIcon } from './TradeExchangeIcon';
import { resolveMediaUrl } from '../mediaUrls';
import type { NeedItem, OfferItem, TradeDeckItem } from '../types';

export type TradeSquareDeckCard = {
  id: string;
  kind: 'summary' | 'needImage' | 'offerImage';
  trade: TradeDeckItem;
  media?: MediaAssetDto;
};

type TradeSummaryCardProps = { trade: TradeDeckItem; index: number; total: number; onOpen: () => void; };
type TradeImageCardProps = { trade: TradeDeckItem; kind: 'needImage' | 'offerImage'; media?: MediaAssetDto; onOpen: () => void; };

export function buildTradeSquareDeckCards(trade: TradeDeckItem): TradeSquareDeckCard[] {
  const cards: TradeSquareDeckCard[] = [{ id: `${trade.id}:summary`, kind: 'summary', trade }];
  const needImage = trade.need?.media?.[0];
  const offerImage = trade.offer?.media?.[0];
  if (needImage) cards.push({ id: `${trade.id}:need:${needImage.id}`, kind: 'needImage', trade, media: needImage });
  if (offerImage) cards.push({ id: `${trade.id}:offer:${offerImage.id}`, kind: 'offerImage', trade, media: offerImage });
  return cards;
}

export function renderTradeSquareDeckCard(card: TradeSquareDeckCard, index: number, total: number, onOpen: () => void) {
  if (card.kind === 'summary') return <TradeSummaryCard trade={card.trade} index={index} total={total} onOpen={onOpen} />;
  return <TradeImageCard trade={card.trade} kind={card.kind} media={card.media} onOpen={onOpen} />;
}

function getOwnerLabel(trade: TradeDeckItem) { return trade.owner?.profile?.displayName || trade.owner?.profile?.handle || 'Hellowhen member'; }
function getTradeCounter(index: number, total: number) { return `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`; }
function getStatusLabel(status: string) { return status === 'active' ? 'OPEN' : status.replace(/_/g, ' ').toUpperCase(); }
function getExpiryLabel(expiresAt?: string | null) {
  if (!expiresAt) return 'No expiry';
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return 'No expiry';
  const diffMs = expiresMs - Date.now();
  if (diffMs <= 0) return 'Expired';
  const hours = Math.ceil(diffMs / 1000 / 60 / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}
function modeLabel(mode?: string | null) {
  if (mode === 'remote') return 'Remote';
  if (mode === 'local') return 'Local';
  if (mode === 'hybrid') return 'Hybrid';
  return null;
}
function needTitle(trade: TradeDeckItem) { return trade.need?.title || trade.title || 'Open request'; }
function needDescription(trade: TradeDeckItem) { return trade.need?.description || trade.description || ''; }
function offerTitle(trade: TradeDeckItem) { return trade.offer?.title || 'Open offer'; }
function offerDescription(trade: TradeDeckItem) { return trade.offer?.description || trade.description || ''; }

export function needMeta(need?: NeedItem | null) { return need ? [need.category, need.timing, modeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · ') || 'Need details' : 'Need details'; }
export function offerMeta(offer?: OfferItem | null) { return offer ? [offer.includes?.[0], offer.availability, modeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · ') || 'Offer details' : 'Offer details'; }
function getMediaCountLabel(item?: { media?: MediaAssetDto[] } | null) { const count = item?.media?.length ?? 0; return count <= 0 ? null : `${count} image${count === 1 ? '' : 's'}`; }

export function TradeSummaryCard({ trade, index, total, onOpen }: TradeSummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeaderRow}><AppText style={styles.summaryHeader}>TRADE · {getTradeCounter(index, total)}</AppText><AppText style={styles.summaryStatus}>{getStatusLabel(trade.status)}</AppText></View>
      <View style={styles.summaryBody}>
        <View style={styles.tradeSideBlock}><AppText style={styles.sideEyebrow}>I need</AppText><AppText style={styles.sideTitle} numberOfLines={2}>{needTitle(trade)}</AppText><AppText style={styles.sideMeta} numberOfLines={2}>{needMeta(trade.need)}</AppText><AppText style={styles.sideDescription} numberOfLines={2}>{truncateText(needDescription(trade), 96)}</AppText></View>
        <View style={styles.exchangeRow}><View style={styles.exchangeLine} /><View style={styles.exchangeCircle}><TradeExchangeIcon color="#FFFFFF" size={24} strokeWidth={2.4} /></View><View style={styles.exchangeLine} /></View>
        <View style={styles.tradeSideBlock}><AppText style={styles.sideEyebrow}>I offer</AppText><AppText style={styles.sideTitle} numberOfLines={2}>{offerTitle(trade)}</AppText><AppText style={styles.sideMeta} numberOfLines={2}>{offerMeta(trade.offer)}</AppText><AppText style={styles.sideDescription} numberOfLines={2}>{truncateText(offerDescription(trade), 96)}</AppText></View>
      </View>
      <View style={styles.summaryFooter}>
        <View style={styles.footerMetaRow}><CreditPill amount={trade.creditAmount} label="credits" /><SemanticBadge label={getExpiryLabel(trade.expiresAt)} tone="time" size="sm" /></View>
        <View style={styles.ownerRow}><View style={styles.avatarDot} /><View style={styles.ownerCopy}><AppText style={styles.ownerLabel}>Posted by</AppText><AppText style={styles.ownerName} numberOfLines={1}>{getOwnerLabel(trade)}</AppText></View><Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}><AppText style={styles.openButtonText}>Open</AppText></Pressable></View>
      </View>
    </View>
  );
}

export function TradeImageCard({ trade, kind, media, onOpen }: TradeImageCardProps) {
  const isNeed = kind === 'needImage';
  const entity = isNeed ? trade.need : trade.offer;
  const title = isNeed ? needTitle(trade) : offerTitle(trade);
  const meta = isNeed ? needMeta(trade.need) : offerMeta(trade.offer);
  const label = isNeed ? 'Need reference' : 'Offer sample';
  const countLabel = getMediaCountLabel(entity);
  return (
    <View style={styles.imageCard}>
      <View style={styles.imageHeaderRow}><SemanticBadge label={label} tone={isNeed ? 'need' : 'offer'} size="sm" />{countLabel ? <AppText style={styles.imageCount}>{countLabel}</AppText> : null}</View>
      <View style={styles.imageFrame}>{media?.url ? <Image source={{ uri: resolveMediaUrl(media.url) }} style={styles.image} resizeMode="cover" /> : <View style={styles.imagePlaceholder}><AppText style={styles.imagePlaceholderText}>No approved image</AppText></View>}</View>
      <View style={styles.imageCopy}><AppText style={styles.imageEyebrow}>{isNeed ? 'I need' : 'I offer'}</AppText><AppText style={styles.imageTitle} numberOfLines={2}>{title}</AppText><AppText style={styles.imageMeta} numberOfLines={2}>{meta}</AppText></View>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.imageOpenButton, pressed && styles.pressed]}><AppText style={styles.imageOpenButtonText}>View trade</AppText></Pressable>
    </View>
  );
}

export function TradeDeckMiniMeta({ trade }: { trade: TradeDeckItem }) {
  const needImages = trade.need?.media?.length ?? 0;
  const offerImages = trade.offer?.media?.length ?? 0;
  return <View style={styles.miniMetaRow}><StatusBadge status={trade.status} size="sm" /><SemanticBadge label={`${needImages + offerImages} image${needImages + offerImages === 1 ? '' : 's'}`} tone="info" size="sm" /><SemanticBadge label={getExpiryLabel(trade.expiresAt)} tone="time" size="sm" /></View>;
}

const styles = StyleSheet.create({
  summaryCard: { flex: 1, padding: 22, gap: 16, backgroundColor: '#FFFFFF' },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  summaryHeader: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 0.95 },
  summaryStatus: { color: '#16A34A', fontSize: 11, fontWeight: '900', letterSpacing: 0.95 },
  summaryBody: { flex: 1, justifyContent: 'center', gap: 14 },
  tradeSideBlock: { gap: 6 },
  sideEyebrow: { color: '#64748B', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  sideTitle: { color: '#0F172A', fontSize: 27, lineHeight: 31, fontWeight: '900', letterSpacing: -0.7 },
  sideMeta: { color: '#475569', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  sideDescription: { color: '#64748B', lineHeight: 19, fontWeight: '600' },
  exchangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  exchangeLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  exchangeCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  summaryFooter: { gap: 12 },
  footerMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  ownerRow: { minHeight: 50, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DDD6FE', borderWidth: 1, borderColor: '#A78BFA' },
  ownerCopy: { flex: 1 },
  ownerLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  ownerName: { marginTop: 2, color: '#0F172A', fontWeight: '900' },
  openButton: { borderRadius: 14, backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 10 },
  openButtonText: { color: '#FFFFFF', fontWeight: '900' },
  imageCard: { flex: 1, padding: 18, gap: 13, backgroundColor: '#FFFFFF' },
  imageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  imageCount: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  imageFrame: { flex: 1, minHeight: 198, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  imagePlaceholderText: { color: '#64748B', fontWeight: '900' },
  imageCopy: { gap: 5 },
  imageEyebrow: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  imageTitle: { color: '#0F172A', fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.55 },
  imageMeta: { color: '#475569', fontWeight: '800', lineHeight: 19 },
  imageOpenButton: { borderRadius: 16, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  imageOpenButtonText: { color: '#FFFFFF', fontWeight: '900' },
  miniMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
