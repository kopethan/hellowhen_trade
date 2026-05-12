// apps/mobile/src/features/trade/CreateTradeScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeExchangeMode, TradePostType } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { itemTypeLabel, modeLabel } from './components/InventoryFormFields';
import { buildTradeSquareDeckCards, renderTradeSquareDeckCard, type TradeSquareDeckCard } from './components/TradeSquareDeckCards';
import { ContinuousSquareStackDeck } from './deck';
import type { NeedItem, OfferItem, TradeDeckItem } from './types';

export type TradeCreateSide = 'need' | 'offer';
export type TradeCreateSideSelection =
  | { side: 'need'; kind: 'need'; id: string }
  | { side: 'need'; kind: 'money'; amountCents: number; currency: string }
  | { side: 'offer'; kind: 'offer'; id: string }
  | { side: 'offer'; kind: 'money'; amountCents: number; currency: string };
export type TradeSidePickerParams = { side: TradeCreateSide; selection?: TradeCreateSideSelection | null; postType?: TradePostType };
export type TradeCreateReturnParams = { selectedTradeSide?: TradeCreateSideSelection } | undefined;

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTrade'>;
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type CreateTradeResponse = { trade: TradeDeckItem };

type PostTypeOption = { value: TradePostType; labelKey: string; badgeKey: string; titleKey: string; bodyKey: string; icon: 'trade' | 'need' | 'offer'; tone: 'trade' | 'need' | 'offer' };

const expiryOptions = [{ labelKey: 'trade.create.expiry7Days', days: 7 }, { labelKey: 'trade.create.expiry14Days', days: 14 }, { labelKey: 'trade.create.expiry30Days', days: 30 }, { labelKey: 'trade.expiry.noExpiry', days: null }] as const;
const postTypeOptions: PostTypeOption[] = [
  { value: 'need_offer', labelKey: 'trade.postTypes.needOffer', badgeKey: 'trade.create.completeTrade', titleKey: 'trade.create.knowBothSides', bodyKey: 'trade.create.needOfferBody', icon: 'trade', tone: 'trade' },
  { value: 'open_need', labelKey: 'trade.postTypes.openNeed', badgeKey: 'trade.create.othersProposeOffers', titleKey: 'trade.create.onlyPostNeed', bodyKey: 'trade.create.openNeedBody', icon: 'need', tone: 'need' },
  { value: 'open_offer', labelKey: 'trade.postTypes.openOffer', badgeKey: 'trade.create.othersProposeNeeds', titleKey: 'trade.create.onlyPostOffer', bodyKey: 'trade.create.openOfferBody', icon: 'offer', tone: 'offer' },
];

function isNeedAvailable(need: NeedItem) { return !['fulfilled', 'closed', 'expired'].includes(need.status); }
function isOfferAvailable(offer: OfferItem) { return !['accepted', 'closed', 'expired'].includes(offer.status); }
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
function optionalModeLabel(mode: TradeExchangeMode | null | undefined, t: TFunction) { return mode ? modeLabel(mode, t) : undefined; }
function needMeta(need: NeedItem | null | undefined, t: TFunction) { return need ? [itemTypeLabel(need.itemType ?? 'service', t), need.category, need.timing, optionalModeLabel(need.mode, t), need.locationLabel].filter(Boolean).join(' · ') : ''; }
function offerMeta(offer: OfferItem | null | undefined, t: TFunction) { return offer ? [itemTypeLabel(offer.itemType ?? 'service', t), offer.category, offer.availability, optionalModeLabel(offer.mode, t), offer.locationLabel].filter(Boolean).join(' · ') : ''; }
function buildExpiresAt(days: number | null) { if (!days) return undefined; const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days); return expiresAt.toISOString(); }
function amountFor(_needSelection: TradeCreateSideSelection | null, _offerSelection: TradeCreateSideSelection | null) { return 0; }
function currencyFor(_needSelection: TradeCreateSideSelection | null, _offerSelection: TradeCreateSideSelection | null) { return 'eur'; }
function postTypeLabel(postType: TradePostType | null, t: TFunction) { const option = postTypeOptions.find((item) => item.value === postType); return option ? t(option.labelKey) : t('trade.create.choosePublishType'); }
function postTypeBody(postType: TradePostType | null, t: TFunction) { const option = postTypeOptions.find((item) => item.value === postType); return option ? t(option.bodyKey) : t('trade.create.chooseKindBody'); }
function previewTitle(_selection: TradeCreateSideSelection | null, item: NeedItem | OfferItem | null, fallback: string) { return item?.title || fallback; }

