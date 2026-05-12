import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { MediaAssetDto, TradePostType } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { TradeExchangeIcon } from './TradeExchangeIcon';
import { resolveMediaUrl } from '../mediaUrls';
import type { NeedItem, OfferItem, TradeDeckItem } from '../types';
import { TradePosterCard, type TradePosterCardStatusTone } from './TradePosterCard';
import { UserIdentityPressable } from '../../users/UserIdentityPressable';

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
type CountdownState = { label: string; tone: TradePosterCardStatusTone };

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

function getPublicOwnerId(ownerId?: string | null) {
  if (!ownerId || ownerId === 'preview' || ownerId === 'unknown') return null;
  return ownerId;
}

function hasOwnerIdentity(trade: TradeDeckItem) {
  return Boolean(trade.owner || getPublicOwnerId(trade.ownerId));
}

function OwnerIdentityChip({ trade, compact = false }: { trade: TradeDeckItem; compact?: boolean }) {
  const userId = trade.owner?.id ?? getPublicOwnerId(trade.ownerId);
  if (!trade.owner && !userId) return null;

  return (
    <UserIdentityPressable
      user={trade.owner}
      userId={userId}
      variant={compact ? 'compact' : 'chip'}
      avatarSize="xs"
      showHandle={false}
      subtitle={compact ? 'Owner' : undefined}
      style={compact ? styles.summaryOwnerIdentity : styles.posterOwnerIdentity}
    />
  );
}

function getTradeCounter(index: number, total: number) { return `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`; }
function getStatusLabel(status: string) { return status === 'active' ? 'ACTIVE' : status.replace(/_/g, ' ').toUpperCase(); }
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
function compactJoin(values: Array<string | null | undefined>, limit = 3) { return values.filter((value): value is string => Boolean(value && value.trim())).slice(0, limit).join(' · '); }
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
  if (postType === 'open_need') return 'Others can propose offers';
  if (postType === 'open_offer') return 'Others can propose needs';
  if (moneySide(trade) === 'need') return 'Money + Offer exchange';
  if (moneySide(trade) === 'offer') return 'Need + Money exchange';
  return 'Need + Offer exchange';
}
function summaryBadge(trade: TradeDeckItem, tradeIndex: number, tradeTotal: number) {
  const prefix = tradePostType(trade) === 'open_need' ? 'Open Need' : tradePostType(trade) === 'open_offer' ? 'Open Offer' : 'Trade';
  return `${prefix} · ${getTradeCounter(tradeIndex, tradeTotal)}`;
}
function imagePlaceholderLabel(media?: MediaAssetDto) { if (media?.status === 'flagged') return 'Image unavailable'; return 'Image unavailable'; }
function starterChips(trade: TradeDeckItem) { return [...(trade.need?.tags ?? []), ...(trade.offer?.tags ?? [])].filter((chip): chip is string => Boolean(chip)).slice(0, 3); }
export function needMeta(need?: NeedItem | null, trade?: TradeDeckItem) { if (trade && moneySide(trade) === 'need') return moneyLabel(trade); return need ? compactJoin([need.category, need.timing, modeLabel(need.mode), need.locationLabel], 2) || 'Need details' : 'Need details'; }
export function offerMeta(offer?: OfferItem | null, trade?: TradeDeckItem) { if (trade && moneySide(trade) === 'offer') return moneyLabel(trade); return offer ? compactJoin([offer.includes?.[0], offer.availability, modeLabel(offer.mode), offer.locationLabel], 2) || 'Offer details' : 'Offer details'; }

