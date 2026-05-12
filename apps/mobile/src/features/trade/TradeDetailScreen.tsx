import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MediaAssetDto, ProposalActionStatus, TradeActionStatus, TradePostType, TradeStatus } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { formatLocalizedDate, type SupportedLanguage } from '@hellowhen/i18n';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserIdentityPressable } from '../users/UserIdentityPressable';
import { resolveMediaUrl } from './mediaUrls';
import type { NeedItem, OfferItem, ProposalMessageItem, TradeDeckItem, TradeProposalItem } from './types';

 type Props = NativeStackScreenProps<RootStackParamList, 'TradeDetail'>;
type TradeResponse = { trade: TradeDeckItem };
type ProposalsResponse = { proposals: TradeProposalItem[] };
type ProposalResponse = { proposal: TradeProposalItem; trade?: TradeDeckItem };
type ProposalMessageResponse = { message?: ProposalMessageItem; proposal?: TradeProposalItem };
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type DetailRole = 'owner' | 'provider' | 'applicant' | 'viewer';
type RequiredProposalSide = 'need' | 'offer' | null;

const tradeStatuses: TradeStatus[] = ['draft', 'active', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'expired', 'closed', 'cancelled'];

function normalizeStatus(status?: string): TradeStatus { return tradeStatuses.includes(status as TradeStatus) ? status as TradeStatus : 'active'; }
function fallback(params: RootStackParamList['TradeDetail']): TradeDeckItem { return { id: params.tradeId, ownerId: 'unknown', providerId: null, title: params.title ?? 'Trade detail', description: params.description ?? '', creditAmount: params.creditAmount ?? 0, amountCents: params.amountCents ?? 0, currency: params.currency ?? 'eur', status: normalizeStatus(params.status), isPublic: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), expiresAt: params.expiresAt ?? null, closedAt: null, postType: 'need_offer' }; }
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
function modeLabel(mode: string | null | undefined, t: TFunction) { if (mode === 'remote') return t('trade.modes.remote'); if (mode === 'local') return t('trade.modes.local'); if (mode === 'hybrid') return t('trade.modes.hybrid'); return null; }
function compactList(values: Array<string | null | undefined>) { return values.map((value) => value?.trim()).filter(Boolean).join(' · '); }
function tradePostType(trade: TradeDeckItem): TradePostType { return trade.postType ?? 'need_offer'; }
function requiredProposalSide(trade: TradeDeckItem): RequiredProposalSide { const postType = tradePostType(trade); if (postType === 'open_need' && !trade.offerId) return 'offer'; if (postType === 'open_offer' && !trade.needId) return 'need'; return null; }
function postTypeLabel(trade: TradeDeckItem, t: TFunction) { const postType = tradePostType(trade); if (postType === 'open_need') return t('trade.postTypes.openNeed'); if (postType === 'open_offer') return t('trade.postTypes.openOffer'); return t('trade.postTypes.needOffer'); }
function proposalActionTitle(trade: TradeDeckItem, t: TFunction) { const side = requiredProposalSide(trade); if (side === 'offer') return t('trade.proposals.proposeOffer'); if (side === 'need') return t('trade.proposals.proposeNeed'); return t('trade.proposals.askToTrade'); }
function proposalHelper(trade: TradeDeckItem, t: TFunction) { const side = requiredProposalSide(trade); if (side === 'offer') return t('trade.proposals.helperNativeOffer'); if (side === 'need') return t('trade.proposals.helperNativeNeed'); return t('trade.proposals.helperNativeTrade'); }
function needTitle(trade: TradeDeckItem, t: TFunction) { return trade.need?.title || trade.title || t('trade.labels.needDetails'); }
function offerTitle(trade: TradeDeckItem, t: TFunction) { return trade.offer?.title || t('trade.labels.offerDetails'); }
function detailTitle(trade: TradeDeckItem, t: TFunction) { const postType = tradePostType(trade); if (postType === 'open_need') return needTitle(trade, t); if (postType === 'open_offer') return offerTitle(trade, t); return compactList([needTitle(trade, t), offerTitle(trade, t)]).replace(' · ', ' ↔ '); }
function needDescription(trade: TradeDeckItem) { return trade.need?.description ?? trade.description; }
function offerDescription(trade: TradeDeckItem) { return trade.offer?.description ?? ''; }
function needMeta(need: NeedItem | null | undefined, t: TFunction) { return compactList([need?.category, need?.timing, modeLabel(need?.mode, t), need?.locationLabel]) || t('trade.detail.needDetailsFallback'); }
function offerMeta(offer: OfferItem | null | undefined, t: TFunction) { return compactList([offer?.includes?.[0], offer?.availability, modeLabel(offer?.mode, t), offer?.locationLabel]) || t('trade.detail.offerDetailsFallback'); }
function exchangeLabel(trade: TradeDeckItem, t: TFunction) { const postType = tradePostType(trade); if (postType === 'open_need') return trade.offer ? t('trade.postTypes.openNeedMatched') : t('trade.postTypes.openForOffers'); if (postType === 'open_offer') return trade.need ? t('trade.postTypes.openOfferMatched') : t('trade.postTypes.openForNeeds'); return t('trade.postTypes.needOfferExchange'); }
function expiryLabel(expiresAt: string | null | undefined, t: TFunction) { if (!expiresAt) return t('trade.expiry.noExpirySet'); const ms = new Date(expiresAt).getTime(); if (!Number.isFinite(ms)) return t('trade.expiry.noExpirySet'); const diff = ms - Date.now(); if (diff <= 0) return t('trade.expiry.expired'); const hours = Math.ceil(diff / 1000 / 60 / 60); return hours < 24 ? t('trade.expiry.hoursLeft', { count: hours }) : t('trade.expiry.daysLeft', { count: Math.ceil(hours / 24) }); }
function formatDate(value: string | null | undefined, language: SupportedLanguage) { return formatLocalizedDate(value, language, ''); }
function formatStatus(status: string, t: TFunction) { const label = t(`trade.statuses.${status}`); return label === `trade.statuses.${status}` ? status.replace(/_/g, ' ') : label; }
function statusHint(trade: TradeDeckItem, role: DetailRole, t: TFunction) { if (trade.status === 'active') { const side = requiredProposalSide(trade); if (role === 'owner') return side === 'offer' ? t('trade.detail.activeOwnerOfferHint') : side === 'need' ? t('trade.detail.activeOwnerNeedHint') : t('trade.detail.activeOwnerTradeHint'); return side === 'offer' ? t('trade.detail.activeViewerOfferHint') : side === 'need' ? t('trade.detail.activeViewerNeedHint') : t('trade.detail.activeViewerTradeHint'); } if (trade.status === 'in_progress') return t('trade.detail.inProgressHint'); if (trade.status === 'submitted') return t('trade.detail.submittedHintNative'); if (trade.status === 'disputed') return t('trade.detail.disputedHintNative'); if (trade.status === 'completed') return t('trade.detail.completedHintNative'); if (trade.status === 'cancelled') return t('trade.detail.cancelledHintNative'); return t('trade.detail.reviewStatusHint'); }
function canMessageProposal(proposal: TradeProposalItem) { return !['declined', 'withdrawn'].includes(proposal.status); }
function canShowConversation(proposal: TradeProposalItem, role: DetailRole, userId?: string) { return role === 'owner' ? proposal.status === 'accepted' : proposal.applicantId === userId; }
function isOpeningProposalMessage(proposal: TradeProposalItem, message: ProposalMessageItem) { return message.senderId === proposal.applicantId && message.body.trim() === proposal.message.trim(); }
function visibleConversationMessages(proposal: TradeProposalItem) { const messages = proposal.messages ?? []; const openingIndex = messages.findIndex((message) => isOpeningProposalMessage(proposal, message)); return openingIndex >= 0 ? messages.filter((_, index) => index !== openingIndex) : messages; }
function upsertProposal(proposals: TradeProposalItem[], next: TradeProposalItem) { return proposals.some((proposal) => proposal.id === next.id) ? proposals.map((proposal) => proposal.id === next.id ? { ...proposal, ...next } : proposal) : [next, ...proposals]; }
function isNeedAvailable(need: NeedItem) { return !['fulfilled', 'closed', 'expired'].includes(need.status); }
function isOfferAvailable(offer: OfferItem) { return !['accepted', 'closed', 'expired'].includes(offer.status); }
function proposalInventoryMeta(kind: 'need' | 'offer', item: NeedItem | OfferItem, t: TFunction) { return kind === 'need' ? needMeta(item as NeedItem, t) : offerMeta(item as OfferItem, t); }
function proposalInventoryDescription(item: NeedItem | OfferItem, t: TFunction) { return item.description?.trim() || t('trade.labels.noDescription'); }

