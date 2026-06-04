import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CASH_PROMISE_ACKNOWLEDGEMENT_TEXT, type CashPromiseInput, type TradePostType, type TradeStatus } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserIdentityPressable } from '../users/UserIdentityPressable';
import type { NeedItem, OfferItem, TradeDeckItem, TradeProposalItem } from './types';
import type { TradeCreateSideSelection } from './CreateTradeScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'TradePrivateProposals'>;
type TradeResponse = { trade: TradeDeckItem };
type ProposalsResponse = { proposals: TradeProposalItem[] };
type ProposalResponse = { proposal: TradeProposalItem; trade?: TradeDeckItem };
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type DetailRole = 'owner' | 'provider' | 'applicant' | 'viewer';
type RequiredProposalSide = 'need' | 'offer' | null;
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

const tradeStatuses: TradeStatus[] = ['draft', 'active', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'expired', 'closed', 'cancelled'];
function normalizeStatus(status?: string): TradeStatus { return tradeStatuses.includes(status as TradeStatus) ? status as TradeStatus : 'active'; }
function fallback(params: RootStackParamList['TradePrivateProposals']): TradeDeckItem { return { id: params.tradeId, ownerId: 'unknown', providerId: null, title: params.title ?? 'Trade', description: '', creditAmount: 0, amountCents: 0, currency: 'eur', status: normalizeStatus(params.status), isPublic: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), expiresAt: null, closedAt: null, postType: 'need_offer' }; }
function compactList(values: Array<string | null | undefined>) { return values.map((value) => value?.trim()).filter(Boolean).join(' · '); }
function modeLabel(mode: string | null | undefined, t: TFunction) { if (mode === 'remote') return t('trade.modes.remote'); if (mode === 'local') return t('trade.modes.local'); if (mode === 'hybrid') return t('trade.modes.hybrid'); return null; }
function tradePostType(trade: TradeDeckItem): TradePostType { return trade.postType ?? 'need_offer'; }
function requiredProposalSide(trade: TradeDeckItem): RequiredProposalSide { const postType = tradePostType(trade); if (postType === 'open_need' && !trade.offerId) return 'offer'; if (postType === 'open_offer' && !trade.needId) return 'need'; return null; }
function proposalActionTitle(trade: TradeDeckItem, t: TFunction) { const side = requiredProposalSide(trade); if (side === 'offer') return t('trade.proposals.proposeOffer'); if (side === 'need') return t('trade.proposals.proposeNeed'); return t('trade.proposals.askToTrade'); }
function proposalHelper(trade: TradeDeckItem, t: TFunction) { const side = requiredProposalSide(trade); if (side === 'offer') return t('trade.proposals.helperNativeOffer'); if (side === 'need') return t('trade.proposals.helperNativeNeed'); return t('trade.proposals.helperNativeTrade'); }
function detailTitle(trade: TradeDeckItem, t: TFunction) { const need = trade.need?.title || trade.title || t('trade.labels.needDetails'); const offer = trade.offer?.title || t('trade.labels.offerDetails'); if (trade.postType === 'open_need') return need; if (trade.postType === 'open_offer') return offer; return compactList([need, offer]).replace(' · ', ' ↔ '); }
function needMeta(need: NeedItem | null | undefined, t: TFunction) { return compactList([need?.category, need?.timing, modeLabel(need?.mode, t), need?.locationLabel]) || t('trade.detail.needDetailsFallback'); }
function offerMeta(offer: OfferItem | null | undefined, t: TFunction) { return compactList([offer?.includes?.[0], offer?.availability, modeLabel(offer?.mode, t), offer?.locationLabel]) || t('trade.detail.offerDetailsFallback'); }
function proposalInventoryMeta(kind: 'need' | 'offer', item: NeedItem | OfferItem, t: TFunction) { return kind === 'need' ? needMeta(item as NeedItem, t) : offerMeta(item as OfferItem, t); }
function proposalInventoryDescription(item: NeedItem | OfferItem, t: TFunction) { return item.description?.trim() || t('trade.labels.noDescription'); }
function isNeedAvailable(need: NeedItem) { return need.status === 'active'; }
function isOfferAvailable(offer: OfferItem) { return offer.status === 'active'; }
function upsertProposal(proposals: TradeProposalItem[], next: TradeProposalItem) { return proposals.some((proposal) => proposal.id === next.id) ? proposals.map((proposal) => proposal.id === next.id ? { ...proposal, ...next } : proposal) : [next, ...proposals]; }
function formatStatus(status: string, t: TFunction) { const label = t(`trade.statuses.${status}`); return label === `trade.statuses.${status}` ? status.replace(/_/g, ' ') : label; }
function formatMoney(amountCents: number, currency = 'eur') { return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`; }

export function TradePrivateProposalsScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [trade, setTrade] = useState<TradeDeckItem>(() => fallback(route.params));
  const [proposals, setProposals] = useState<TradeProposalItem[]>([]);
  const [proposalDraft, setProposalDraft] = useState('');
  const [proposalNeeds, setProposalNeeds] = useState<NeedItem[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferItem[]>([]);
  const [selectedProposalNeedId, setSelectedProposalNeedId] = useState(route.params.selectedProposalNeedId ?? '');
  const [selectedProposalOfferId, setSelectedProposalOfferId] = useState(route.params.selectedProposalOfferId ?? '');
  const [selectedCashPromise, setSelectedCashPromise] = useState<TradeCreateSideSelection | null>(route.params.selectedProposalSide?.kind === 'cash_promise' ? route.params.selectedProposalSide : null);
  const [packagePrototypeEnabled, setPackagePrototypeEnabled] = useState(false);
  const [supportingProposalNeedIds, setSupportingProposalNeedIds] = useState<string[]>([]);
  const [supportingProposalOfferIds, setSupportingProposalOfferIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sideLoading, setSideLoading] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let appliedBundledSelection = false;
    if (typeof route.params.selectedProposalNeedId === 'string') {
      setSelectedProposalNeedId(route.params.selectedProposalNeedId);
      appliedBundledSelection = true;
    }
    if (typeof route.params.selectedProposalOfferId === 'string') {
      setSelectedProposalOfferId(route.params.selectedProposalOfferId);
      appliedBundledSelection = true;
    }
    if (appliedBundledSelection) return;
    const selection = route.params.selectedProposalSide;
    if (!selection || selection.kind === 'money') return;
    if (selection.kind === 'cash_promise') {
      setSelectedCashPromise(selection);
      if (selection.side === 'need') setSelectedProposalNeedId('');
      if (selection.side === 'offer') setSelectedProposalOfferId('');
      return;
    }
    if (selection.kind === 'need') { setSelectedProposalNeedId(selection.id); setSelectedCashPromise((current) => current?.side === 'need' ? null : current); }
    if (selection.kind === 'offer') { setSelectedProposalOfferId(selection.id); setSelectedCashPromise((current) => current?.side === 'offer' ? null : current); }
  }, [route.params.selectedProposalNeedId, route.params.selectedProposalOfferId, route.params.selectedProposalSide]);

  const loadTrade = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.get(route.params.tradeId) as TradeResponse;
      setTrade(result.trade);
      const proposalResult = await api.trades.proposals(route.params.tradeId) as ProposalsResponse;
      setProposals(Array.isArray(proposalResult.proposals) ? proposalResult.proposals : []);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [route.params.tradeId]);

  useFocusEffect(useCallback(() => { void loadTrade(); }, [loadTrade]));

  const role = useMemo<DetailRole>(() => {
    if (trade.ownerId === auth.user?.id) return 'owner';
    if (trade.providerId && trade.providerId === auth.user?.id) return 'provider';
    if (proposals.some((proposal) => proposal.applicantId === auth.user?.id && proposal.status === 'accepted')) return 'provider';
    if (proposals.some((proposal) => proposal.applicantId === auth.user?.id)) return 'applicant';
    return 'viewer';
  }, [auth.user?.id, proposals, trade.ownerId, trade.providerId]);

  const myProposal = useMemo(() => proposals.find((proposal) => proposal.applicantId === auth.user?.id) ?? null, [auth.user?.id, proposals]);
  const requiredSide = requiredProposalSide(trade);
  const activeProposalNeeds = useMemo(() => proposalNeeds.filter(isNeedAvailable), [proposalNeeds]);
  const activeProposalOffers = useMemo(() => proposalOffers.filter(isOfferAvailable), [proposalOffers]);
  const selectedProposalNeed = useMemo(() => activeProposalNeeds.find((need) => need.id === selectedProposalNeedId) ?? null, [activeProposalNeeds, selectedProposalNeedId]);
  const selectedProposalOffer = useMemo(() => activeProposalOffers.find((offer) => offer.id === selectedProposalOfferId) ?? null, [activeProposalOffers, selectedProposalOfferId]);

  useEffect(() => {
    if (!auth.isAuthenticated || role === 'owner' || myProposal || trade.status !== 'active') return;
    let mounted = true;
    async function loadProposalInventory() {
      setSideLoading(true);
      try {
        const [needsResult, offersResult] = await Promise.all([api.needs.mine() as Promise<NeedsResponse>, api.offers.mine() as Promise<OffersResponse>]);
        const needs = Array.isArray(needsResult.needs) ? needsResult.needs : [];
        const offers = Array.isArray(offersResult.offers) ? offersResult.offers : [];
        if (!mounted) return;
        setProposalNeeds(needs);
        setProposalOffers(offers);
        setSelectedProposalNeedId((current) => current && needs.some((need) => need.id === current && isNeedAvailable(need)) ? current : '');
        setSelectedProposalOfferId((current) => current && offers.some((offer) => offer.id === current && isOfferAvailable(offer)) ? current : '');
        setSupportingProposalNeedIds((current) => current.filter((id) => needs.some((need) => need.id === id && isNeedAvailable(need))).slice(0, betaFeatures.proTradePackageFeatures.maxSupportingNeeds));
        setSupportingProposalOfferIds((current) => current.filter((id) => offers.some((offer) => offer.id === id && isOfferAvailable(offer))).slice(0, betaFeatures.proTradePackageFeatures.maxSupportingOffers));
      } catch (caughtError) {
        if (mounted) setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotLoadInventory')));
      } finally {
        if (mounted) setSideLoading(false);
      }
    }
    void loadProposalInventory();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, myProposal, role, t, trade.status]);

  async function createProposal() {
    const trimmed = proposalDraft.trim();
    if (trimmed.length < 3) return;
    const packagePrototypeActive = packagePrototypeEnabled && betaFeatures.proTradePackageFeatures.visible && ['need', 'offer'].includes(requiredSide ?? '');
    if (packagePrototypeActive && requiredSide === 'offer' && supportingProposalOfferIds.length === 0) { setError('Choose at least one supporting Offer for the Pro package.'); return; }
    if (packagePrototypeActive && requiredSide === 'need' && supportingProposalNeedIds.length === 0) { setError('Choose at least one supporting Need for the Pro package.'); return; }
    const cashPromiseSide = selectedCashPromise?.kind === 'cash_promise' ? selectedCashPromise.side : null;
    if (!packagePrototypeActive && requiredSide === 'offer' && !selectedProposalOffer && cashPromiseSide !== 'offer') { setError(t('trade.proposals.chooseOfferFirst')); return; }
    if (!packagePrototypeActive && requiredSide === 'need' && !selectedProposalNeed && cashPromiseSide !== 'need') { setError(t('trade.proposals.chooseNeedFirst')); return; }
    setCreatingProposal(true);
    setError(null);
    setMessage(null);
    try {
      const packagePayload = packagePrototypeActive && requiredSide === 'offer'
        ? {
          packageKind: 'main_need_multi_offer' as const,
          supportingOfferIds: supportingProposalOfferIds.slice(0, betaFeatures.proTradePackageFeatures.maxSupportingOffers),
          proposedOfferId: supportingProposalOfferIds[0],
        }
        : packagePrototypeActive && requiredSide === 'need'
          ? {
            packageKind: 'main_offer_multi_need' as const,
            supportingNeedIds: supportingProposalNeedIds.slice(0, betaFeatures.proTradePackageFeatures.maxSupportingNeeds),
            proposedNeedId: supportingProposalNeedIds[0],
          }
          : null;
      const cashPromise = selectedCashPromise?.kind === 'cash_promise' ? { side: selectedCashPromise.side, amountCents: selectedCashPromise.amountCents, currency: selectedCashPromise.currency, note: selectedCashPromise.note ?? undefined, acknowledgementAccepted: true as const, acknowledgementText: selectedCashPromise.acknowledgementText ?? CASH_PROMISE_ACKNOWLEDGEMENT_TEXT } satisfies CashPromiseInput : undefined;
      const result = await api.trades.createProposal(trade.id, {
        message: trimmed,
        ...(packagePayload ?? {
          ...(selectedProposalOffer && selectedCashPromise?.side !== 'offer' ? { proposedOfferId: selectedProposalOffer.id } : {}),
          ...(selectedProposalNeed && selectedCashPromise?.side !== 'need' ? { proposedNeedId: selectedProposalNeed.id } : {}),
          ...(cashPromise ? { cashPromise } : {}),
        }),
      }) as ProposalResponse;
      setProposals((current) => upsertProposal(current, result.proposal));
      setProposalDraft('');
      setPackagePrototypeEnabled(false);
      setSupportingProposalNeedIds([]);
      setSupportingProposalOfferIds([]);
      setSelectedCashPromise(null);
      setMessage(t('trade.proposals.proposalSentNative'));
      navigation.navigate('ProposalDetail', { proposalId: result.proposal.id });
    } catch (caughtError) {
      const body = caughtError && typeof caughtError === 'object' && 'body' in caughtError ? (caughtError as { body?: { proposal?: TradeProposalItem } }).body : undefined;
      if (body?.proposal?.id) {
        navigation.navigate('ProposalDetail', { proposalId: body.proposal.id });
        return;
      }
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotSendProposal')));
    } finally {
      setCreatingProposal(false);
    }
  }

  const openPicker = useCallback((side: 'need' | 'offer') => {
    const selected = side === 'need' ? selectedProposalNeed : selectedProposalOffer;
    const selection = selectedCashPromise?.side === side
      ? selectedCashPromise
      : selected
        ? side === 'need'
          ? { side: 'need' as const, kind: 'need' as const, id: selected.id }
          : { side: 'offer' as const, kind: 'offer' as const, id: selected.id }
        : null;

    navigation.navigate('TradeSidePicker', {
      side,
      selection,
      returnTo: 'tradeProposal',
      tradeId: trade.id,
      tradeTitle: detailTitle(trade, t),
      proposalNeedId: selectedProposalNeedId,
      proposalOfferId: selectedProposalOfferId,
    });
  }, [navigation, selectedCashPromise, selectedProposalNeed, selectedProposalNeedId, selectedProposalOffer, selectedProposalOfferId, t, trade]);

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('trade.threadSplit.privateTitle')} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadTrade(); }} />}>
        <View style={[styles.introCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <SemanticBadge label={t('trade.threadSplit.privateTitle')} tone="proposal" size="sm" />
          <AppText style={styles.introTitle}>{detailTitle(trade, t)}</AppText>
          <AppText style={[styles.introBody, { color: theme.color.muted }]}>{role === 'owner' ? t('trade.threadSplit.privateOwnerBody') : t('trade.threadSplit.privateApplicantBody')}</AppText>
        </View>
        {error ? <InfoNotice tone="danger" title={t('trade.detail.tradeError')} body={error} /> : null}
        {message ? <InfoNotice tone="success" title={t('trade.detail.updated')} body={message} /> : null}
        {role === 'owner' ? <OwnerProposalList proposals={proposals} currentUserId={auth.user?.id} loading={loading} theme={theme} t={t} onOpen={(proposalId) => navigation.navigate('ProposalDetail', { proposalId })} /> : null}
        {role !== 'owner' && myProposal ? <ApplicantProposalCard proposal={myProposal} currentUserId={auth.user?.id} theme={theme} t={t} onOpen={() => navigation.navigate('ProposalDetail', { proposalId: myProposal.id })} /> : null}
        {role !== 'owner' && !myProposal && trade.status === 'active' ? (
          <ProposalComposer
            trade={trade}
            requiredSide={requiredSide}
            value={proposalDraft}
            onChange={setProposalDraft}
            onSubmit={() => { void createProposal(); }}
            loading={creatingProposal}
            sideLoading={sideLoading}
            needs={activeProposalNeeds}
            offers={activeProposalOffers}
            selectedNeed={selectedProposalNeed}
            selectedOffer={selectedProposalOffer}
            selectedCashPromise={selectedCashPromise?.kind === 'cash_promise' ? selectedCashPromise : null}
            packagePrototypeEnabled={packagePrototypeEnabled}
            supportingNeedIds={supportingProposalNeedIds}
            supportingOfferIds={supportingProposalOfferIds}
            onPackagePrototypeEnabledChange={setPackagePrototypeEnabled}
            onSupportingNeedIdsChange={setSupportingProposalNeedIds}
            onSupportingOfferIdsChange={setSupportingProposalOfferIds}
            onChooseNeed={() => openPicker('need')}
            onChooseOffer={() => openPicker('offer')}
            theme={theme}
            t={t}
          />
        ) : null}
        {role !== 'owner' && !myProposal && trade.status !== 'active' ? <InfoNotice tone="info" title={t('trade.proposals.notAccepting')} body={t('trade.proposals.closedActionsBody')} /> : null}
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function OwnerProposalList({ proposals, currentUserId, loading, theme, t, onOpen }: { proposals: TradeProposalItem[]; currentUserId?: string; loading: boolean; theme: ThemeTokens; t: TFunction; onOpen: (proposalId: string) => void }) {
  if (proposals.length === 0 && !loading) return <InfoNotice tone="info" title={t('trade.proposals.noProposals')} body={t('trade.proposals.noProposalsOwner')} />;
  return <View style={styles.stack}>{proposals.map((proposal) => <ProposalListCard key={proposal.id} proposal={proposal} currentUserId={currentUserId} theme={theme} t={t} onOpen={() => onOpen(proposal.id)} />)}</View>;
}

function ApplicantProposalCard({ proposal, currentUserId, theme, t, onOpen }: { proposal: TradeProposalItem; currentUserId?: string; theme: ThemeTokens; t: TFunction; onOpen: () => void }) {
  return <View style={styles.stack}><InfoNotice tone="info" title={t('trade.proposals.yourProposal')} body={t('trade.threadSplit.privateApplicantBody')} /><ProposalListCard proposal={proposal} currentUserId={currentUserId} theme={theme} t={t} onOpen={onOpen} /></View>;
}

function ProposalListCard({ proposal, currentUserId, theme, t, onOpen }: { proposal: TradeProposalItem; currentUserId?: string; theme: ThemeTokens; t: TFunction; onOpen: () => void }) {
  const isApplicant = proposal.applicantId === currentUserId;
  const lastMessage = proposal.messages?.[proposal.messages.length - 1]?.body || proposal.message;
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.proposalCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.proposalHeader}>
        <UserIdentityPressable user={proposal.applicant} userId={proposal.applicantId} displayName={isApplicant ? t('trade.labels.you') : undefined} variant="row" subtitle={t('trade.labels.applicant')} style={styles.proposalIdentity} />
        <StatusBadge status={proposal.status} label={formatStatus(proposal.status, t)} size="sm" />
      </View>
      <ProposalSideSummary proposal={proposal} theme={theme} t={t} />
      <AppText style={[styles.proposalPreview, { color: theme.color.muted }]} numberOfLines={2}>{lastMessage}</AppText>
      <View style={styles.openRow}><AppText style={[styles.openText, { color: theme.semantic.proposal.bg }]}>{t('trade.proposals.openPrivateThread')}</AppText><MobileIcon name="chevron-right" size={18} color={theme.semantic.proposal.bg} /></View>
    </Pressable>
  );
}

function ProposalSideSummary({ proposal, theme, t }: { proposal: TradeProposalItem; theme: ThemeTokens; t: TFunction }) {
  const entries = [proposal.proposedOffer ? { kind: 'offer' as const, item: proposal.proposedOffer as OfferItem, label: t('trade.labels.proposedOffer') } : null, proposal.proposedNeed ? { kind: 'need' as const, item: proposal.proposedNeed as NeedItem, label: t('trade.labels.proposedNeed') } : null].filter(Boolean) as Array<{ kind: 'need' | 'offer'; item: NeedItem | OfferItem; label: string }>;
  if (entries.length === 0 && !proposal.cashPromise) return null;
  return <View style={styles.sideSummaryStack}>
    {entries.map((entry) => <InventoryPreviewCard key={`${entry.kind}-${entry.item.id}`} item={entry.item} kind={entry.kind} label={entry.label} theme={theme} t={t} compact />)}
    {proposal.cashPromise ? <CashPromiseProposalSummary amountCents={proposal.cashPromise.amountCents} currency={proposal.cashPromise.currency ?? 'eur'} side={proposal.cashPromise.side} note={proposal.cashPromise.note ?? null} theme={theme} t={t} /> : null}
  </View>;
}

function CashPromiseProposalSummary({ amountCents, currency, side, note, theme, t }: { amountCents: number; currency: string; side: 'need' | 'offer'; note?: string | null; theme: ThemeTokens; t: TFunction }) {
  return <View style={[styles.cashPromiseSummary, { backgroundColor: theme.semantic.warning.softBg, borderColor: theme.semantic.warning.border }]}>
    <SemanticBadge label={side === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')} tone="warning" size="sm" />
    <AppText style={[styles.cashPromiseSummaryTitle, { color: theme.semantic.warning.text }]}>{t('trade.cashPromise.title')} · {formatMoney(amountCents, currency)}</AppText>
    <AppText style={[styles.cashPromiseSummaryBody, { color: theme.semantic.warning.text }]}>{t('trade.cashPromise.notProcessed')}</AppText>
    {note ? <AppText style={[styles.cashPromiseSummaryBody, { color: theme.semantic.warning.text }]}>{note}</AppText> : null}
  </View>;
}

function ProposalComposer({ trade, requiredSide, value, onChange, onSubmit, loading, sideLoading, needs, offers, selectedNeed, selectedOffer, selectedCashPromise, packagePrototypeEnabled, supportingNeedIds, supportingOfferIds, onPackagePrototypeEnabledChange, onSupportingNeedIdsChange, onSupportingOfferIdsChange, onChooseNeed, onChooseOffer, theme, t }: { trade: TradeDeckItem; requiredSide: RequiredProposalSide; value: string; onChange: (value: string) => void; onSubmit: () => void; loading: boolean; sideLoading: boolean; needs: NeedItem[]; offers: OfferItem[]; selectedNeed: NeedItem | null; selectedOffer: OfferItem | null; selectedCashPromise: Extract<TradeCreateSideSelection, { kind: 'cash_promise' }> | null; packagePrototypeEnabled: boolean; supportingNeedIds: string[]; supportingOfferIds: string[]; onPackagePrototypeEnabledChange: (enabled: boolean) => void; onSupportingNeedIdsChange: (ids: string[]) => void; onSupportingOfferIdsChange: (ids: string[]) => void; onChooseNeed: () => void; onChooseOffer: () => void; theme: ThemeTokens; t: TFunction }) {
  const cashPromiseSide = selectedCashPromise?.side ?? null;
  const cashPromiseSatisfiesRequired = Boolean(requiredSide && cashPromiseSide === requiredSide);
  const missingInventory = !cashPromiseSatisfiesRequired && ((requiredSide === 'offer' && offers.length === 0) || (requiredSide === 'need' && needs.length === 0));
  const packagePrototypeVisible = betaFeatures.proTradePackageFeatures.visible && ['need', 'offer'].includes(requiredSide ?? '');
  const packagePrototypeActive = packagePrototypeEnabled && packagePrototypeVisible;
  const packageMissingSelection = packagePrototypeActive && ((requiredSide === 'offer' && supportingOfferIds.length === 0) || (requiredSide === 'need' && supportingNeedIds.length === 0));
  const standardMissingSelection = !packagePrototypeActive && ((requiredSide === 'offer' && !selectedOffer && cashPromiseSide !== 'offer') || (requiredSide === 'need' && !selectedNeed && cashPromiseSide !== 'need'));
  const disabled = loading || value.trim().length < 3 || packageMissingSelection || standardMissingSelection || missingInventory;
  const placeholder = requiredSide === 'offer' ? t('trade.proposals.placeholderOffer') : requiredSide === 'need' ? t('trade.proposals.placeholderNeed') : t('trade.proposals.placeholderTrade');
  const submitLabel = loading ? t('trade.proposals.sending') : requiredSide === 'offer' ? t('trade.proposals.sendOfferProposal') : requiredSide === 'need' ? t('trade.proposals.sendNeedProposal') : proposalActionTitle(trade, t);
  return (
    <View style={styles.stack}>
      <InfoNotice tone="instruction" title={proposalActionTitle(trade, t)} body={proposalHelper(trade, t)} />
      {sideLoading ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.loadingInventory')}</AppText> : null}
      {requiredSide === 'need' ? (
        <>
          <InventoryPickerShortcut kind="need" title={t('trade.proposals.chooseNeedToPropose')} count={needs.length} item={cashPromiseSide === 'need' ? { id: 'cash-promise', title: t('trade.cashPromise.title'), description: `${formatMoney(selectedCashPromise?.amountCents ?? 0, selectedCashPromise?.currency ?? 'eur')} · ${t('trade.cashPromise.notProcessed')}`, status: 'active' } as NeedItem : selectedNeed} emptyText={t('trade.proposals.createNeedFirst')} onChoose={onChooseNeed} theme={theme} t={t} />
          <InventoryPickerShortcut kind="offer" title={t('trade.proposals.attachOfferToProposal')} count={offers.length} item={cashPromiseSide === 'offer' ? { id: 'cash-promise', title: t('trade.cashPromise.title'), description: `${formatMoney(selectedCashPromise?.amountCents ?? 0, selectedCashPromise?.currency ?? 'eur')} · ${t('trade.cashPromise.notProcessed')}`, status: 'active' } as OfferItem : selectedOffer} emptyText={t('trade.proposals.createOfferOptional')} onChoose={onChooseOffer} theme={theme} t={t} />
        </>
      ) : (
        <>
          <InventoryPickerShortcut kind="offer" title={requiredSide === 'offer' ? t('trade.proposals.chooseOfferToPropose') : t('trade.proposals.attachOfferToProposal')} count={offers.length} item={cashPromiseSide === 'offer' ? { id: 'cash-promise', title: t('trade.cashPromise.title'), description: `${formatMoney(selectedCashPromise?.amountCents ?? 0, selectedCashPromise?.currency ?? 'eur')} · ${t('trade.cashPromise.notProcessed')}`, status: 'active' } as OfferItem : selectedOffer} emptyText={requiredSide === 'offer' ? t('trade.proposals.createOfferFirst') : t('trade.proposals.createOfferOptional')} onChoose={onChooseOffer} theme={theme} t={t} />
          <InventoryPickerShortcut kind="need" title={t('trade.proposals.attachNeedToProposal')} count={needs.length} item={cashPromiseSide === 'need' ? { id: 'cash-promise', title: t('trade.cashPromise.title'), description: `${formatMoney(selectedCashPromise?.amountCents ?? 0, selectedCashPromise?.currency ?? 'eur')} · ${t('trade.cashPromise.notProcessed')}`, status: 'active' } as NeedItem : selectedNeed} emptyText={t('trade.proposals.createNeedOptional')} onChoose={onChooseNeed} theme={theme} t={t} />
        </>
      )}
      <NativeProTradePackagePrototype
        requiredSide={requiredSide}
        enabled={packagePrototypeEnabled}
        needs={needs}
        offers={offers}
        supportingNeedIds={supportingNeedIds}
        supportingOfferIds={supportingOfferIds}
        onToggleEnabled={onPackagePrototypeEnabledChange}
        onSupportingNeedIdsChange={onSupportingNeedIdsChange}
        onSupportingOfferIdsChange={onSupportingOfferIdsChange}
        theme={theme}
      />
      <View style={styles.messageComposerBlock}>
        <AppText style={styles.threadLabel}>{t('trade.labels.message')}</AppText>
        <TextInput value={value} onChangeText={onChange} multiline textAlignVertical="top" placeholder={placeholder} placeholderTextColor={theme.color.muted} style={[styles.textArea, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
      </View>
      {missingInventory ? <InfoNotice tone="warning" title={t('trade.proposals.savedInventoryNeeded')} body={requiredSide === 'offer' ? t('trade.proposals.addOfferBeforeProposing') : t('trade.proposals.addNeedBeforeProposing')} /> : null}
      <ActionButton label={submitLabel} variant="primary" disabled={disabled} onPress={onSubmit} theme={theme} />
    </View>
  );
}


function togglePackageId(current: string[], id: string, max: number) {
  if (current.includes(id)) return current.filter((itemId) => itemId !== id);
  return [...current, id].slice(0, max);
}

function NativeProTradePackagePrototype({ requiredSide, enabled, needs, offers, supportingNeedIds, supportingOfferIds, onToggleEnabled, onSupportingNeedIdsChange, onSupportingOfferIdsChange, theme }: { requiredSide: RequiredProposalSide; enabled: boolean; needs: NeedItem[]; offers: OfferItem[]; supportingNeedIds: string[]; supportingOfferIds: string[]; onToggleEnabled: (enabled: boolean) => void; onSupportingNeedIdsChange: (ids: string[]) => void; onSupportingOfferIdsChange: (ids: string[]) => void; theme: ThemeTokens }) {
  const flags = betaFeatures.proTradePackageFeatures;
  if (!flags.visible || !['need', 'offer'].includes(requiredSide ?? '')) return null;
  const isOfferPackage = requiredSide === 'offer';
  const items = isOfferPackage ? offers : needs;
  const selectedIds = isOfferPackage ? supportingOfferIds : supportingNeedIds;
  const maxItems = isOfferPackage ? flags.maxSupportingOffers : flags.maxSupportingNeeds;
  return (
    <View style={[styles.proPackageBox, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }]}>
      <View style={styles.proPackageHeader}>
        <View style={styles.proPackageHeaderCopy}>
          <SemanticBadge label="Hidden Pro prototype" tone="proposal" size="sm" />
          <AppText style={styles.threadLabel}>{isOfferPackage ? 'Offer multiple Offers as a package' : 'Request multiple Needs as a package'}</AppText>
        </View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} onPress={() => onToggleEnabled(!enabled)} style={({ pressed }) => [styles.proPackageToggle, { borderColor: theme.semantic.proposal.border, backgroundColor: enabled ? theme.semantic.proposal.bg : theme.color.surface }, pressed && styles.pressed]}>
          <AppText style={[styles.proPackageToggleText, { color: enabled ? '#FFFFFF' : theme.semantic.proposal.text }]}>{enabled ? 'On' : 'Off'}</AppText>
        </Pressable>
      </View>
      <AppText style={[styles.muted, { color: theme.semantic.proposal.text }]}>Requires verified Pro access. Packages are accepted or declined as one unit.</AppText>
      {enabled ? (
        <View style={styles.proPackageItems}>
          <View style={styles.proPackageLimitRow}>
            <AppText style={styles.threadLabel}>{isOfferPackage ? 'Supporting Offers' : 'Supporting Needs'}</AppText>
            <AppText style={[styles.muted, { color: theme.color.muted }]}>{selectedIds.length}/{maxItems}</AppText>
          </View>
          {items.length ? items.map((item) => {
            const selected = selectedIds.includes(item.id);
            const disabled = !selected && selectedIds.length >= maxItems;
            return (
              <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => {
                const nextIds = togglePackageId(selectedIds, item.id, maxItems);
                if (isOfferPackage) onSupportingOfferIdsChange(nextIds);
                else onSupportingNeedIdsChange(nextIds);
              }} style={({ pressed }) => [styles.proPackageItem, { borderColor: selected ? theme.semantic.proposal.border : theme.color.border, backgroundColor: selected ? theme.color.surface : theme.color.subtleSurface, opacity: disabled ? 0.55 : 1 }, pressed && styles.pressed]}>
                <View style={styles.proPackageItemCopy}>
                  <AppText style={styles.inventoryChoiceTitle} numberOfLines={2}>{item.title}</AppText>
                  <AppText style={[styles.inventoryChoiceMeta, { color: theme.color.muted }]} numberOfLines={1}>{proposalInventoryMeta(isOfferPackage ? 'offer' : 'need', item, () => '')}</AppText>
                </View>
                {selected ? <MobileIcon name="proposal-accepted" size={18} color={theme.semantic.proposal.text} /> : null}
              </Pressable>
            );
          }) : <AppText style={[styles.muted, { color: theme.color.muted }]}>Create active saved {isOfferPackage ? 'Offers' : 'Needs'} before testing a package.</AppText>}
        </View>
      ) : null}
    </View>
  );
}

function InventoryPickerShortcut({ kind, title, count, item, emptyText, onChoose, theme, t }: { kind: 'need' | 'offer'; title: string; count: number; item: NeedItem | OfferItem | null; emptyText: string; onChoose: () => void; theme: ThemeTokens; t: TFunction }) {
  return (
    <Pressable accessibilityRole="button" onPress={onChoose} style={({ pressed }) => [styles.inventoryPickerShortcut, { backgroundColor: theme.color.subtleSurface, borderColor: item ? theme.semantic[kind].border : theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.inventoryPickerTopRow}>
        <View style={styles.inventoryPickerHeading}>
          <SemanticBadge label={kind === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer')} tone={kind} size="sm" />
          <AppText style={styles.threadLabel}>{title}</AppText>
        </View>
        <View style={[styles.inventoryPickerIcon, { backgroundColor: theme.semantic[kind].softBg }]}><MobileIcon name={kind} size={18} color={theme.semantic[kind].text} /></View>
      </View>
      {item ? <InventoryPreviewCard item={item} kind={kind} label={t('trade.labels.selected')} theme={theme} t={t} /> : <View style={styles.inventoryPickerEmptyBody}><AppText style={[styles.muted, { color: theme.color.muted }]}>{count > 0 ? t('trade.proposals.chooseFromSavedItems', { count }) : emptyText}</AppText><AppText style={[styles.inventoryPickerActionText, { color: theme.semantic.proposal.bg }]}>{t('trade.proposals.openPicker')}</AppText></View>}
    </Pressable>
  );
}

function InventoryPreviewCard({ item, kind, label, theme, t, compact }: { item: NeedItem | OfferItem; kind: 'need' | 'offer'; label: string; theme: ThemeTokens; t: TFunction; compact?: boolean }) {
  return (
    <View style={[styles.selectedSidePreview, { backgroundColor: theme.semantic[kind].softBg, borderColor: theme.semantic[kind].border }, compact && styles.selectedSidePreviewCompact]}>
      <View style={styles.selectedSideHeader}><SemanticBadge label={label} tone={kind} size="sm" /><MobileIcon name={kind} size={18} color={theme.semantic[kind].text} /></View>
      <AppText style={styles.selectedSideTitle} numberOfLines={2}>{item.title}</AppText>
      <AppText style={[styles.selectedSideMeta, { color: theme.semantic[kind].text }]} numberOfLines={1}>{proposalInventoryMeta(kind, item, t)}</AppText>
      {!compact ? <AppText style={[styles.selectedSideDescription, { color: theme.semantic[kind].text }]} numberOfLines={2}>{proposalInventoryDescription(item, t)}</AppText> : null}
    </View>
  );
}

function ActionButton({ label, variant, disabled, onPress, theme }: { label: string; variant: 'primary' | 'danger' | 'ghost'; disabled?: boolean; onPress: () => void; theme: ThemeTokens }) {
  const buttonStyle = variant === 'primary' ? { backgroundColor: theme.semantic.proposal.bg, borderColor: theme.semantic.proposal.bg } : variant === 'danger' ? { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border } : { backgroundColor: theme.color.surface, borderColor: theme.color.border };
  const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? theme.semantic.danger.text : theme.color.text;
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, buttonStyle, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionButtonText, { color: textColor }]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 56, gap: 14 },
  introCard: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 8 },
  introTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.45 },
  introBody: { lineHeight: 20, fontWeight: '700' },
  stack: { gap: 14 },
  proposalCard: { borderRadius: 24, borderWidth: 1, padding: 15, gap: 12 },
  proposalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  proposalIdentity: { flex: 1 },
  sideSummaryStack: { gap: 8 },
  proposalPreview: { lineHeight: 20, fontWeight: '700' },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  openText: { fontWeight: '900' },
  messageComposerBlock: { gap: 8 },
  threadLabel: { fontSize: 13, fontWeight: '900' },
  textArea: { minHeight: 126, borderRadius: 20, borderWidth: 1, padding: 14, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  proPackageBox: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 10 },
  proPackageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  proPackageHeaderCopy: { flex: 1, gap: 7 },
  proPackageToggle: { minWidth: 54, minHeight: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  proPackageToggleText: { fontSize: 12, fontWeight: '900' },
  proPackageItems: { gap: 8 },
  proPackageLimitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  proPackageItem: { borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  proPackageItemCopy: { flex: 1, gap: 4 },
  inventoryChoiceTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  inventoryChoiceMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  inventoryPickerShortcut: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 12 },
  inventoryPickerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  inventoryPickerHeading: { flex: 1, gap: 7 },
  inventoryPickerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  inventoryPickerEmptyBody: { gap: 8 },
  inventoryPickerActionText: { fontWeight: '900' },
  selectedSidePreview: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 7 },
  selectedSidePreviewCompact: { padding: 12 },
  selectedSideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectedSideTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  selectedSideMeta: { fontSize: 12, lineHeight: 17, fontWeight: '900' },
  selectedSideDescription: { lineHeight: 20, fontWeight: '700' },
  cashPromiseSummary: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 5 },
  cashPromiseSummaryTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  cashPromiseSummaryBody: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  muted: { lineHeight: 20, fontWeight: '700' },
  actionButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  actionButtonText: { fontWeight: '900' },
  disabledButton: { opacity: 0.52 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
