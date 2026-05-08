// apps/mobile/src/features/trade/CreateTradeScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeExchangeMode, WalletDto } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { formatMoney } from '@hellowhen/shared';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { modeLabel } from './components/InventoryFormFields';
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
function needMeta(need?: NeedItem | null) { return need ? [need.category, need.timing, optionalModeLabel(need.mode), need.locationLabel].filter(Boolean).join(' · ') : ''; }
function offerMeta(offer?: OfferItem | null) { return offer ? [offer.category, offer.availability, optionalModeLabel(offer.mode), offer.locationLabel].filter(Boolean).join(' · ') : ''; }
function buildExpiresAt(days: number | null) { if (!days) return undefined; const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days); return expiresAt.toISOString(); }
function moneySelection(selection: TradeCreateSideSelection | null) { return selection?.kind === 'money' ? selection : null; }
function amountFor(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) { return moneySelection(needSelection)?.amountCents ?? moneySelection(offerSelection)?.amountCents ?? 0; }
function currencyFor(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) { return moneySelection(needSelection)?.currency ?? moneySelection(offerSelection)?.currency ?? 'eur'; }

export function CreateTradeScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
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
        api.wallet.me() as Promise<WalletResponse>,
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
    if (needSelection.kind === 'money' && offerSelection.kind === 'money') return setError('A trade cannot need money and offer money at the same time.');
    if (offerSelection.kind === 'money' && wallet && offerSelection.amountCents > wallet.availableBalanceCents) return setError(`You can only offer up to ${formatMoney(wallet.availableBalanceCents, wallet.currency)}.`);

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.trades.create({
        needKind: needSelection.kind === 'money' ? 'money' : 'need',
        offerKind: offerSelection.kind === 'money' ? 'money' : 'offer',
        needId: needSelection.kind === 'need' ? needSelection.id : undefined,
        offerId: offerSelection.kind === 'offer' ? offerSelection.id : undefined,
        creditAmount: 0,
        amountCents,
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
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Choose what you need and what you offer. Money lives inside either side, not as an extra field.</AppText>
        </View>
        {error ? <InfoNotice tone="danger" title="Could not publish" body={error} /> : null}
        <SideSelectionCard theme={theme} side="need" title="I need" emptyTitle="Select what you need" emptyBody="Choose a saved Need, or request wallet money." selection={needSelection} need={selectedNeed} offer={null} onPress={() => openSidePicker('need')} />
        <SideSelectionCard theme={theme} side="offer" title="I offer" emptyTitle="Select what you offer" emptyBody="Choose a saved Offer, or offer wallet money." selection={offerSelection} need={null} offer={selectedOffer} onPress={() => openSidePicker('offer')} />
        <AppCard>
          <AppText style={styles.sectionTitle}>Expiry</AppText>
          <View style={styles.expiryRow}>{expiryOptions.map((option) => {
            const selected = expiryDays === option.days;
            return <Pressable key={option.label} disabled={submitting} onPress={() => setExpiryDays(option.days)} style={({ pressed }) => [styles.expiryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, selected && { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }, submitting && styles.disabled, pressed && styles.pressed]}><AppText style={[styles.expiryButtonText, { color: selected ? theme.semantic.proposal.text : theme.color.muted }]}>{option.label}</AppText></Pressable>;
          })}</View>
        </AppCard>
        <AppCard>
          <AppText style={styles.sectionTitle}>Deck preview</AppText>
          <TradeSummaryPreview theme={theme} needSelection={needSelection} offerSelection={offerSelection} need={selectedNeed} offer={selectedOffer} />
          <InfoNotice tone="info" body="Money sides do not create image cards. Public decks show approved images from saved Needs and Offers." />
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
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sideCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><View style={styles.sideHeaderRow}><AppText style={styles.sectionTitle}>{title}</AppText><AppText style={[styles.changeText, { color: theme.semantic.proposal.bg }]}>{selection ? 'Change' : 'Select'} &gt;</AppText></View>{money ? <View style={styles.selectedContent}><SemanticBadge label={side === 'need' ? 'Money needed' : 'Money offered'} tone="credits" size="sm" /><AppText style={styles.selectedTitle}>Wallet money</AppText><MoneyPill amountCents={money.amountCents} currency={money.currency} label={side === 'need' ? 'needed' : 'offered'} /><AppText style={[styles.selectedMeta, { color: theme.color.muted }]}>{side === 'offer' ? 'This amount is held when you accept a proposal.' : 'The accepted applicant will need enough wallet balance.'}</AppText></View> : item ? <View style={styles.selectedContent}><SemanticBadge label={side === 'need' ? 'Saved Need' : 'Saved Offer'} tone={side === 'need' ? 'need' : 'offer'} size="sm" /><AppText style={styles.selectedTitle}>{item.title}</AppText>{meta ? <AppText style={[styles.selectedMeta, { color: theme.color.muted }]}>{meta}</AppText> : null}<AppText style={[styles.selectedBody, { color: theme.color.muted }]} numberOfLines={2}>{item.description}</AppText></View> : <View style={[styles.emptyBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={styles.emptyTitle}>{emptyTitle}</AppText><AppText style={[styles.emptyBody, { color: theme.color.muted }]}>{emptyBody}</AppText></View>}</Pressable>;
}

function previewTitle(selection: TradeCreateSideSelection | null, item: NeedItem | OfferItem | null, fallback: string) { if (selection?.kind === 'money') return 'Wallet money'; return item?.title || fallback; }
function isNeedItem(item: NeedItem | OfferItem): item is NeedItem { return 'timing' in item; }
function previewMeta(selection: TradeCreateSideSelection | null, item: NeedItem | OfferItem | null, fallback: string) { if (selection?.kind === 'money') return formatMoney(selection.amountCents, selection.currency); if (!item) return fallback; return isNeedItem(item) ? needMeta(item) || 'Need details' : offerMeta(item) || 'Offer details'; }
function TradeSummaryPreview({ theme, needSelection, offerSelection, need, offer }: { theme: ThemeTokens; needSelection: TradeCreateSideSelection | null; offerSelection: TradeCreateSideSelection | null; need: NeedItem | null; offer: OfferItem | null }) {
  return <View style={[styles.previewCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}><View style={styles.previewHeaderRow}><AppText style={[styles.previewHeader, { color: theme.color.muted }]}>TRADE PREVIEW</AppText><AppText style={[styles.previewStatus, { color: theme.semantic.success.bg }]}>OPEN</AppText></View><View style={styles.previewBlock}><AppText style={[styles.previewEyebrow, { color: theme.color.muted }]}>I need</AppText><AppText style={styles.previewTitle}>{previewTitle(needSelection, need, 'Choose what you need')}</AppText><AppText style={[styles.previewMeta, { color: theme.color.muted }]}>{previewMeta(needSelection, need, 'Saved Need / Money')}</AppText></View><View style={styles.swapRow}><View style={[styles.swapLine, { backgroundColor: theme.color.border }]} /><View style={[styles.swapCircle, { backgroundColor: theme.color.text }]}><AppText style={[styles.swapIcon, { color: theme.color.background }]}>↔</AppText></View><View style={[styles.swapLine, { backgroundColor: theme.color.border }]} /></View><View style={styles.previewBlock}><AppText style={[styles.previewEyebrow, { color: theme.color.muted }]}>I offer</AppText><AppText style={styles.previewTitle}>{previewTitle(offerSelection, offer, 'Choose what you offer')}</AppText><AppText style={[styles.previewMeta, { color: theme.color.muted }]}>{previewMeta(offerSelection, offer, 'Saved Offer / Money')}</AppText></View></View>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 14 }, header: { gap: 8 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { lineHeight: 21, fontWeight: '600' }, sideCard: { borderRadius: 28, borderWidth: 1, padding: 18, gap: 14 }, sideHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { flex: 1, fontSize: 18, fontWeight: '900' }, changeText: { fontWeight: '900' }, selectedContent: { gap: 8 }, selectedTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.45 }, selectedMeta: { fontSize: 13, fontWeight: '800', lineHeight: 19 }, selectedBody: { lineHeight: 20, fontWeight: '600' }, emptyBox: { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 14, gap: 5 }, emptyTitle: { fontWeight: '900' }, emptyBody: { lineHeight: 20, fontWeight: '600' }, expiryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, expiryButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }, expiryButtonText: { fontWeight: '900' }, previewCard: { borderRadius: 26, borderWidth: 1, padding: 18, gap: 14 }, previewHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, previewHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9 }, previewStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9 }, previewBlock: { gap: 5 }, previewEyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' }, previewTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }, previewMeta: { fontWeight: '800', lineHeight: 20 }, swapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, swapLine: { flex: 1, height: 1 }, swapCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, swapIcon: { fontSize: 18, fontWeight: '900' }, actions: { gap: 10 }, primaryButton: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' }, primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, secondaryButton: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' }, secondaryButtonText: { fontWeight: '900' }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78 } });