export function TradeDetailScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const params = route.params;
  const [trade, setTrade] = useState<TradeDeckItem>(() => fallback(params));
  const [proposals, setProposals] = useState<TradeProposalItem[]>([]);
  const [proposalDraft, setProposalDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [proposalNeeds, setProposalNeeds] = useState<NeedItem[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferItem[]>([]);
  const [selectedProposalNeedId, setSelectedProposalNeedId] = useState('');
  const [selectedProposalOfferId, setSelectedProposalOfferId] = useState('');
  const [sideLoading, setSideLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [replyingProposalId, setReplyingProposalId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<TradeActionStatus | 'report' | null>(null);
  const [proposalActionLoading, setProposalActionLoading] = useState<{ proposalId: string; status: ProposalActionStatus } | null>(null);

  const role = useMemo<DetailRole>(() => {
    if (trade.ownerId === auth.user?.id) return 'owner';
    if (trade.providerId && trade.providerId === auth.user?.id) return 'provider';
    if (proposals.some((proposal) => proposal.applicantId === auth.user?.id && proposal.status === 'accepted')) return 'provider';
    if (proposals.some((proposal) => proposal.applicantId === auth.user?.id)) return 'applicant';
    return 'viewer';
  }, [auth.user?.id, proposals, trade.ownerId, trade.providerId]);

  const myProposal = useMemo(() => proposals.find((proposal) => proposal.applicantId === auth.user?.id) ?? null, [auth.user?.id, proposals]);
  const acceptedProposal = useMemo(() => proposals.find((proposal) => proposal.status === 'accepted') ?? null, [proposals]);
  const requiredSide = requiredProposalSide(trade);
  const activeProposalNeeds = useMemo(() => proposalNeeds.filter(isNeedAvailable), [proposalNeeds]);
  const activeProposalOffers = useMemo(() => proposalOffers.filter(isOfferAvailable), [proposalOffers]);
  const selectedProposalNeed = useMemo(() => activeProposalNeeds.find((need) => need.id === selectedProposalNeedId) ?? null, [activeProposalNeeds, selectedProposalNeedId]);
  const selectedProposalOffer = useMemo(() => activeProposalOffers.find((offer) => offer.id === selectedProposalOfferId) ?? null, [activeProposalOffers, selectedProposalOfferId]);
  const paymentLabel = exchangeLabel(trade, t);
  const createdLabel = formatDate(trade.createdAt, language);

  const loadTrade = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.get(params.tradeId) as TradeResponse;
      setTrade(result.trade);
      try {
        const proposalResult = await api.trades.proposals(params.tradeId) as ProposalsResponse;
        setProposals(Array.isArray(proposalResult.proposals) ? proposalResult.proposals : []);
      } catch { setProposals([]); }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setTrade((current) => current.id === params.tradeId ? current : fallback(params));
    } finally { setLoading(false); }
  }, [params]);

  useEffect(() => { void loadTrade(); }, [loadTrade, t]);

  useEffect(() => {
    if (!auth.isAuthenticated || role === 'owner' || myProposal || !requiredSide || trade.status !== 'active') return;
    let mounted = true;
    async function loadProposalInventory() {
      setSideLoading(true);
      try {
        if (requiredSide === 'offer') {
          const result = await api.offers.mine() as OffersResponse;
          const offers = Array.isArray(result.offers) ? result.offers : [];
          if (!mounted) return;
          setProposalOffers(offers);
          setSelectedProposalOfferId((current) => current && offers.some((offer) => offer.id === current) ? current : offers.find(isOfferAvailable)?.id ?? '');
        } else {
          const result = await api.needs.mine() as NeedsResponse;
          const needs = Array.isArray(result.needs) ? result.needs : [];
          if (!mounted) return;
          setProposalNeeds(needs);
          setSelectedProposalNeedId((current) => current && needs.some((need) => need.id === current) ? current : needs.find(isNeedAvailable)?.id ?? '');
        }
      } catch (caughtError) {
        if (mounted) setError(getFriendlyApiErrorMessage(caughtError, requiredSide === 'offer' ? t('trade.errors.couldNotLoadOffers') : t('trade.errors.couldNotLoadNeeds')));
      } finally { if (mounted) setSideLoading(false); }
    }
    void loadProposalInventory();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, myProposal, requiredSide, role, t, trade.status]);

  const actions = useMemo(() => {
    const canSubmit = trade.status === 'in_progress' && ['owner', 'provider'].includes(role);
    const canConfirm = trade.status === 'submitted' && ['owner', 'provider'].includes(role) && trade.deliverySubmittedById !== auth.user?.id;
    const list: Array<{ status: TradeActionStatus; label: string; variant?: 'primary' | 'danger' | 'ghost' }> = [];
    if (canSubmit) list.push({ status: 'submitted', label: t('trade.detail.markDelivered'), variant: 'primary' });
    if (canConfirm) list.push({ status: 'completed', label: t('trade.detail.confirmCompleted'), variant: 'primary' });
    if (role === 'owner' && trade.status === 'active') list.push({ status: 'cancelled', label: t('trade.detail.cancelTrade'), variant: 'danger' });
    if (role === 'provider' && ['in_progress', 'submitted'].includes(trade.status)) list.push({ status: 'cancelled', label: t('trade.detail.cancelTrade'), variant: 'danger' });
    if (['active', 'in_progress', 'submitted', 'completed'].includes(trade.status) && auth.user) list.push({ status: 'disputed', label: t('trade.detail.reportProblem'), variant: 'danger' });
    return list;
  }, [auth.user, auth.user?.id, role, t, trade.deliverySubmittedById, trade.status]);

  const updateStatus = useCallback(async (status: TradeActionStatus) => {
    const runStatusUpdate = async (nextStatus: TradeActionStatus) => {
      setActionLoading(nextStatus); setError(null); setMessage(null);
      try {
        const result = await api.trades.updateStatus(trade.id, { status: nextStatus }) as TradeResponse;
        setTrade(result.trade);
        setMessage(nextStatus === 'submitted' ? t('trade.detail.deliveryMarked') : nextStatus === 'completed' ? t('trade.detail.tradeConfirmed') : nextStatus === 'cancelled' ? t('trade.detail.tradeCancelled') : t('trade.detail.tradeUpdated'));
        await loadTrade();
      } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, t('trade.detail.couldNotUpdateNative'))); }
      finally { setActionLoading(null); }
    };
    if (status === 'disputed') {
      setActionLoading('report'); setError(null); setMessage(null);
      try { await api.support.createTicket({ category: 'trade_issue', priority: 'normal', subject: `Problem with trade: ${trade.title}`.slice(0, 140), message: t('support.defaultTradeIssueMessage'), relatedTradeId: trade.id }); setMessage(t('trade.detail.reportSent')); await loadTrade(); }
      catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, t('trade.detail.couldNotReportNative'))); }
      finally { setActionLoading(null); }
      return;
    }
    await runStatusUpdate(status);
  }, [loadTrade, t, trade.id, trade.title]);

  const createProposal = useCallback(async () => {
    if (!auth.isAuthenticated) { navigation.navigate('Login'); return; }
    const trimmed = proposalDraft.trim();
    if (trimmed.length < 3) return;
    if (requiredSide === 'offer' && !selectedProposalOffer) { setError(t('trade.proposals.chooseOfferFirst')); return; }
    if (requiredSide === 'need' && !selectedProposalNeed) { setError(t('trade.proposals.chooseNeedFirst')); return; }
    setCreatingProposal(true); setError(null); setMessage(null);
    try {
      const result = await api.trades.createProposal(trade.id, {
        message: trimmed,
        ...(requiredSide === 'offer' ? { proposedOfferId: selectedProposalOffer?.id } : {}),
        ...(requiredSide === 'need' ? { proposedNeedId: selectedProposalNeed?.id } : {}),
      }) as ProposalResponse;
      setProposals((current) => upsertProposal(current, result.proposal));
      setProposalDraft('');
      setMessage(t('trade.proposals.proposalSentNative'));
      await loadTrade();
    } catch (caughtError) {
      const body = caughtError && typeof caughtError === 'object' && 'body' in caughtError ? (caughtError as { body?: { proposal?: TradeProposalItem } }).body : undefined;
      if (body?.proposal) setProposals((current) => upsertProposal(current, body.proposal!));
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotSendProposal')));
    } finally { setCreatingProposal(false); }
  }, [auth.isAuthenticated, loadTrade, navigation, proposalDraft, requiredSide, selectedProposalNeed, selectedProposalOffer, t, trade.id]);

  const updateProposalStatus = useCallback(async (proposalId: string, status: ProposalActionStatus) => {
    setProposalActionLoading({ proposalId, status }); setError(null); setMessage(null);
    try {
      const result = await api.proposals.updateStatus(proposalId, { status }) as ProposalResponse;
      setProposals((current) => upsertProposal(current, result.proposal));
      if (result.trade) setTrade(result.trade);
      setMessage(status === 'accepted' ? t('trade.proposals.proposalAcceptedNative') : status === 'declined' ? t('trade.proposals.proposalDeclined') : t('trade.proposals.proposalWithdrawn'));
      await loadTrade();
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotUpdateProposal'))); }
    finally { setProposalActionLoading(null); }
  }, [loadTrade, t]);

  const sendProposalMessage = useCallback(async (proposalId: string) => {
    const trimmed = (replyDrafts[proposalId] ?? '').trim();
    if (!trimmed) return;
    setReplyingProposalId(proposalId); setError(null); setMessage(null);
    try {
      const result = await api.proposals.sendMessage(proposalId, { body: trimmed }) as ProposalMessageResponse;
      setReplyDrafts((current) => ({ ...current, [proposalId]: '' }));
      if (result.proposal) setProposals((current) => upsertProposal(current, result.proposal!));
      else if (result.message) setProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, messages: [...(proposal.messages ?? []), result.message!] } : proposal));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotSendMessage'))); }
    finally { setReplyingProposalId(null); }
  }, [replyDrafts, t]);

  return <AppFixedHeaderScreen header={<AppHeader title={t('trade.labels.trade')} onBack={() => navigation.goBack()} />}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadTrade(); }} />}>
    <View style={styles.hero}><View style={styles.headerRow}><StatusBadge status={trade.status} label={formatStatus(trade.status, t)} /><SemanticBadge label={postTypeLabel(trade, t)} tone="trade" size="sm" /></View><AppText style={styles.title}>{detailTitle(trade, t)}</AppText><View style={styles.ownerLine}><AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('trade.labels.postedBy')}</AppText><UserIdentityPressable user={trade.owner} userId={trade.ownerId} variant="chip" avatarSize="xs" statusText={trade.expiresAt ? expiryLabel(trade.expiresAt, t) : undefined} /></View><AppText style={[styles.paymentLine, { color: theme.color.muted }]}>{paymentLabel}</AppText></View>

    <Separator theme={theme} />
    {trade.need ? <InventorySection eyebrow={t('trade.labels.iNeed')} title={needTitle(trade, t)} description={needDescription(trade)} meta={needMeta(trade.need, t)} images={trade.need?.media ?? []} emptyImageLabel={t('trade.labels.noNeedImages')} theme={theme} /> : null}
    {trade.offer ? <><Separator theme={theme} /><InventorySection eyebrow={t('trade.labels.iOffer')} title={offerTitle(trade, t)} description={offerDescription(trade)} meta={offerMeta(trade.offer, t)} images={trade.offer?.media ?? []} emptyImageLabel={t('trade.labels.noOfferImages')} theme={theme} /></> : null}
    {requiredSide === 'offer' ? <><Separator theme={theme} /><OpenSideInvite title={t('trade.proposals.openForOffers')} body={t('trade.proposals.openForOffersBody')} tone="offer" theme={theme} /></> : null}
    {requiredSide === 'need' ? <><Separator theme={theme} /><OpenSideInvite title={t('trade.proposals.openForNeeds')} body={t('trade.proposals.openForNeedsBody')} tone="need" theme={theme} /></> : null}

    <Separator theme={theme} />
    <View style={styles.section}><AppText style={styles.sectionEyebrow}>{t('trade.labels.tradeDetails')}</AppText><View style={styles.detailRows}><DetailRow label={t('trade.labels.type')} value={postTypeLabel(trade, t)} theme={theme} /><DetailRow label={t('trade.labels.status')} value={formatStatus(trade.status, t)} theme={theme} /><DetailRow label={t('trade.labels.expiry')} value={expiryLabel(trade.expiresAt, t)} theme={theme} /><DetailRow label={t('trade.labels.exchange')} value={paymentLabel} theme={theme} />{createdLabel ? <DetailRow label={t('trade.labels.created')} value={createdLabel} theme={theme} /> : null}<DetailIdentityRow label={t('trade.labels.owner')} user={trade.owner} userId={trade.ownerId} theme={theme} />{trade.provider ? <DetailIdentityRow label={t('trade.labels.provider')} user={trade.provider} userId={trade.providerId} theme={theme} /> : null}</View><InfoNotice tone="info" title={t('trade.labels.nextStep')} body={statusHint(trade, role, t)} />{actions.length > 0 ? <View style={styles.actionStack}>{actions.map((action) => <ActionButton key={action.status} label={actionLoading === action.status || (action.status === 'disputed' && actionLoading === 'report') ? t('trade.detail.updated') : action.label} variant={action.variant ?? (action.status === 'cancelled' ? 'danger' : 'primary')} disabled={Boolean(actionLoading)} onPress={() => { void updateStatus(action.status); }} theme={theme} />)}</View> : null}</View>

    <Separator theme={theme} />
    <View style={styles.section}><AppText style={styles.sectionEyebrow}>{role === 'owner' ? t('trade.proposals.title') : myProposal ? t('trade.proposals.yourProposal') : proposalActionTitle(trade, t)}</AppText>{error ? <InfoNotice tone="danger" title={t('trade.detail.tradeError')} body={error} /> : null}{message ? <InfoNotice tone="success" title={t('trade.detail.updated')} body={message} /> : null}{loading ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.detail.refreshing')}</AppText> : null}{!auth.isAuthenticated ? <SignedOutProposalBox trade={trade} onLogin={() => navigation.navigate('Login')} theme={theme} t={t} /> : null}{auth.isAuthenticated && role !== 'owner' && !myProposal && trade.status === 'active' ? <ProposalComposer trade={trade} requiredSide={requiredSide} value={proposalDraft} onChange={setProposalDraft} onSubmit={() => { void createProposal(); }} loading={creatingProposal} sideLoading={sideLoading} needs={activeProposalNeeds} offers={activeProposalOffers} selectedNeedId={selectedProposalNeedId} selectedOfferId={selectedProposalOfferId} onSelectNeed={setSelectedProposalNeedId} onSelectOffer={setSelectedProposalOfferId} theme={theme} t={t} /> : null}{auth.isAuthenticated && role !== 'owner' && !myProposal && trade.status !== 'active' ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.notAccepting')}</AppText> : null}{role === 'owner' && proposals.length === 0 ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.noProposalsOwner')}</AppText> : null}{role === 'owner' && acceptedProposal ? <InfoNotice tone="success" title={t('trade.proposals.acceptedConversation')} body={t('trade.proposals.acceptedConversationBody')} /> : null}<View style={styles.proposalStack}>{proposals.map((proposal) => <ProposalBlock key={proposal.id} proposal={proposal} role={role} currentUserId={auth.user?.id} replyDraft={replyDrafts[proposal.id] ?? ''} onReplyDraftChange={(value) => setReplyDrafts((current) => ({ ...current, [proposal.id]: value }))} onSendMessage={() => { void sendProposalMessage(proposal.id); }} replying={replyingProposalId === proposal.id} proposalActionLoading={proposalActionLoading} onUpdateStatus={updateProposalStatus} onOpenThread={() => navigation.navigate('ProposalDetail', { proposalId: proposal.id })} theme={theme} t={t} />)}</View></View>
  </ScrollView></AppFixedHeaderScreen>;
}

