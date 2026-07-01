import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { MediaAssetDto, TradePostType } from '@hellowhen/contracts';
import { formatMoney, normalizePreviewCardTheme } from '@hellowhen/shared';
import { useTranslation } from '../../../providers/MobileI18nProvider';
import { AppText } from '../../../components/AppText';
import { useThemeTokens } from '../../../providers/ThemeProvider';
import { TradeExchangeIcon } from './TradeExchangeIcon';
import { resolveMediaVariantUrl } from '../mediaUrls';
import type { NeedItem, OfferItem, TradeDeckItem } from '../types';
import { TradePosterCard, type TradePosterCardStatusTone } from './TradePosterCard';
import { durationPresetLabel } from './InventoryFormFields';

export type TradeSquareDeckCard = {
  id: string;
  kind: 'summary' | 'needImage' | 'offerImage';
  trade: TradeDeckItem;
  tradeIndex: number;
  tradeTotal: number;
  media?: MediaAssetDto;
  hiddenImageCount?: number;
};

type TradeSummaryCardProps = { trade: TradeDeckItem; tradeIndex: number; tradeTotal: number; onOpen: () => void; };
type TradeImageCardProps = { trade: TradeDeckItem; kind: 'needImage' | 'offerImage'; media?: MediaAssetDto; hiddenImageCount?: number; onOpen: () => void; };
type TFunction = ReturnType<typeof useTranslation>['t'];
type CountdownState = { label: string; tone: TradePosterCardStatusTone };

function deckMedia(media: MediaAssetDto[] | undefined) {
  return (media ?? []).filter((asset) => asset.status === 'active');
}

function activeMediaUrl(media?: MediaAssetDto | null) {
  if (!media?.url || media.status !== 'active') return null;
  return resolveMediaVariantUrl(media, 'card');
}

function hiddenMediaCount(side: { mediaAccess?: { requiresAuth?: boolean; hiddenCount?: number } } | null | undefined) {
  return side?.mediaAccess?.requiresAuth && (side.mediaAccess.hiddenCount ?? 0) > 0 ? side.mediaAccess.hiddenCount ?? 0 : 0;
}

function firstDeckImage(trade: TradeDeckItem) {
  return activeMediaUrl(deckMedia(trade.need?.media)[0]) ?? activeMediaUrl(deckMedia(trade.offer?.media)[0]);
}

export function buildTradeSquareDeckCards(trade: TradeDeckItem, tradeIndex = 0, tradeTotal = 1): TradeSquareDeckCard[] {
  const cards: TradeSquareDeckCard[] = [{ id: `${trade.id}:summary`, kind: 'summary', trade, tradeIndex, tradeTotal }];
  for (const [index, media] of deckMedia(trade.need?.media).entries()) cards.push({ id: `${trade.id}:need:${media.id}:${index}`, kind: 'needImage', trade, tradeIndex, tradeTotal, media });
  const hiddenNeedCount = hiddenMediaCount(trade.need);
  if (hiddenNeedCount > 0) cards.push({ id: `${trade.id}:need:auth-required`, kind: 'needImage', trade, tradeIndex, tradeTotal, hiddenImageCount: hiddenNeedCount });
  for (const [index, media] of deckMedia(trade.offer?.media).entries()) cards.push({ id: `${trade.id}:offer:${media.id}:${index}`, kind: 'offerImage', trade, tradeIndex, tradeTotal, media });
  const hiddenOfferCount = hiddenMediaCount(trade.offer);
  if (hiddenOfferCount > 0) cards.push({ id: `${trade.id}:offer:auth-required`, kind: 'offerImage', trade, tradeIndex, tradeTotal, hiddenImageCount: hiddenOfferCount });
  return cards;
}

