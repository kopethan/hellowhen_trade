// apps/mobile/src/features/trade/CreateTradeScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeExchangeMode, WalletDto } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { formatMoney } from '@hellowhen/shared';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, MoneyPill, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
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
export type TradeSidePickerParams = { side: TradeCreateSide; selection?: TradeCreateSideSelection | null };
export type TradeCreateReturnParams = { selectedTradeSide?: TradeCreateSideSelection } | undefined;

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTrade'>;
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type WalletResponse = { wallet: WalletDto | null };
type CreateTradeResponse = { trade: TradeDeckItem };

const expiryOptions = [{ label: '7 days', days: 7 }, { label: '14 days', days: 14 }, { label: '30 days', days: 30 }, { label: 'No expiry', days: null }] as const;

function isNeedAvailable(need: NeedItem) { return !['fulfilled', 'closed', 'expired'].includes(need.status); }
function isOfferAvailable(offer: OfferItem) { return !['accepted', 'closed', 'expired'].includes(offer.status); }
function optionalModeLabel(mode?: TradeExchangeMode | null) { return mode ? modeLabel(mode) : undefined; }
function needMeta(need?: NeedItem | null) { return need ? [itemTypeLabel(need.itemType ?? 'service'), need.category, need.timing, optionalModeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · ') : ''; }
function offerMeta(offer?: OfferItem | null) { return offer ? [itemTypeLabel(offer.itemType ?? 'service'), offer.category, offer.availability, optionalModeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · ') : ''; }
function buildExpiresAt(days: number | null) { if (!days) return undefined; const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days); return expiresAt.toISOString(); }
function moneySelection(selection: TradeCreateSideSelection | null) { return betaFeatures.moneyTradesEnabled && selection?.kind === 'money' ? selection : null; }
function amountFor(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) { return moneySelection(needSelection)?.amountCents ?? moneySelection(offerSelection)?.amountCents ?? 0; }
function currencyFor(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) { return moneySelection(needSelection)?.currency ?? moneySelection(offerSelection)?.currency ?? 'eur'; }
function buildPreviewTrade({ needSelection, offerSelection, need, offer, amountCents, currency, expiryDays }: { needSelection: TradeCreateSideSelection | null; offerSelection: TradeCreateSideSelection | null; need: NeedItem | null; offer: OfferItem | null; amountCents: number; currency: string; expiryDays: number | null }): TradeDeckItem {
  const needTitleValue = previewTitle(needSelection, need, 'Choose what you need');
  const offerTitleValue = previewTitle(offerSelection, offer, 'Choose what you offer');
  const description = [need?.description, offer?.description].filter(Boolean).join(' I offer: ') || 'Choose a Need and Offer to preview this trade deck.';
  const createdAt = new Date(0).toISOString();

  return {
    id: 'draft-trade-preview',
    ownerId: 'preview',
    providerId: null,
    needId: need?.id ?? null,
    offerId: offer?.id ?? null,
    title: `${needTitleValue} ↔ ${offerTitleValue}`,
    description,
    creditAmount: 0,
    amountCents: betaFeatures.moneyTradesEnabled ? amountCents : 0,
    currency,
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
    need,
    offer,
    media: [],
  };
}

export function CreateTradeScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const { width } = useWindowDimensions();
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
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
  const previewTrade = useMemo(() => buildPreviewTrade({ needSelection, offerSelection, need: selectedNeed, offer: selectedOffer, amountCents, currency, expiryDays }), [amountCents, currency, expiryDays, needSelection, offerSelection, selectedNeed, selectedOffer]);
  const previewCards = useMemo(() => buildTradeSquareDeckCards(previewTrade, 0, 1), [previewTrade]);

  useEffect(() => {
    const selection = route.params?.selectedTradeSide;
    if (!selection) return;
    if (selection.side === 'need') setNeedSelection(selection);
    else setOfferSelection(selection);
  }, [route.params?.selectedTradeSide]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [needsResult, offersResult, walletResult] = await Promise.all([
        api.needs.mine() as Promise<NeedsResponse>,
        api.offers.mine() as Promise<OffersResponse>,
        betaFeatures.moneyFeaturesVisible ? api.wallet.me() as Promise<WalletResponse> : Promise.resolve({ wallet: null } as WalletResponse),
      ]);
      setNeeds(Array.isArray(needsResult.needs) ? needsResult.needs : []);
      setOffers(Array.isArray(offersResult.offers) ? offersResult.offers : []);
      setWallet(walletResult.wallet ?? null);
    } catch (caughtError) {
      setNeeds([]);
      setOffers([]);
      setWallet(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadResources(); }, [loadResources]));

  function openSidePicker(side: TradeCreateSide) {
    navigation.navigate('TradeSidePicker', { side, selection: side === 'need' ? needSelection : offerSelection });
  }

  async function handlePublish() {
    if (!needSelection) return setError('Choose what you need before publishing.');
    if (!offerSelection) return setError('Choose what you offer before publishing.');
    if ((needSelection.kind === 'money' || offerSelection.kind === 'money') && !betaFeatures.moneyTradesEnabled) return setError('Money trades are hidden for the beta launch. Choose saved Needs and Offers.');
    if (needSelection.kind === 'money' && offerSelection.kind === 'money') return setError('A trade cannot need money and offer money at the same time.');
    if (offerSelection.kind === 'money' && wallet && offerSelection.amountCents > wallet.availableBalanceCents) return setError(`You can only offer up to ${formatMoney(wallet.availableBalanceCents, wallet.currency)}.`);

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.trades.create({
        needKind: betaFeatures.moneyTradesEnabled && needSelection.kind === 'money' ? 'money' : 'need',
        offerKind: betaFeatures.moneyTradesEnabled && offerSelection.kind === 'money' ? 'money' : 'offer',
        needId: needSelection.kind === 'need' || !betaFeatures.moneyTradesEnabled ? (needSelection.kind === 'need' ? needSelection.id : undefined) : undefined,
        offerId: offerSelection.kind === 'offer' || !betaFeatures.moneyTradesEnabled ? (offerSelection.kind === 'offer' ? offerSelection.id : undefined) : undefined,
        creditAmount: 0,
        amountCents: betaFeatures.moneyTradesEnabled ? amountCents : 0,
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

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Create Trade" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadResources(); }} />}>
        <View style={styles.header}>
          <SemanticBadge label="Trade" tone="trade" />
          <AppText style={styles.title}>Create Trade</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Choose what you need and what you offer.</AppText>
        </View>
        {error ? <InfoNotice tone="danger" title="Could not publish" body={error} /> : null}
        <SideSelectionCard theme={theme} side="need" title="I need" emptyTitle="Select what you need" emptyBody="Choose a saved Need." selection={needSelection} need={selectedNeed} offer={null} onPress={() => openSidePicker('need')} />
        <SideSelectionCard theme={theme} side="offer" title="I offer" emptyTitle="Select what you offer" emptyBody="Choose a saved Offer." selection={offerSelection} need={null} offer={selectedOffer} onPress={() => openSidePicker('offer')} />
        <AppCard>
          <AppText style={styles.sectionTitle}>Expiry</AppText>
          <View style={styles.expiryRow}>{expiryOptions.map((option) => {
            const selected = expiryDays === option.days;
            return <Pressable key={option.label} disabled={submitting} onPress={() => setExpiryDays(option.days)} style={({ pressed }) => [styles.expiryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, submitting && styles.disabled, pressed && styles.pressed]}><AppText style={[styles.expiryButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{option.label}</AppText></Pressable>;
          })}</View>
        </AppCard>
        <AppCard>
          <View style={styles.deckPreviewHeader}>
            <AppText style={styles.sectionTitle}>Deck preview</AppText>
            {previewCards.length > 1 ? <AppText style={[styles.deckPreviewCount, { color: theme.color.muted }]}>{previewCards.length} cards</AppText> : null}
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
          {previewCards.length > 1 ? <AppText style={[styles.previewHint, { color: theme.color.muted }]}>Swipe the preview to check selected Need and Offer image cards.</AppText> : null}
        </AppCard>
        <View style={styles.actions}>
          <Pressable disabled={submitting || loading} onPress={handlePublish} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.proposal.bg }, (submitting || loading) && styles.disabled, pressed && styles.pressed]}><AppText style={styles.primaryButtonText}>{submitting ? 'Publishing...' : 'Publish Trade'}</AppText></Pressable>
          <Pressable disabled={submitting} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, submitting && styles.disabled, pressed && styles.pressed]}><AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>Cancel</AppText></Pressable>
        </View>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function SideSelectionCard({ theme, side, title, emptyTitle, emptyBody, selection, need, offer, onPress }: { theme: ThemeTokens; side: TradeCreateSide; title: string; emptyTitle: string; emptyBody: string; selection: TradeCreateSideSelection | null; need: NeedItem | null; offer: OfferItem | null; onPress: () => void }) {
  const money = moneySelection(selection);
  const item = need ?? offer;
  const meta = need ? needMeta(need) : offer ? offerMeta(offer) : '';
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sideCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><View style={styles.sideHeaderRow}><AppText style={styles.sectionTitle}>{title}</AppText><View style={styles.changePill}><AppText style={[styles.changeText, { color: theme.semantic.proposal.bg }]}>{selection ? 'Change' : 'Select'}</AppText><MobileIcon name="chevron-right" size={17} color={theme.semantic.proposal.bg} /></View></View>{money ? <View style={styles.selectedContent}><SemanticBadge label={side === 'need' ? 'Money needed' : 'Money offered'} tone="credits" size="sm" /><AppText style={styles.selectedTitle}>Wallet money</AppText><MoneyPill amountCents={money.amountCents} currency={money.currency} label={side === 'need' ? 'needed' : 'offered'} /><AppText style={[styles.selectedMeta, { color: theme.color.muted }]}>{side === 'offer' ? 'This amount is held when you accept a proposal.' : 'The accepted applicant will need enough wallet balance.'}</AppText></View> : item ? <View style={styles.selectedContent}><SemanticBadge label={side === 'need' ? 'Saved Need' : 'Saved Offer'} tone={side === 'need' ? 'need' : 'offer'} size="sm" /><AppText style={styles.selectedTitle}>{item.title}</AppText>{meta ? <AppText style={[styles.selectedMeta, { color: theme.color.muted }]}>{meta}</AppText> : null}<AppText style={[styles.selectedBody, { color: theme.color.muted }]} numberOfLines={2}>{item.description}</AppText></View> : <View style={[styles.emptyBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={styles.emptyTitle}>{emptyTitle}</AppText><AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{emptyBody}</AppText></View>}</Pressable>;
}

function previewTitle(selection: TradeCreateSideSelection | null, item: NeedItem | OfferItem | null, fallback: string) { if (betaFeatures.moneyTradesEnabled && selection?.kind === 'money') return 'Wallet money'; return item?.title || fallback; }


const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 14 }, header: { gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { lineHeight: 21, fontWeight: '600' }, sideCard: { borderRadius: 28, borderWidth: 1, padding: 18, gap: 14 }, sideHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { flex: 1, fontSize: 18, fontWeight: '900' }, changePill: { flexDirection: 'row', alignItems: 'center', gap: 2 }, changeText: { fontWeight: '900' }, selectedContent: { gap: 8 }, selectedTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.45 }, selectedMeta: { fontSize: 13, fontWeight: '800', lineHeight: 19 }, selectedBody: { lineHeight: 20, fontWeight: '600' }, emptyBox: { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 14, gap: 5 }, emptyTitle: { fontWeight: '900' }, emptyBody: { lineHeight: 20, fontWeight: '600' }, expiryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, expiryButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }, expiryButtonText: { fontWeight: '900' }, previewCard: { borderRadius: 26, borderWidth: 1, padding: 18, gap: 14 }, deckPreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, deckPreviewCount: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }, previewDeckStage: { alignItems: 'center', justifyContent: 'center', marginTop: 2 }, previewHint: { fontSize: 12, fontWeight: '800', lineHeight: 18, textAlign: 'center' }, previewHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, previewHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9 }, previewStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9 }, previewBlock: { gap: 5 }, previewEyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' }, previewTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }, previewMeta: { fontWeight: '800', lineHeight: 20 }, swapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, swapLine: { flex: 1, height: 1 }, swapCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, actions: { gap: 10 }, primaryButton: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' }, primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, secondaryButton: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' }, secondaryButtonText: { fontWeight: '900' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 } });