function Separator({ theme }: { theme: ThemeTokens }) { return <View style={[styles.separator, { backgroundColor: theme.color.border }]} />; }
function OpenSideInvite({ title, body, tone, theme }: { title: string; body: string; tone: 'need' | 'offer'; theme: ThemeTokens }) { return <View style={[styles.openSideInvite, { borderColor: theme.semantic[tone].border, backgroundColor: theme.semantic[tone].softBg }]}><SemanticBadge label={title} tone={tone} size="sm" /><AppText style={[styles.bodyCopy, { color: theme.semantic[tone].text }]}>{body}</AppText></View>; }
function InventorySection({ eyebrow, title, description, meta, images, emptyImageLabel, theme }: { eyebrow: string; title: string; description: string; meta: string; images: MediaAssetDto[]; emptyImageLabel: string; theme: ThemeTokens }) { return <View style={styles.section}><AppText style={styles.sectionEyebrow}>{eyebrow}</AppText><AppText style={styles.sectionTitle}>{title}</AppText>{description ? <AppText style={[styles.bodyCopy, { color: theme.color.muted }]}>{description}</AppText> : null}<AppText style={[styles.metaLine, { color: theme.color.muted }]}>{meta}</AppText><TradeDetailImageGrid media={images} emptyLabel={emptyImageLabel} theme={theme} /></View>; }
function TradeDetailImageGrid({ media, emptyLabel, theme }: { media: MediaAssetDto[]; emptyLabel: string; theme: ThemeTokens }) { const activeMedia = media.filter((item) => item.status === 'active'); const visible = activeMedia.slice(0, 4); if (visible.length === 0) return <AppText style={[styles.emptyImages, { color: theme.color.muted, borderColor: theme.color.border, backgroundColor: theme.color.subtleSurface }]}>{emptyLabel}</AppText>; const first = visible[0]; if (visible.length === 1 && first) return <Image source={{ uri: resolveMediaUrl(first.url) }} style={styles.singleImage} resizeMode="cover" />; return <View style={styles.imageGrid}>{visible.map((item, index) => { const isLargeFirst = visible.length === 3 && index === 0; return <View key={item.id} style={[styles.gridImageWrap, isLargeFirst && styles.gridImageLargeFirst]}><Image source={{ uri: resolveMediaUrl(item.url) }} style={styles.gridImage} resizeMode="cover" />{index === 3 && activeMedia.length > 4 ? <View style={styles.moreOverlay}><AppText style={styles.moreOverlayText}>+{activeMedia.length - 4}</AppText></View> : null}</View>; })}</View>; }
function DetailRow({ label, value, theme }: { label: string; value: string; theme: ThemeTokens }) { return <View style={[styles.detailRow, { borderColor: theme.color.border }]}><AppText style={[styles.detailLabel, { color: theme.color.muted }]}>{label}</AppText><AppText style={styles.detailValue}>{value}</AppText></View>; }
function DetailIdentityRow({ label, user, userId, theme }: { label: string; user?: TradeDeckItem['owner']; userId?: string | null; theme: ThemeTokens }) { return <View style={[styles.detailRow, { borderColor: theme.color.border }]}><AppText style={[styles.detailLabel, { color: theme.color.muted }]}>{label}</AppText><UserIdentityPressable user={user} userId={userId} variant="compact" avatarSize="xs" showHandle={false} style={styles.detailIdentity} /></View>; }