function buildPreviewTrade({ postType, needSelection, offerSelection, need, offer, amountCents: _amountCents, currency, expiryDays, t }: { postType: TradePostType | null; needSelection: TradeCreateSideSelection | null; offerSelection: TradeCreateSideSelection | null; need: NeedItem | null; offer: OfferItem | null; amountCents: number; currency: string; expiryDays: number | null; t: TFunction }): TradeDeckItem {
  const resolvedPostType = postType ?? 'need_offer';
  const needTitleValue = previewTitle(needSelection, need, t('trade.create.chooseWhatYouNeed'));
  const offerTitleValue = previewTitle(offerSelection, offer, t('trade.create.chooseWhatYouOffer'));
  const title = resolvedPostType === 'open_need' ? t('trade.create.openNeedTitle', { need: needTitleValue }) : resolvedPostType === 'open_offer' ? t('trade.create.openOfferTitle', { offer: offerTitleValue }) : t('trade.create.needOfferTitle', { need: needTitleValue, offer: offerTitleValue });
  const description = resolvedPostType === 'open_need'
    ? need?.description || t('trade.create.previewNeedOpenNeed')
    : resolvedPostType === 'open_offer'
      ? offer?.description || t('trade.create.previewOfferOpenOffer')
      : [need?.description, offer?.description].filter(Boolean).join(` ${t('trade.labels.iOffer')}: `) || t('trade.create.previewNeedOffer');
  const createdAt = new Date(0).toISOString();

  return {
    id: 'draft-trade-preview',
    ownerId: 'preview',
    providerId: null,
    needId: resolvedPostType === 'open_offer' ? null : need?.id ?? null,
    offerId: resolvedPostType === 'open_need' ? null : offer?.id ?? null,
    title,
    description,
    creditAmount: 0,
    amountCents: 0,
    currency,
    postType: resolvedPostType,
    status: 'active',
    isPublic: true,
    createdAt,
    updatedAt: createdAt,
    expiresAt: buildExpiresAt(expiryDays) ?? null,
    closedAt: null,
    deliverySubmittedById: null,
    deliverySubmittedAt: null,
    confirmedById: null,
    confirmedAt: null,
    disputedById: null,
    disputedAt: null,
    disputeTicketId: null,
    need: resolvedPostType === 'open_offer' ? null : need,
    offer: resolvedPostType === 'open_need' ? null : offer,
    media: [],
  };
}