export function renderTradeSquareDeckCard(card: TradeSquareDeckCard, _index: number, _total: number, onOpen: () => void) {
  if (card.kind === 'summary') return <TradeSummaryCard trade={card.trade} tradeIndex={card.tradeIndex} tradeTotal={card.tradeTotal} onOpen={onOpen} />;
  return <TradeImageCard trade={card.trade} kind={card.kind} media={card.media} hiddenImageCount={card.hiddenImageCount} onOpen={onOpen} />;
}


function previewThemeForTrade(trade: TradeDeckItem) {
  const tradeTheme = normalizePreviewCardTheme(trade.previewTheme);
  if (tradeTheme !== 'default') return tradeTheme;
  const needTheme = normalizePreviewCardTheme(trade.need?.previewTheme);
  if (needTheme !== 'default') return needTheme;
  return normalizePreviewCardTheme(trade.offer?.previewTheme);
}

function getTradeCounter(index: number, total: number) { return `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`; }
function getStatusLabel(status: string, t: TFunction) {
  if (status === 'active') return t('trade.statuses.active').toUpperCase();
  const key = `trade.statuses.${status}`;
  const translated = t(key);
  return translated === key ? status.replace(/_/g, ' ').toUpperCase() : translated.toUpperCase();
}
function modeLabel(mode: string | null | undefined, t: TFunction) {
  if (mode === 'remote') return t('trade.modes.remote');
  if (mode === 'local') return t('trade.modes.local');
  if (mode === 'hybrid') return t('trade.modes.hybrid');
  return null;
}
function moneySide(trade: TradeDeckItem) { const amountCents = trade.amountCents ?? 0; if (amountCents <= 0) return null; if (!trade.need && trade.offer) return 'need' as const; if (trade.need && !trade.offer) return 'offer' as const; return null; }
function cashPromiseSide(trade: TradeDeckItem) { return trade.cashPromise?.side ?? null; }
function moneyLabel(trade: TradeDeckItem) { return formatMoney(trade.amountCents ?? 0, trade.currency ?? 'eur'); }
function cashPromiseLabel(trade: TradeDeckItem) { return trade.cashPromise ? formatMoney(trade.cashPromise.amountCents, trade.cashPromise.currency ?? 'eur') : ''; }
function needTitle(trade: TradeDeckItem, t: TFunction) { if (cashPromiseSide(trade) === 'need') return t('trade.cashPromise.title'); return moneySide(trade) === 'need' ? t('account.walletMoney') : trade.need?.title || trade.title || t('trade.labels.openRequestFallback'); }
function offerTitle(trade: TradeDeckItem, t: TFunction) { if (cashPromiseSide(trade) === 'offer') return t('trade.cashPromise.title'); return moneySide(trade) === 'offer' ? t('account.walletMoney') : trade.offer?.title || t('trade.labels.openOfferFallback'); }
function compactJoin(values: Array<string | null | undefined>, limit = 3) { return values.filter((value): value is string => Boolean(value && value.trim())).slice(0, limit).join(' · '); }
function languageChip(item: { displayLanguage?: { languageCode?: string | null; source?: string | null } | null } | null | undefined) { const code = item?.displayLanguage?.languageCode?.toUpperCase(); return code && item?.displayLanguage?.source !== 'exact' ? code : null; }
function compactSideMeta(metadata: string, fallback?: string | null) { return metadata || fallback || ''; }
function needTimingBadge(need: NeedItem | null | undefined, t: TFunction) { return need ? durationPresetLabel(need.estimatedDurationPreset, t) : ''; }
function offerTimingBadge(offer: OfferItem | null | undefined, t: TFunction) { return offer ? durationPresetLabel(offer.typicalDurationPreset, t) : ''; }
function tradeTimingBadge(trade: TradeDeckItem, t: TFunction) {
  const needDuration = needTimingBadge(trade.need, t);
  const offerDuration = offerTimingBadge(trade.offer, t);
  if (needDuration && offerDuration && needDuration !== offerDuration) return `${needDuration} ↔ ${offerDuration}`;
  return needDuration || offerDuration;
}
function tradePostType(trade: TradeDeckItem): TradePostType { return trade.postType ?? 'need_offer'; }
function summaryTitle(trade: TradeDeckItem, t: TFunction) {
  const postType = tradePostType(trade);
  if (postType === 'open_need') return needTitle(trade, t);
  if (postType === 'open_offer') return offerTitle(trade, t);
  return `${needTitle(trade, t)} ↔ ${offerTitle(trade, t)}`;
}
function exchangeEyebrow(trade: TradeDeckItem, t: TFunction) {
  const postType = tradePostType(trade);
  if (postType === 'open_need') return t('trade.postTypes.openForOffers');
  if (postType === 'open_offer') return t('trade.postTypes.openForNeeds');
  if (cashPromiseSide(trade)) return t('trade.cashPromise.notProcessed');
  if (moneySide(trade) === 'need') return t('trade.labels.moneyOfferExchange');
  if (moneySide(trade) === 'offer') return t('trade.labels.needMoneyExchange');
  return t('trade.labels.needOfferExchange');
}
function summaryBadge(trade: TradeDeckItem, tradeIndex: number, tradeTotal: number, t: TFunction) {
  const prefix = tradePostType(trade) === 'open_need' ? t('trade.labels.openNeed') : tradePostType(trade) === 'open_offer' ? t('trade.labels.openOffer') : t('trade.labels.trade');
  return `${prefix} · ${getTradeCounter(tradeIndex, tradeTotal)}`;
}
function imagePlaceholderLabel(media: MediaAssetDto | undefined, hiddenImageCount: number | undefined, t: TFunction) { if (hiddenImageCount) return t('media.authRequired.title'); return media ? t('trade.labels.imageUnavailable') : t('media.empty.noImagesYet'); }
function starterChips(trade: TradeDeckItem) { return [languageChip(trade.need), languageChip(trade.offer), ...(trade.need?.tags ?? []), ...(trade.offer?.tags ?? [])].filter((chip): chip is string => Boolean(chip)).slice(0, 3); }
export function needMeta(need: NeedItem | null | undefined, trade: TradeDeckItem | undefined, t: TFunction) { if (trade && cashPromiseSide(trade) === 'need') return `${cashPromiseLabel(trade)} · ${t('trade.cashPromise.notProcessed')}`; if (trade && moneySide(trade) === 'need') return moneyLabel(trade); return need ? compactJoin([need.category, needTimingBadge(need, t), modeLabel(need.mode, t), need.locationLabel], 2) || t('trade.labels.needDetails') : t('trade.labels.needDetails'); }
export function offerMeta(offer: OfferItem | null | undefined, trade: TradeDeckItem | undefined, t: TFunction) { if (trade && cashPromiseSide(trade) === 'offer') return `${cashPromiseLabel(trade)} · ${t('trade.cashPromise.notProcessed')}`; if (trade && moneySide(trade) === 'offer') return moneyLabel(trade); return offer ? compactJoin([offer.includes?.[0], offerTimingBadge(offer, t), modeLabel(offer.mode, t), offer.locationLabel], 2) || t('trade.labels.offerDetails') : t('trade.labels.offerDetails'); }