function pad(value: number, size = 2) { return String(value).padStart(size, '0'); }
function buildCountdownState(expiresAt?: string | null, now = Date.now()): CountdownState {
  if (!expiresAt) return { label: 'NO EXPIRY', tone: 'none' };
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return { label: 'NO EXPIRY', tone: 'none' };
  const secondsLeft = Math.floor((expiresMs - now) / 1000);
  if (secondsLeft <= 0) return { label: 'EXPIRED', tone: 'expired' };
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const tone: TradePosterCardStatusTone = secondsLeft <= 86400 ? 'urgent' : secondsLeft <= 259200 ? 'soon' : 'normal';
  return { label: `${pad(days, 3)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, tone };
}
function useCountdownState(expiresAt?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return useMemo(() => buildCountdownState(expiresAt, now), [expiresAt, now]);
}

function TradeCountdown({ expiresAt, compact = false }: { expiresAt?: string | null; compact?: boolean }) {
  const theme = useThemeTokens();
  const countdown = useCountdownState(expiresAt);
  const color = countdown.tone === 'none'
    ? theme.color.muted
    : countdown.tone === 'expired'
      ? theme.semantic.danger.text
      : countdown.tone === 'normal'
        ? '#ef4444'
        : countdown.tone === 'soon'
          ? '#dc2626'
          : '#b91c1c';
  return <AppText style={[compact ? styles.posterCountdownText : styles.summaryCountdownText, { color }]} numberOfLines={1}>{countdown.label}</AppText>;
}

function CompleteTradeSummaryCard({ trade, tradeIndex, tradeTotal, onOpen }: TradeSummaryCardProps) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.summaryCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.summaryHeaderRow}>
        <AppText style={[styles.summaryHeader, { color: theme.color.muted }]}>TRADE · {getTradeCounter(tradeIndex, tradeTotal)}</AppText>
        <AppText style={[styles.summaryStatus, { color: theme.color.text }]}>{getStatusLabel(trade.status)}</AppText>
      </View>

      {hasOwnerIdentity(trade) ? <View style={styles.summaryOwnerRow}><OwnerIdentityChip trade={trade} compact /></View> : null}

      <View style={styles.summaryBody}>
        <View style={styles.tradeSideBlock}>
          <AppText style={[styles.sideEyebrow, { color: '#60A5FA' }]}>I need</AppText>
          <AppText style={[styles.sideTitle, { color: theme.color.text }]} numberOfLines={2}>{needTitle(trade)}</AppText>
          <AppText style={[styles.sideMeta, { color: theme.color.muted }]} numberOfLines={1}>{needMeta(trade.need, trade)}</AppText>
        </View>

        <View style={styles.exchangeRow}>
          <View style={[styles.exchangeLine, { backgroundColor: theme.color.border }]} />
          <TradeExchangeIcon color={theme.color.muted} size={16} strokeWidth={2.2} />
          <View style={[styles.exchangeLine, { backgroundColor: theme.color.border }]} />
        </View>

        <View style={styles.tradeSideBlock}>
          <AppText style={[styles.sideEyebrow, { color: '#34D399' }]}>I offer</AppText>
          <AppText style={[styles.sideTitle, { color: theme.color.text }]} numberOfLines={2}>{offerTitle(trade)}</AppText>
          <AppText style={[styles.sideMeta, { color: theme.color.muted }]} numberOfLines={1}>{offerMeta(trade.offer, trade)}</AppText>
        </View>
      </View>

      <View style={styles.countdownSlot}><TradeCountdown expiresAt={trade.expiresAt} /></View>
    </Pressable>
  );
}

function OpenTradeSummaryCard({ trade, tradeIndex, tradeTotal, onOpen }: TradeSummaryCardProps) {
  const postType = tradePostType(trade);
  const countdown = useCountdownState(trade.expiresAt);
  const summarySubtitle = postType === 'open_need'
    ? compactSideMeta(needMeta(trade.need, trade), trade.need?.description)
    : compactSideMeta(offerMeta(trade.offer, trade), trade.offer?.description);

  return (
    <TradePosterCard
      id={`${trade.id}:summary`}
      imageUrl={firstDeckImage(trade)}
      badge={summaryBadge(trade, tradeIndex, tradeTotal)}
      eyebrow={exchangeEyebrow(trade)}
      title={summaryTitle(trade)}
      subtitle={summarySubtitle}
      status={countdown}
      chips={starterChips(trade)}
      identity={hasOwnerIdentity(trade) ? <OwnerIdentityChip trade={trade} /> : undefined}
      variant={postType === 'open_need' ? 'need' : 'offer'}
      onPress={onOpen}
    />
  );
}

export function TradeSummaryCard(props: TradeSummaryCardProps) {
  return tradePostType(props.trade) === 'need_offer' ? <CompleteTradeSummaryCard {...props} /> : <OpenTradeSummaryCard {...props} />;
}

function SimpleImageCard({ kind, media, onOpen }: TradeImageCardProps) {
  const theme = useThemeTokens();
  const isNeed = kind === 'needImage';
  const [imageFailed, setImageFailed] = useState(!activeMediaUrl(media));
  const imageUrl = activeMediaUrl(media);
  useEffect(() => setImageFailed(!imageUrl), [imageUrl]);

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.imageCard, { backgroundColor: theme.color.elevated }, pressed && styles.pressed]}>
      {imageUrl && !imageFailed ? <Image source={{ uri: imageUrl }} onError={() => setImageFailed(true)} style={styles.fullBleedImage} resizeMode="cover" /> : <View style={[styles.imagePlaceholder, { backgroundColor: theme.color.surface }]}><AppText style={[styles.imagePlaceholderText, { color: theme.color.muted }]}>{imagePlaceholderLabel(media)}</AppText></View>}
      <View style={styles.floatingBadge}><AppText style={styles.floatingBadgeText}>{isNeed ? 'Need reference' : 'Offer sample'}</AppText></View>
    </Pressable>
  );
}

export function TradeImageCard({ trade, kind, media, onOpen }: TradeImageCardProps) {
  const isCompleteTrade = tradePostType(trade) === 'need_offer';
  if (isCompleteTrade) return <SimpleImageCard trade={trade} kind={kind} media={media} onOpen={onOpen} />;

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

const styles = StyleSheet.create({
  summaryCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 26,
    paddingVertical: 22,
    gap: 12,
  },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  summaryHeader: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.95 },
  summaryOwnerRow: { alignItems: 'center', minHeight: 24 },
  summaryOwnerIdentity: { alignSelf: 'center' },
  posterOwnerIdentity: { minHeight: 30, paddingVertical: 3, paddingLeft: 4, paddingRight: 8, maxWidth: 142 },
  summaryStatus: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.95 },
  summaryBody: { flex: 1, justifyContent: 'center', gap: 18, minHeight: 0 },
  tradeSideBlock: { alignItems: 'center', gap: 5, paddingVertical: 3 },
  sideEyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  sideTitle: { textAlign: 'center', fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.55, paddingBottom: 1 },
  sideMeta: { textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  exchangeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 1 },
  exchangeLine: { flex: 1, height: StyleSheet.hairlineWidth },
  countdownSlot: { minHeight: 20, alignItems: 'center', justifyContent: 'center' },
  summaryCountdownText: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: 1.2 },
  posterCountdownText: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.75 },
  imageCard: { flex: 1, overflow: 'hidden' },
  fullBleedImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  imagePlaceholderText: { fontWeight: '900' },
  floatingBadge: { position: 'absolute', left: 14, top: 14, borderRadius: 999, backgroundColor: 'rgba(15, 23, 42, 0.72)', paddingHorizontal: 10, paddingVertical: 6 },
  floatingBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.35 },
  pressed: { opacity: 0.82 },
});