export function CreateTradeScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [postType, setPostType] = useState<TradePostType | null>(null);
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [needSelection, setNeedSelection] = useState<TradeCreateSideSelection | null>(null);
  const [offerSelection, setOfferSelection] = useState<TradeCreateSideSelection | null>(null);
  const [expiryDays, setExpiryDays] = useState<number | null>(14);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usableNeeds = useMemo(() => needs.filter(isNeedAvailable), [needs]);
  const usableOffers = useMemo(() => offers.filter(isOfferAvailable), [offers]);
  const selectedNeed = useMemo(() => needSelection?.kind === 'need' ? usableNeeds.find((need) => need.id === needSelection.id) ?? null : null, [needSelection, usableNeeds]);
  const selectedOffer = useMemo(() => offerSelection?.kind === 'offer' ? usableOffers.find((offer) => offer.id === offerSelection.id) ?? null : null, [offerSelection, usableOffers]);
  const amountCents = amountFor(needSelection, offerSelection);
  const currency = currencyFor(needSelection, offerSelection);
  const previewDeckWidth = Math.min(320, Math.max(260, width - 72));
  const previewTrade = useMemo(() => buildPreviewTrade({ postType, needSelection, offerSelection, need: selectedNeed, offer: selectedOffer, amountCents, currency, expiryDays, t }), [amountCents, currency, expiryDays, needSelection, offerSelection, postType, selectedNeed, selectedOffer, t]);
  const previewCards = useMemo(() => buildTradeSquareDeckCards(previewTrade, 0, 1), [previewTrade]);

  useEffect(() => {
    const selection = route.params?.selectedTradeSide;
    if (!selection) return;
    if (selection.kind === 'money') {
      setError(t('trade.create.validationSavedSidesOnly'));
      return;
    }
    if (selection.side === 'need') setNeedSelection(selection);
    else setOfferSelection(selection);
  }, [route.params?.selectedTradeSide]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [needsResult, offersResult] = await Promise.all([
        api.needs.mine() as Promise<NeedsResponse>,
        api.offers.mine() as Promise<OffersResponse>,
      ]);
      setNeeds(Array.isArray(needsResult.needs) ? needsResult.needs : []);
      setOffers(Array.isArray(offersResult.offers) ? offersResult.offers : []);
    } catch (caughtError) {
      setNeeds([]);
      setOffers([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadResources(); }, [loadResources]));

  function choosePostType(nextPostType: TradePostType) {
    setPostType(nextPostType);
    setError(null);
    if (nextPostType === 'open_need') setOfferSelection(null);
    if (nextPostType === 'open_offer') setNeedSelection(null);
  }

  function openSidePicker(side: TradeCreateSide) {
    navigation.navigate('TradeSidePicker', { side, selection: side === 'need' ? needSelection : offerSelection, postType: postType ?? undefined });
  }

  async function handlePublish() {
    if (!postType) return setError(t('trade.create.validationNativeKind'));
    if (postType !== 'open_offer' && !needSelection) return setError(postType === 'open_need' ? t('trade.create.validationNativeOpenNeed') : t('trade.create.validationNativeNeed'));
    if (postType !== 'open_need' && !offerSelection) return setError(postType === 'open_offer' ? t('trade.create.validationNativeOpenOffer') : t('trade.create.validationNativeOffer'));
    if (postType !== 'open_offer' && needSelection?.kind !== 'need') return setError(t('trade.create.validationNativeSavedNeed'));
    if (postType !== 'open_need' && offerSelection?.kind !== 'offer') return setError(t('trade.create.validationNativeSavedOffer'));

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.trades.create({
        postType,
        needKind: 'need',
        offerKind: 'offer',
        ...(postType !== 'open_offer' && needSelection?.kind === 'need' ? { needId: needSelection.id } : {}),
        ...(postType !== 'open_need' && offerSelection?.kind === 'offer' ? { offerId: offerSelection.id } : {}),
        creditAmount: 0,
        amountCents: 0,
        currency,
        expiresAt: buildExpiresAt(expiryDays),
      }) as CreateTradeResponse;
      navigation.replace('TradeDetail', { tradeId: result.trade.id, title: result.trade.title, description: result.trade.description, amountCents: result.trade.amountCents ?? 0, currency: result.trade.currency ?? 'eur', creditAmount: result.trade.creditAmount ?? 0, status: result.trade.status, expiresAt: result.trade.expiresAt ?? null });
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  const publishButtonLabel = postType === 'open_need' ? t('trade.create.publishOpenNeed') : postType === 'open_offer' ? t('trade.create.publishOpenOffer') : t('trade.create.publishTrade');

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('trade.create.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadResources(); }} />}>
        <View style={styles.header}>
          <SemanticBadge label={postType ? postTypeLabel(postType, t) : t('trade.labels.trade')} tone="trade" />
          <AppText style={styles.title}>{t('trade.create.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{postType ? postTypeBody(postType, t) : t('trade.create.chooseKindBody')}</AppText>
        </View>
        {error ? <InfoNotice tone="danger" title={t('trade.create.couldNotPublish')} body={error} /> : null}
        <AppCard>
          <View style={styles.postTypeHeader}>
            <AppText style={styles.sectionTitle}>{t('trade.create.publishQuestion')}</AppText>
            {postType ? <AppText style={[styles.selectedPostTypeLabel, { color: theme.color.muted }]}>{postTypeLabel(postType, t)}</AppText> : null}
          </View>
          <View style={styles.postTypeList}>{postTypeOptions.map((option) => <PostTypeCard key={option.value} option={option} selected={postType === option.value} theme={theme} onPress={() => choosePostType(option.value)} />)}</View>
        </AppCard>
        {postType ? (
          <>
            {postType !== 'open_offer' ? <SideSelectionCard theme={theme} side="need" title={t('trade.labels.iNeed')} emptyTitle={t('trade.create.selectedNeedEmptyTitle')} emptyBody={postType === 'open_need' ? t('trade.create.chooseOpenNeedBody') : t('trade.create.chooseSavedNeedBody')} selection={needSelection} need={selectedNeed} offer={null} onPress={() => openSidePicker('need')} /> : null}
            {postType !== 'open_need' ? <SideSelectionCard theme={theme} side="offer" title={t('trade.labels.iOffer')} emptyTitle={t('trade.create.selectedOfferEmptyTitle')} emptyBody={postType === 'open_offer' ? t('trade.create.chooseOpenOfferBody') : t('trade.create.chooseSavedOfferBody')} selection={offerSelection} need={null} offer={selectedOffer} onPress={() => openSidePicker('offer')} /> : null}
          </>
        ) : null}
        <AppCard>
          <AppText style={styles.sectionTitle}>{t('trade.create.expiryTitle')}</AppText>
          <View style={styles.expiryRow}>{expiryOptions.map((option) => {
            const selected = expiryDays === option.days;
            return <Pressable key={option.labelKey} disabled={submitting} onPress={() => setExpiryDays(option.days)} style={({ pressed }) => [styles.expiryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, submitting && styles.disabled, pressed && styles.pressed]}><AppText style={[styles.expiryButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{t(option.labelKey)}</AppText></Pressable>;
          })}</View>
          <View style={[styles.expiryCallout, { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border }]}><View style={[styles.expiryCalloutIcon, { backgroundColor: theme.semantic.danger.text }]}><AppText style={styles.expiryCalloutIconText}>!</AppText></View><AppText style={[styles.expiryCalloutText, { color: theme.semantic.danger.text }]}>{t('trade.create.expiryUrgencyBody')}</AppText></View>
        </AppCard>
        <AppCard>
          <View style={styles.deckPreviewHeader}>
            <AppText style={styles.sectionTitle}>{t('trade.create.deckPreview')}</AppText>
            {previewCards.length > 1 ? <AppText style={[styles.deckPreviewCount, { color: theme.color.muted }]}>{t('trade.create.previewCards', { count: previewCards.length })}</AppText> : null}
          </View>
          <View style={styles.previewDeckStage}>
            <ContinuousSquareStackDeck<TradeSquareDeckCard>
              cards={previewCards}
              renderCard={({ card, index, total }) => renderTradeSquareDeckCard(card, index, total, () => {})}
              availableWidth={previewDeckWidth}
              availableHeight={previewDeckWidth}
              minCardSize={260}
              maxCardSize={320}
              renderWindow="all"
              depthEffect="motionOnly"
            />
          </View>
          {previewCards.length > 1 ? <AppText style={[styles.previewHint, { color: theme.color.muted }]}>{t('trade.create.previewHint')}</AppText> : null}
        </AppCard>
        <View style={styles.actions}>
          <Pressable disabled={submitting || loading} onPress={handlePublish} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.proposal.bg }, (submitting || loading) && styles.disabled, pressed && styles.pressed]}><AppText style={styles.primaryButtonText}>{submitting ? t('trade.create.publishing') : publishButtonLabel}</AppText></Pressable>
          <Pressable disabled={submitting} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, submitting && styles.disabled, pressed && styles.pressed]}><AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{t('common.actions.cancel')}</AppText></Pressable>
        </View>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function PostTypeCard({ option, selected, theme, onPress }: { option: PostTypeOption; selected: boolean; theme: ThemeTokens; onPress: () => void }) {
  const { t } = useTranslation();
  const semantic = theme.semantic[option.tone];
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.postTypeCard, { backgroundColor: selected ? semantic.softBg : theme.color.surface, borderColor: selected ? semantic.border : theme.color.border }, pressed && styles.pressed]}><View style={[styles.postTypeIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}><MobileIcon name={option.icon} size={20} color={semantic.text} /></View><View style={styles.postTypeCopy}><SemanticBadge label={t(option.badgeKey)} tone={option.tone} size="sm" /><AppText style={styles.postTypeTitle}>{t(option.titleKey)}</AppText><AppText style={[styles.postTypeBody, { color: selected ? semantic.text : theme.color.muted }]}>{t(option.bodyKey)}</AppText></View>{selected ? <MobileIcon name="proposal-accepted" size={20} color={semantic.text} /> : null}</Pressable>;
}