function ProposalComposer({ trade, requiredSide, value, onChange, onSubmit, loading, sideLoading, needs, offers, selectedNeedId, selectedOfferId, onSelectNeed, onSelectOffer, theme, t }: { trade: TradeDeckItem; requiredSide: RequiredProposalSide; value: string; onChange: (value: string) => void; onSubmit: () => void; loading: boolean; sideLoading: boolean; needs: NeedItem[]; offers: OfferItem[]; selectedNeedId: string; selectedOfferId: string; onSelectNeed: (id: string) => void; onSelectOffer: (id: string) => void; theme: ThemeTokens; t: TFunction }) {
  const missingInventory = requiredSide === 'need' ? needs.length === 0 : requiredSide === 'offer' ? offers.length === 0 : false;
  const selectedNeed = requiredSide === 'need' ? needs.find((need) => need.id === selectedNeedId) ?? null : null;
  const selectedOffer = requiredSide === 'offer' ? offers.find((offer) => offer.id === selectedOfferId) ?? null : null;
  const disabled = loading || sideLoading || value.trim().length < 3 || (requiredSide === 'need' && !selectedNeed) || (requiredSide === 'offer' && !selectedOffer);
  const placeholder = requiredSide === 'offer'
    ? t('trade.proposals.placeholderOffer')
    : requiredSide === 'need'
      ? t('trade.proposals.placeholderNeed')
      : t('trade.proposals.placeholderTrade');
  const submitLabel = loading
    ? t('trade.proposals.sending')
    : requiredSide === 'offer'
      ? t('trade.proposals.sendOfferProposal')
      : requiredSide === 'need'
        ? t('trade.proposals.sendNeedProposal')
        : proposalActionTitle(trade, t);

  return (
    <View style={styles.composerBox}>
      <View style={[styles.proposalPromptBox, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }]}>
        <SemanticBadge label={proposalActionTitle(trade, t)} tone="proposal" size="sm" />
        <AppText style={[styles.proposalPromptText, { color: theme.semantic.proposal.text }]}>{proposalHelper(trade, t)}</AppText>
      </View>

      {sideLoading ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.loadingInventory')}</AppText> : null}

      {requiredSide === 'offer' ? <InventoryChoiceList title={t('trade.proposals.chooseOfferToPropose')} emptyText={t('trade.proposals.createOfferFirst')} items={offers} selectedId={selectedOfferId} onSelect={onSelectOffer} kind="offer" theme={theme} t={t} /> : null}
      {requiredSide === 'need' ? <InventoryChoiceList title={t('trade.proposals.chooseNeedToPropose')} emptyText={t('trade.proposals.createNeedFirst')} items={needs} selectedId={selectedNeedId} onSelect={onSelectNeed} kind="need" theme={theme} t={t} /> : null}

      {selectedOffer ? <InventoryPreviewCard item={selectedOffer} kind="offer" label={t('trade.labels.selectedOffer')} theme={theme} t={t} /> : null}
      {selectedNeed ? <InventoryPreviewCard item={selectedNeed} kind="need" label={t('trade.labels.selectedNeed')} theme={theme} t={t} /> : null}

      <View style={styles.messageComposerBlock}>
        <AppText style={styles.threadLabel}>{t('trade.labels.message')}</AppText>
        <TextInput value={value} onChangeText={onChange} multiline textAlignVertical="top" placeholder={placeholder} placeholderTextColor={theme.color.muted} style={[styles.textArea, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
      </View>

      {missingInventory ? <InfoNotice tone="warning" title={t('trade.proposals.savedInventoryNeeded')} body={requiredSide === 'offer' ? t('trade.proposals.addOfferBeforeProposing') : t('trade.proposals.addNeedBeforeProposing')} /> : null}
      <ActionButton label={submitLabel} variant="primary" disabled={disabled} onPress={onSubmit} theme={theme} />
    </View>
  );
}

function InventoryChoiceList<T extends NeedItem | OfferItem>({ title, emptyText, items, selectedId, onSelect, kind, theme, t }: { title: string; emptyText: string; items: T[]; selectedId: string; onSelect: (id: string) => void; kind: 'need' | 'offer'; theme: ThemeTokens; t: TFunction }) {
  return (
    <View style={[styles.inventoryChoiceBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <View style={styles.inventoryChoiceHeading}>
        <SemanticBadge label={kind === 'need' ? t('inventory.labels.needs') : t('inventory.labels.offers')} tone={kind} size="sm" />
        <AppText style={styles.threadLabel}>{title}</AppText>
      </View>
      {items.length === 0 ? (
        <View style={[styles.inventoryEmptyBox, { borderColor: theme.color.border, backgroundColor: theme.color.surface }]}>
          <AppText style={[styles.muted, { color: theme.color.muted }]}>{emptyText}</AppText>
        </View>
      ) : items.map((item) => {
        const selected = selectedId === item.id;
        return (
          <Pressable key={item.id} accessibilityRole="button" onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.inventoryChoiceRow, { backgroundColor: selected ? theme.semantic[kind].softBg : theme.color.surface, borderColor: selected ? theme.semantic[kind].border : theme.color.border }, selected && styles.inventoryChoiceSelected, pressed && styles.pressed]}>
            <View style={styles.inventoryChoiceCopy}>
              <View style={styles.inventoryChoiceTitleRow}>
                <AppText style={styles.inventoryChoiceTitle} numberOfLines={2}>{item.title}</AppText>
                {selected ? <SemanticBadge label={t('trade.labels.selected')} tone={kind} size="sm" /> : null}
              </View>
              <AppText style={[styles.inventoryChoiceMeta, { color: selected ? theme.semantic[kind].text : theme.color.muted }]} numberOfLines={1}>{proposalInventoryMeta(kind, item, t)}</AppText>
              <AppText style={[styles.inventoryChoiceDescription, { color: theme.color.muted }]} numberOfLines={2}>{proposalInventoryDescription(item, t)}</AppText>
            </View>
            {selected ? <MobileIcon name="proposal-accepted" size={18} color={theme.semantic[kind].text} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function SignedOutProposalBox({ trade, onLogin, theme, t }: { trade: TradeDeckItem; onLogin: () => void; theme: ThemeTokens; t: TFunction }) {
  return <View style={styles.composerBox}><AppText style={[styles.bodyCopy, { color: theme.color.muted }]}>{proposalHelper(trade, t)} {t('trade.proposals.signInReady')}</AppText><ActionButton label={t('common.actions.loginOrRegister')} variant="primary" onPress={onLogin} theme={theme} /></View>;
}

function InventoryPreviewCard({ item, kind, label, theme, t }: { item: NeedItem | OfferItem; kind: 'need' | 'offer'; label: string; theme: ThemeTokens; t: TFunction }) {
  return (
    <View style={[styles.selectedSidePreview, { backgroundColor: theme.semantic[kind].softBg, borderColor: theme.semantic[kind].border }]}>
      <View style={styles.selectedSideHeader}>
        <SemanticBadge label={label} tone={kind} size="sm" />
        <MobileIcon name={kind === 'need' ? 'need' : 'offer'} size={18} color={theme.semantic[kind].text} />
      </View>
      <AppText style={styles.selectedSideTitle} numberOfLines={2}>{item.title}</AppText>
      <AppText style={[styles.selectedSideMeta, { color: theme.semantic[kind].text }]} numberOfLines={1}>{proposalInventoryMeta(kind, item, t)}</AppText>
      <AppText style={[styles.selectedSideDescription, { color: theme.semantic[kind].text }]} numberOfLines={3}>{proposalInventoryDescription(item, t)}</AppText>
    </View>
  );
}

function ProposalBlock({ proposal, role, currentUserId, replyDraft, onReplyDraftChange, onSendMessage, replying, proposalActionLoading, onUpdateStatus, onOpenThread, theme, t }: { proposal: TradeProposalItem; role: DetailRole; currentUserId?: string; replyDraft: string; onReplyDraftChange: (value: string) => void; onSendMessage: () => void; replying: boolean; proposalActionLoading: { proposalId: string; status: ProposalActionStatus } | null; onUpdateStatus: (proposalId: string, status: ProposalActionStatus) => void; onOpenThread: () => void; theme: ThemeTokens; t: TFunction }) {
  const isOwner = role === 'owner';
  const isApplicant = proposal.applicantId === currentUserId;
  const showConversation = canShowConversation(proposal, role, currentUserId);
  const canMessage = canMessageProposal(proposal);
  const messages = visibleConversationMessages(proposal);
  const statusLabel = formatStatus(proposal.status, t);
  return (
    <View style={[styles.proposalBlock, { borderColor: theme.color.border }]}>
      <View style={styles.proposalHeader}>
        <View style={styles.proposalHeaderTop}>
          <UserIdentityPressable
            user={proposal.applicant}
            userId={proposal.applicantId}
            displayName={isApplicant ? t('trade.labels.you') : undefined}
            variant="row"
            subtitle={t('trade.labels.applicant')}
            style={styles.proposalIdentityLink}
          />
          <StatusBadge status={proposal.status} label={statusLabel} size="sm" />
        </View>
        <AppText style={[styles.proposalMessage, { color: theme.color.muted }]}>{proposal.message}</AppText>
      </View>
      <ProposalSideSummary proposal={proposal} theme={theme} t={t} />
      {isOwner && proposal.status === 'pending' ? <View style={styles.actionRow}><ActionButton label={proposalActionLoading?.proposalId === proposal.id && proposalActionLoading.status === 'accepted' ? t('trade.proposals.accepting') : t('trade.proposals.accept')} variant="primary" disabled={Boolean(proposalActionLoading)} onPress={() => onUpdateStatus(proposal.id, 'accepted')} theme={theme} /><ActionButton label={proposalActionLoading?.proposalId === proposal.id && proposalActionLoading.status === 'declined' ? t('trade.proposals.declining') : t('trade.proposals.decline')} variant="danger" disabled={Boolean(proposalActionLoading)} onPress={() => onUpdateStatus(proposal.id, 'declined')} theme={theme} /></View> : null}
      {isApplicant && proposal.status === 'pending' ? <ActionButton label={proposalActionLoading?.proposalId === proposal.id && proposalActionLoading.status === 'withdrawn' ? t('trade.proposals.withdrawing') : t('trade.proposals.withdraw')} variant="danger" disabled={Boolean(proposalActionLoading)} onPress={() => onUpdateStatus(proposal.id, 'withdrawn')} theme={theme} /> : null}
      {showConversation ? <View style={styles.inlineThread}><AppText style={styles.threadLabel}>{proposal.status === 'accepted' ? t('trade.proposals.acceptedConversation') : t('trade.proposals.privateProposalConversation')}</AppText>{messages.length === 0 ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.noMessages')}</AppText> : messages.map((item) => <MessageBubble key={item.id} message={item} mine={item.senderId === currentUserId} theme={theme} t={t} />)}{canMessage ? <View style={styles.replyBox}><TextInput value={replyDraft} onChangeText={onReplyDraftChange} multiline textAlignVertical="top" placeholder={t('trade.proposals.writePrivateReply')} placeholderTextColor={theme.color.muted} style={[styles.replyInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} /><ActionButton label={replying ? t('trade.proposals.sending') : t('trade.proposals.sendReply')} variant="ghost" disabled={replying || replyDraft.trim().length === 0} onPress={onSendMessage} theme={theme} /></View> : null}</View> : <Pressable accessibilityRole="button" onPress={onOpenThread} style={({ pressed }) => [styles.openThreadButton, { borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.openThreadText, { color: theme.color.muted }]}>{t('trade.proposals.openPrivateThread')}</AppText></Pressable>}
    </View>
  );
}

function ProposalSideSummary({ proposal, theme, t }: { proposal: TradeProposalItem; theme: ThemeTokens; t: TFunction }) {
  const need = proposal.proposedNeed;
  const offer = proposal.proposedOffer;
  if (!need && !offer) return null;
  const kind = need ? 'need' : 'offer';
  const item = need ?? offer!;
  return <InventoryPreviewCard item={item} kind={kind} label={kind === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')} theme={theme} t={t} />;
}

function MessageBubble({ message, mine, theme, t }: { message: ProposalMessageItem; mine: boolean; theme: ThemeTokens; t: TFunction }) {
  return <View style={[styles.messageBubble, mine ? styles.myMessageBubble : styles.theirMessageBubble, { backgroundColor: mine ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: mine ? theme.semantic.proposal.border : theme.color.border }]}><UserIdentityPressable user={message.sender} userId={message.senderId} displayName={mine ? t('trade.labels.you') : undefined} variant="compact" avatarSize="xs" showHandle={false} /><AppText style={styles.messageBody}>{message.body}</AppText></View>;
}
function ActionButton({ label, variant, disabled, onPress, theme }: { label: string; variant: 'primary' | 'danger' | 'ghost'; disabled?: boolean; onPress: () => void; theme: ThemeTokens }) { const buttonStyle = variant === 'primary' ? { backgroundColor: theme.semantic.proposal.bg, borderColor: theme.semantic.proposal.bg } : variant === 'danger' ? { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border } : { backgroundColor: theme.color.surface, borderColor: theme.color.border }; const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? theme.semantic.danger.text : theme.color.text; return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, buttonStyle, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionButtonText, { color: textColor }]}>{label}</AppText></Pressable>; }

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 20 }, hero: { gap: 10 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, title: { fontSize: 32, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { fontSize: 14, lineHeight: 20, fontWeight: '800' }, ownerLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, paymentLine: { fontSize: 15, lineHeight: 21, fontWeight: '900' }, separator: { height: 1, opacity: 0.72 }, section: { gap: 13 }, sectionEyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }, sectionTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.45 }, bodyCopy: { fontSize: 16, lineHeight: 23, fontWeight: '600' }, metaLine: { fontSize: 13, lineHeight: 18, fontWeight: '900' }, openSideInvite: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 8 }, emptyImages: { overflow: 'hidden', borderWidth: 1, borderRadius: 22, padding: 18, fontWeight: '800' }, singleImage: { width: '100%', height: 310, borderRadius: 24, backgroundColor: '#E2E8F0' }, imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, gridImageWrap: { width: '48.8%', height: 154, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E2E8F0' }, gridImageLargeFirst: { width: '100%', height: 214 }, gridImage: { width: '100%', height: '100%' }, moreOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)' }, moreOverlayText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' }, detailRows: { gap: 0 }, detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth }, detailLabel: { fontSize: 13, fontWeight: '800' }, detailValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '900', textTransform: 'capitalize' }, detailIdentity: { flex: 1, justifyContent: 'flex-end' }, actionStack: { gap: 10 }, actionRow: { flexDirection: 'row', gap: 10 }, composerBox: { gap: 12 }, proposalPromptBox: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 8 }, proposalPromptText: { lineHeight: 20, fontWeight: '800' }, messageComposerBlock: { gap: 8 }, textArea: { minHeight: 126, borderRadius: 20, borderWidth: 1, padding: 14, fontSize: 16, lineHeight: 22, fontWeight: '600' }, inventoryChoiceBox: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 10 }, inventoryChoiceHeading: { gap: 7 }, inventoryEmptyBox: { borderRadius: 18, borderWidth: 1, padding: 12 }, inventoryChoiceRow: { borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, inventoryChoiceSelected: { borderWidth: 2 }, inventoryChoiceCopy: { flex: 1, gap: 5 }, inventoryChoiceTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, inventoryChoiceTitle: { flex: 1, fontSize: 16, lineHeight: 20, fontWeight: '900' }, inventoryChoiceMeta: { fontSize: 12, fontWeight: '900', lineHeight: 17 }, inventoryChoiceDescription: { fontSize: 12, lineHeight: 17, fontWeight: '700' }, selectedSidePreview: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 7 }, selectedSideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectedSideTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' }, selectedSideMeta: { fontSize: 12, lineHeight: 17, fontWeight: '900' }, selectedSideDescription: { lineHeight: 20, fontWeight: '700' }, proposalStack: { gap: 14 }, proposalBlock: { gap: 13, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth }, proposalHeader: { gap: 10 }, proposalHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, proposalIdentityLink: { flex: 1 }, proposalIdentity: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, proposalCopy: { flex: 1, gap: 5 }, proposalTitle: { fontSize: 16, fontWeight: '900' }, proposalMessage: { fontSize: 14, lineHeight: 20, fontWeight: '700' }, inlineThread: { gap: 9 }, threadLabel: { fontSize: 13, fontWeight: '900' }, messageBubble: { maxWidth: '90%', borderRadius: 18, borderWidth: 1, padding: 12, gap: 4 }, myMessageBubble: { alignSelf: 'flex-end' }, theirMessageBubble: { alignSelf: 'flex-start' }, messageAuthor: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }, messageBody: { lineHeight: 20, fontWeight: '600' }, replyBox: { gap: 8 }, replyInput: { minHeight: 88, borderRadius: 18, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 21, fontWeight: '600' }, openThreadButton: { minHeight: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, openThreadText: { fontWeight: '900' }, muted: { lineHeight: 20, fontWeight: '700' }, actionButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 }, actionButtonText: { fontWeight: '900' }, disabledButton: { opacity: 0.52 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