function pad(value: number, size = 2) { return String(value).padStart(size, '0'); }
function buildCountdownState(expiresAt: string | null | undefined, t: TFunction, now = Date.now()): CountdownState {
  if (!expiresAt) return { label: t('trade.countdown.noExpiry'), tone: 'none' };
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return { label: t('trade.countdown.noExpiry'), tone: 'none' };
  const secondsLeft = Math.floor((expiresMs - now) / 1000);
  if (secondsLeft <= 0) return { label: t('trade.countdown.expired'), tone: 'expired' };
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const tone: TradePosterCardStatusTone = secondsLeft <= 86400 ? 'urgent' : secondsLeft <= 259200 ? 'soon' : 'normal';
  return { label: `${pad(days, 3)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, tone };
}
function useCountdownState(expiresAt: string | null | undefined, t: TFunction) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return useMemo(() => buildCountdownState(expiresAt, t, now), [expiresAt, now, t]);
}

function TradeCountdown({ expiresAt, compact = false }: { expiresAt?: string | null; compact?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const countdown = useCountdownState(expiresAt, t);
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
  const { t } = useTranslation();
  const previewTheme = previewThemeForTrade(trade);
  const themeAccent = previewTheme === 'blue' ? '#dbeafe' : previewTheme === 'green' ? '#dcfce7' : previewTheme === 'purple' ? '#ede9fe' : previewTheme === 'amber' ? '#fef3c7' : previewTheme === 'rose' ? '#ffe4e6' : null;
  const rightBadge = tradeTimingBadge(trade, t) || (trade.status === 'active' ? '' : getStatusLabel(trade.status, t));
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.summaryCard, { backgroundColor: themeAccent ?? theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.summaryHeaderRow}>
        <AppText style={[styles.summaryHeader, { color: theme.color.muted }]}>{t('trade.labels.trade').toUpperCase()} · {getTradeCounter(tradeIndex, tradeTotal)}</AppText>
        {rightBadge ? <AppText style={[styles.summaryStatus, { color: theme.color.text }]} numberOfLines={1}>{rightBadge}</AppText> : null}
      </View>


      <View style={styles.summaryBody}>
        <View style={styles.tradeSideBlock}>
          <AppText style={[styles.sideEyebrow, { color: '#60A5FA' }]}>{t('trade.labels.iNeed')}</AppText>
          <AppText style={[styles.sideTitle, { color: theme.color.text }]} numberOfLines={2}>{needTitle(trade, t)}</AppText>
          <AppText style={[styles.sideMeta, { color: theme.color.muted }]} numberOfLines={1}>{compactJoin([languageChip(trade.need), needMeta(trade.need, trade, t)], 2)}</AppText>
        </View>

        <View style={styles.exchangeRow}>
          <View style={[styles.exchangeLine, { backgroundColor: theme.color.border }]} />
          <TradeExchangeIcon color={theme.color.muted} size={16} strokeWidth={2.2} />
          <View style={[styles.exchangeLine, { backgroundColor: theme.color.border }]} />
        </View>

        <View style={styles.tradeSideBlock}>
          <AppText style={[styles.sideEyebrow, { color: '#34D399' }]}>{t('trade.labels.iOffer')}</AppText>
          <AppText style={[styles.sideTitle, { color: theme.color.text }]} numberOfLines={2}>{offerTitle(trade, t)}</AppText>
          <AppText style={[styles.sideMeta, { color: theme.color.muted }]} numberOfLines={1}>{compactJoin([languageChip(trade.offer), offerMeta(trade.offer, trade, t)], 2)}</AppText>
        </View>
      </View>

      <View style={styles.countdownSlot}><TradeCountdown expiresAt={trade.expiresAt} /></View>
    </Pressable>
  );
}

function OpenTradeSummaryCard({ trade, tradeIndex, tradeTotal, onOpen }: TradeSummaryCardProps) {
  const { t } = useTranslation();
  const postType = tradePostType(trade);
  const countdown = useCountdownState(trade.expiresAt, t);
  const summarySubtitle = postType === 'open_need'
    ? compactSideMeta(needMeta(trade.need, trade, t), trade.need?.description)
    : compactSideMeta(offerMeta(trade.offer, trade, t), trade.offer?.description);
  const topMeta = postType === 'open_need' ? needTimingBadge(trade.need, t) : offerTimingBadge(trade.offer, t);

  return (
    <TradePosterCard
      id={`${trade.id}:summary`}
      imageUrl={firstDeckImage(trade)}
      badge={summaryBadge(trade, tradeIndex, tradeTotal, t)}
      eyebrow={exchangeEyebrow(trade, t)}
      title={summaryTitle(trade, t)}
      subtitle={summarySubtitle}
      topMeta={topMeta}
      status={countdown}
      chips={starterChips(trade)}
      variant={postType === 'open_need' ? 'need' : 'offer'}
      onPress={onOpen}
      previewTheme={previewThemeForTrade(trade)}
    />
  );
}

export function TradeSummaryCard(props: TradeSummaryCardProps) {
  return tradePostType(props.trade) === 'need_offer' ? <CompleteTradeSummaryCard {...props} /> : <OpenTradeSummaryCard {...props} />;
}

function SimpleImageCard({ kind, media, hiddenImageCount, onOpen }: TradeImageCardProps) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const isNeed = kind === 'needImage';
  const [imageFailed, setImageFailed] = useState(!activeMediaUrl(media));
  const imageUrl = activeMediaUrl(media);
  useEffect(() => setImageFailed(!imageUrl), [imageUrl]);

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.imageCard, { backgroundColor: theme.color.elevated }, pressed && styles.pressed]}>
      {imageUrl && !imageFailed ? <Image source={{ uri: imageUrl }} onError={() => setImageFailed(true)} style={styles.fullBleedImage} resizeMode="cover" /> : <View style={[styles.imagePlaceholder, { backgroundColor: theme.color.surface }]}><AppText style={[styles.imagePlaceholderText, { color: theme.color.muted }]}>{imagePlaceholderLabel(media, hiddenImageCount, t)}</AppText>{hiddenImageCount ? <AppText style={[styles.imagePlaceholderBody, { color: theme.color.muted }]}>{t('media.authRequired.body', { count: hiddenImageCount })}</AppText> : null}</View>}
      <View style={styles.floatingBadge}><AppText style={styles.floatingBadgeText}>{isNeed ? t('trade.labels.needReference') : t('trade.labels.offerSample')}</AppText></View>
    </Pressable>
  );
}

export function TradeImageCard({ trade, kind, media, hiddenImageCount, onOpen }: TradeImageCardProps) {
  const { t } = useTranslation();
  const isCompleteTrade = tradePostType(trade) === 'need_offer';
  if (isCompleteTrade) return <SimpleImageCard trade={trade} kind={kind} media={media} hiddenImageCount={hiddenImageCount} onOpen={onOpen} />;

  const isNeed = kind === 'needImage';
  const side = isNeed ? trade.need : trade.offer;
  const sideTitle = isNeed ? needTitle(trade, t) : offerTitle(trade, t);
  const sideMeta = isNeed ? needMeta(trade.need, trade, t) : offerMeta(trade.offer, trade, t);
  const sideDescription = side?.description;

  return (
    <TradePosterCard
      id={`${trade.id}:${kind}:${media?.id ?? 'fallback'}`}
      imageUrl={hiddenImageCount ? null : activeMediaUrl(media)}
      badge={isNeed ? t('trade.labels.needReference') : t('trade.labels.offerSample')}
      eyebrow={isNeed ? t('trade.labels.iNeed') : t('trade.labels.iOffer')}
      title={sideTitle}
      subtitle={hiddenImageCount ? t('media.authRequired.body', { count: hiddenImageCount }) : compactSideMeta(sideMeta, sideDescription)}
      chips={[languageChip(side), ...(side?.tags ?? [])].filter((chip): chip is string => Boolean(chip)).slice(0, 3)}
      variant={isNeed ? 'need' : 'offer'}
      onPress={onOpen}
      previewTheme={previewThemeForTrade(trade)}
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
  summaryStatus: { maxWidth: '48%', flexShrink: 1, fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.65, textAlign: 'right' },
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
  imagePlaceholderText: { fontWeight: '900', textAlign: 'center' },
  imagePlaceholderBody: { marginTop: 8, fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  floatingBadge: { position: 'absolute', left: 14, top: 14, borderRadius: 999, backgroundColor: 'rgba(15, 23, 42, 0.72)', paddingHorizontal: 10, paddingVertical: 6 },
  floatingBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.35 },
  pressed: { opacity: 0.82 },
});