function SideSelectionCard({ theme, side, title, emptyTitle, emptyBody, selection, need, offer, onPress }: { theme: ThemeTokens; side: TradeCreateSide; title: string; emptyTitle: string; emptyBody: string; selection: TradeCreateSideSelection | null; need: NeedItem | null; offer: OfferItem | null; onPress: () => void }) {
  const { t } = useTranslation();
  const item = need ?? offer;
  const meta = need ? needMeta(need, t) : offer ? offerMeta(offer, t) : '';
  const isSelected = side === 'need' ? selection?.kind === 'need' : selection?.kind === 'offer';
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sideCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><View style={styles.sideHeaderRow}><AppText style={styles.sectionTitle}>{title}</AppText><View style={styles.changePill}><AppText style={[styles.changeText, { color: theme.semantic.proposal.bg }]}>{isSelected ? t('common.actions.edit') : t('inventory.labels.selected')}</AppText><MobileIcon name="chevron-right" size={17} color={theme.semantic.proposal.bg} /></View></View>{item ? <View style={styles.selectedContent}><SemanticBadge label={side === 'need' ? t('inventory.labels.savedNeed') : t('inventory.labels.savedOffer')} tone={side === 'need' ? 'need' : 'offer'} size="sm" /><AppText style={styles.selectedTitle}>{item.title}</AppText>{meta ? <AppText style={[styles.selectedMeta, { color: theme.color.muted }]}>{meta}</AppText> : null}<AppText style={[styles.selectedBody, { color: theme.color.muted }]} numberOfLines={2}>{item.description}</AppText></View> : <View style={[styles.emptyBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={styles.emptyTitle}>{emptyTitle}</AppText><AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{emptyBody}</AppText></View>}</Pressable>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 14 }, header: { gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { lineHeight: 21, fontWeight: '600' }, postTypeHeader: { gap: 6, marginBottom: 12 }, selectedPostTypeLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' }, postTypeList: { gap: 10 }, postTypeCard: { borderRadius: 22, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, postTypeIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, postTypeCopy: { flex: 1, gap: 5 }, postTypeTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.25 }, postTypeBody: { lineHeight: 20, fontWeight: '700' }, sideCard: { borderRadius: 28, borderWidth: 1, padding: 18, gap: 14 }, sideHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { flex: 1, fontSize: 18, fontWeight: '900' }, changePill: { flexDirection: 'row', alignItems: 'center', gap: 2 }, changeText: { fontWeight: '900' }, selectedContent: { gap: 8 }, selectedTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.45 }, selectedMeta: { fontSize: 13, fontWeight: '800', lineHeight: 19 }, selectedBody: { lineHeight: 20, fontWeight: '600' }, emptyBox: { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 14, gap: 5 }, emptyTitle: { fontWeight: '900' }, emptyBody: { lineHeight: 20, fontWeight: '600' }, expiryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, expiryButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }, expiryButtonText: { fontWeight: '900' }, expiryCallout: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, marginTop: 2 }, expiryCalloutIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 }, expiryCalloutIconText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', lineHeight: 14 }, expiryCalloutText: { flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 19 }, deckPreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, deckPreviewCount: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }, previewDeckStage: { alignItems: 'center', justifyContent: 'center', marginTop: 2 }, previewHint: { fontSize: 12, fontWeight: '800', lineHeight: 18, textAlign: 'center' }, actions: { gap: 10 }, primaryButton: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' }, primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, secondaryButton: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' }, secondaryButtonText: { fontWeight: '900' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 } });
