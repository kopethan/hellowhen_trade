import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MediaAssetDto, TradeActionStatus, TradePostType, TradeStatus } from '@hellowhen/contracts';
import type { ThemeTokens } from '@hellowhen/theme';
import { formatLocalizedDate, formatLocalizedTimeUntil, type SupportedLanguage } from '@hellowhen/i18n';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { buildPublicTradeUrl } from '../../lib/publicUrls';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { ReportContentPanel } from '../../components/ReportContentPanel';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { DetailBottomActionBar, DetailEmptyState, DetailHero, DetailImageGrid, DetailInfoList, DetailMetadataChips, DetailSection } from '../../components/detail';
import { UserIdentityPressable } from '../users/UserIdentityPressable';
import { resolveMediaUrl } from './mediaUrls';
import type { NeedItem, OfferItem, TradeDeckItem, TradeProposalItem } from './types';

 type Props = NativeStackScreenProps<RootStackParamList, 'TradeDetail'>;
type TradeResponse = { trade: TradeDeckItem };
type ProposalsResponse = { proposals: TradeProposalItem[] };
type PublicMessagesResponse = { messages: Array<{ id: string }> };
type ProposalResponse = { proposal: TradeProposalItem; trade?: TradeDeckItem };
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
function expiryLabel(expiresAt: string | null | undefined, t: TFunction, language: SupportedLanguage) { return formatLocalizedTimeUntil(expiresAt, language, { noValue: t('trade.expiry.noExpirySet'), expired: t('trade.expiry.expired'), fallback: (count, unit) => unit === 'hour' ? t('trade.expiry.hoursLeft', { count }) : t('trade.expiry.daysLeft', { count }) }); }
function statusTone(status: TradeStatus): 'success' | 'warning' | 'danger' | 'info' | 'time' | 'muted' | 'instruction' { if (status === 'active' || status === 'completed') return 'success'; if (status === 'submitted') return 'info'; if (status === 'in_progress' || status === 'funded') return 'instruction'; if (status === 'disputed' || status === 'cancelled') return 'danger'; if (status === 'expired') return 'time'; if (status === 'draft') return 'warning'; return 'muted'; }
function detailChipList(meta: string) { return meta.split(' · ').map((label) => label.trim()).filter(Boolean).slice(0, 4); }
function activeDetailImages(media: MediaAssetDto[] | undefined) { return (media ?? []).filter((item) => item.status === 'active').map((item) => ({ id: item.id, uri: resolveMediaUrl(item.url) })); }
function formatDate(value: string | null | undefined, language: SupportedLanguage) { return formatLocalizedDate(value, language, ''); }
function formatStatus(status: string, t: TFunction) { const label = t(`trade.statuses.${status}`); return label === `trade.statuses.${status}` ? status.replace(/_/g, ' ') : label; }
function statusHint(trade: TradeDeckItem, role: DetailRole, t: TFunction) { if (trade.status === 'active') { const side = requiredProposalSide(trade); if (role === 'owner') return side === 'offer' ? t('trade.detail.activeOwnerOfferHint') : side === 'need' ? t('trade.detail.activeOwnerNeedHint') : t('trade.detail.activeOwnerTradeHint'); return side === 'offer' ? t('trade.detail.activeViewerOfferHint') : side === 'need' ? t('trade.detail.activeViewerNeedHint') : t('trade.detail.activeViewerTradeHint'); } if (trade.status === 'in_progress') return t('trade.detail.inProgressHint'); if (trade.status === 'submitted') return t('trade.detail.submittedHintNative'); if (trade.status === 'disputed') return t('trade.detail.disputedHintNative'); if (trade.status === 'completed') return t('trade.detail.completedHintNative'); if (trade.status === 'cancelled') return t('trade.detail.cancelledHintNative'); return t('trade.detail.reviewStatusHint'); }
function upsertProposal(proposals: TradeProposalItem[], next: TradeProposalItem) { return proposals.some((proposal) => proposal.id === next.id) ? proposals.map((proposal) => proposal.id === next.id ? { ...proposal, ...next } : proposal) : [next, ...proposals]; }
function isNeedAvailable(need: NeedItem) { return need.status === 'active'; }
function isOfferAvailable(offer: OfferItem) { return offer.status === 'active'; }
function proposalInventoryMeta(kind: 'need' | 'offer', item: NeedItem | OfferItem, t: TFunction) { return kind === 'need' ? needMeta(item as NeedItem, t) : offerMeta(item as OfferItem, t); }
function proposalInventoryDescription(item: NeedItem | OfferItem, t: TFunction) { return item.description?.trim() || t('trade.labels.noDescription'); }

export function TradeDetailScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const params = route.params;
  const [trade, setTrade] = useState<TradeDeckItem>(() => fallback(params));
  const [proposals, setProposals] = useState<TradeProposalItem[]>([]);
  const [publicMessageCount, setPublicMessageCount] = useState(0);
  const [proposalDraft, setProposalDraft] = useState('');
  const [proposalNeeds, setProposalNeeds] = useState<NeedItem[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferItem[]>([]);
  const [selectedProposalNeedId, setSelectedProposalNeedId] = useState('');
  const [selectedProposalOfferId, setSelectedProposalOfferId] = useState('');
  const [sideLoading, setSideLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [actionLoading, setActionLoading] = useState<TradeActionStatus | 'report' | 'share' | null>(null);
  const loadingTradeRef = useRef(false);


  useEffect(() => {
    let appliedBundledSelection = false;
    if (typeof params.selectedProposalNeedId === 'string') {
      setSelectedProposalNeedId(params.selectedProposalNeedId);
      appliedBundledSelection = true;
    }
    if (typeof params.selectedProposalOfferId === 'string') {
      setSelectedProposalOfferId(params.selectedProposalOfferId);
      appliedBundledSelection = true;
    }
    if (appliedBundledSelection) return;

    const selection = params.selectedProposalSide;
    if (!selection || selection.kind === 'money') return;
    if (selection.kind === 'need') {
      setSelectedProposalNeedId(selection.id);
    } else if (selection.kind === 'offer') {
      setSelectedProposalOfferId(selection.id);
    }
  }, [params.selectedProposalNeedId, params.selectedProposalOfferId, params.selectedProposalSide]);

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
    if (loadingTradeRef.current) return;
    loadingTradeRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await api.trades.get(params.tradeId) as TradeResponse;
      setTrade(result.trade);
      try {
        const proposalResult = await api.trades.proposals(params.tradeId) as ProposalsResponse;
        setProposals(Array.isArray(proposalResult.proposals) ? proposalResult.proposals : []);
      } catch { setProposals([]); }
      if (auth.isAuthenticated) {
        try {
          const publicResult = await api.trades.publicMessages(params.tradeId, { take: 100 }) as PublicMessagesResponse;
          setPublicMessageCount(Array.isArray(publicResult.messages) ? publicResult.messages.length : 0);
        } catch { setPublicMessageCount(0); }
      } else {
        setPublicMessageCount(0);
      }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
      setTrade((current) => current.id === params.tradeId ? current : fallback(params));
    } finally { loadingTradeRef.current = false; setLoading(false); }
  }, [auth.isAuthenticated, params]);

  useFocusEffect(useCallback(() => { void loadTrade(); }, [loadTrade]));

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
      } catch (caughtError) {
        if (mounted) setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotLoadInventory')));
      } finally { if (mounted) setSideLoading(false); }
    }
    void loadProposalInventory();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, myProposal, params.selectedProposalSide, requiredSide, role, t, trade.status]);

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

  const shareTrade = useCallback(async () => {
    if (actionLoading) return;
    const title = detailTitle(trade, t);
    const url = buildPublicTradeUrl(trade.id);
    const text = t('trade.detail.shareText', { title });

    setActionLoading('share');
    setError(null);
    setMessage(null);

    try {
      await Share.share({
        title,
        message: `${text}\n${url}`,
        url,
      });
      setMessage(t('trade.detail.shareOpened'));
    } catch {
      setError(t('trade.detail.couldNotShareNative'));
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading, t, trade]);

  const updateStatus = useCallback(async (status: TradeActionStatus) => {
    if (actionLoading) return;
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
  }, [actionLoading, loadTrade, t, trade.id, trade.title]);

  const createProposal = useCallback(async () => {
    if (creatingProposal) return;
    if (!auth.isAuthenticated) { navigation.navigate('Login'); return; }
    const trimmed = proposalDraft.trim();
    if (trimmed.length < 3) return;
    if (requiredSide === 'offer' && !selectedProposalOffer) { setError(t('trade.proposals.chooseOfferFirst')); return; }
    if (requiredSide === 'need' && !selectedProposalNeed) { setError(t('trade.proposals.chooseNeedFirst')); return; }
    setCreatingProposal(true); setError(null); setMessage(null);
    try {
      const result = await api.trades.createProposal(trade.id, {
        message: trimmed,
        ...(selectedProposalOffer ? { proposedOfferId: selectedProposalOffer.id } : {}),
        ...(selectedProposalNeed ? { proposedNeedId: selectedProposalNeed.id } : {}),
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
  }, [auth.isAuthenticated, creatingProposal, loadTrade, navigation, proposalDraft, requiredSide, selectedProposalNeed, selectedProposalOffer, t, trade.id]);


  const detailInfoRows = [
    { label: t('trade.labels.type'), value: postTypeLabel(trade, t), tone: 'trade' as const },
    { label: t('trade.labels.status'), value: formatStatus(trade.status, t), tone: statusTone(trade.status) },
    { label: t('trade.labels.expiry'), value: expiryLabel(trade.expiresAt, t, language), tone: 'time' as const },
    { label: t('trade.labels.exchange'), value: paymentLabel, tone: 'proposal' as const },
    { label: t('trade.labels.created'), value: createdLabel || null, tone: 'muted' as const },
  ];
  const primaryAction = actions.find((action) => action.variant !== 'danger') ?? null;
  const secondaryActions = actions.filter((action) => action !== primaryAction).map((action) => ({
    label: actionLoading === action.status || (action.status === 'disputed' && actionLoading === 'report') ? t('trade.detail.updated') : action.label,
    disabled: Boolean(actionLoading),
    icon: action.status === 'disputed' ? 'dispute' as const : undefined,
    onPress: () => { void updateStatus(action.status); },
  }));

  return <AppFixedHeaderScreen header={<AppHeader title={t('trade.labels.trade')} onBack={() => navigation.goBack()} rightSlot={
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('trade.detail.shareTrade')}
      disabled={actionLoading === 'share'}
      onPress={() => { void shareTrade(); }}
      style={({ pressed }) => [styles.headerShareButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, (pressed || actionLoading === 'share') && styles.pressed]}
    >
      <MobileIcon name="share" size={19} color={theme.color.text} />
    </Pressable>
  } />}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadTrade(); }} />}>
      <DetailHero
        eyebrow={`${formatStatus(trade.status, t)} · ${postTypeLabel(trade, t)}`}
        title={detailTitle(trade, t)}
        subtitle={paymentLabel}
        meta={trade.expiresAt ? expiryLabel(trade.expiresAt, t, language) : createdLabel || undefined}
      >
        <View style={styles.ownerLineModern}>
          <AppText style={[styles.ownerLabel, { color: theme.color.muted }]}>{t('trade.labels.postedBy')}</AppText>
          <UserIdentityPressable user={trade.owner} userId={trade.ownerId} variant="chip" avatarSize="xs" />
        </View>
        <DetailMetadataChips compact chips={[{ label: formatStatus(trade.status, t), tone: statusTone(trade.status) }, { label: postTypeLabel(trade, t), tone: 'trade' }, { label: paymentLabel, tone: 'proposal' }]} />
        {role !== 'owner' ? <ReportContentPanel targetType="trade" targetId={trade.id} labelKey="report.trade" helperKey="report.helper.trade" /> : null}
      </DetailHero>

      {trade.need ? <TradeSideSection tone="need" eyebrow={t('trade.labels.iNeed')} title={needTitle(trade, t)} description={needDescription(trade)} chips={detailChipList(needMeta(trade.need, t))} images={activeDetailImages(trade.need?.media)} emptyImageLabel={t('trade.labels.noNeedImages')} /> : null}
      {trade.offer ? <TradeSideSection tone="offer" eyebrow={t('trade.labels.iOffer')} title={offerTitle(trade, t)} description={offerDescription(trade)} chips={detailChipList(offerMeta(trade.offer, t))} images={activeDetailImages(trade.offer?.media)} emptyImageLabel={t('trade.labels.noOfferImages')} /> : null}
      {requiredSide === 'offer' ? <OpenSideInvite title={t('trade.proposals.openForOffers')} body={t('trade.proposals.openForOffersBody')} tone="offer" /> : null}
      {requiredSide === 'need' ? <OpenSideInvite title={t('trade.proposals.openForNeeds')} body={t('trade.proposals.openForNeedsBody')} tone="need" /> : null}

      <DetailSection eyebrow={t('trade.labels.tradeDetails')} title={t('trade.labels.nextStep')} description={statusHint(trade, role, t)}>
        <DetailInfoList rows={detailInfoRows} />
        <View style={styles.participantRows}>
          <DetailIdentityPill label={t('trade.labels.owner')} user={trade.owner} userId={trade.ownerId} />
          {trade.provider ? <DetailIdentityPill label={t('trade.labels.provider')} user={trade.provider} userId={trade.providerId} /> : null}
        </View>
        {actions.length > 0 ? <DetailBottomActionBar
          helper={statusHint(trade, role, t)}
          primary={primaryAction ? {
            label: actionLoading === primaryAction.status || (primaryAction.status === 'disputed' && actionLoading === 'report') ? t('trade.detail.updated') : primaryAction.label,
            loading: actionLoading === primaryAction.status || (primaryAction.status === 'disputed' && actionLoading === 'report'),
            disabled: Boolean(actionLoading),
            tone: primaryAction.variant === 'danger' ? 'danger' : 'primary',
            onPress: () => { void updateStatus(primaryAction.status); },
          } : undefined}
          secondary={secondaryActions}
          style={styles.inlineActionBar}
        /> : null}
      </DetailSection>

      <ThreadSplitSection
        publicMessageCount={publicMessageCount}
        privateProposalCount={role === 'owner' ? proposals.length : myProposal ? 1 : 0}
        role={role}
        hasMyProposal={Boolean(myProposal)}
        onOpenPublic={() => navigation.navigate('TradePublicDiscussion', { tradeId: trade.id, title: detailTitle(trade, t) })}
        onOpenPrivate={() => navigation.navigate('TradePrivateProposals', { tradeId: trade.id, title: detailTitle(trade, t), status: trade.status })}
        theme={theme}
        t={t}
      />
      {error ? <InfoNotice tone="danger" title={t('trade.detail.tradeError')} body={error} /> : null}
      {message ? <InfoNotice tone="success" title={t('trade.detail.updated')} body={message} /> : null}
    </ScrollView>
  </AppFixedHeaderScreen>;

}

function OpenSideInvite({ title, body, tone }: { title: string; body: string; tone: 'need' | 'offer' }) { return <DetailSection compact eyebrow={title} withTopBorder><View style={styles.openSideBody}><DetailMetadataChips compact chips={[{ label: title, tone }]} /><AppText style={styles.openSideText}>{body}</AppText></View></DetailSection>; }
function TradeSideSection({ tone, eyebrow, title, description, chips, images, emptyImageLabel }: { tone: 'need' | 'offer'; eyebrow: string; title: string; description: string; chips: string[]; images: Array<{ id: string; uri: string }>; emptyImageLabel: string }) { return <DetailSection eyebrow={eyebrow} title={title} description={description || null}><DetailMetadataChips compact chips={chips.map((label) => ({ label, tone }))} />{images.length > 0 ? <DetailImageGrid images={images} /> : <DetailEmptyState icon={tone} title={emptyImageLabel} style={styles.imageEmptyState} />}</DetailSection>; }
function DetailIdentityPill({ label, user, userId }: { label: string; user?: TradeDeckItem['owner']; userId?: string | null }) { const theme = useThemeTokens(); return <View style={[styles.identityPill, { borderColor: theme.color.border, backgroundColor: theme.color.surface }]}><AppText style={[styles.identityPillLabel, { color: theme.color.muted }]}>{label}</AppText><UserIdentityPressable user={user} userId={userId} variant="compact" avatarSize="xs" showHandle={false} /></View>; }

function ProposalComposer({ trade, requiredSide, value, onChange, onSubmit, loading, sideLoading, needs, offers, selectedNeedId, selectedOfferId, onChooseNeed, onChooseOffer, theme, t }: { trade: TradeDeckItem; requiredSide: RequiredProposalSide; value: string; onChange: (value: string) => void; onSubmit: () => void; loading: boolean; sideLoading: boolean; needs: NeedItem[]; offers: OfferItem[]; selectedNeedId: string; selectedOfferId: string; onChooseNeed: () => void; onChooseOffer: () => void; theme: ThemeTokens; t: TFunction }) {
  const missingInventory = requiredSide === 'need' ? needs.length === 0 : requiredSide === 'offer' ? offers.length === 0 : false;
  const selectedNeed = needs.find((need) => need.id === selectedNeedId) ?? null;
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? null;
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

      {!requiredSide ? <InfoNotice tone="info" title={t('trade.proposals.chooseProposalItem')} body={t('trade.proposals.chooseProposalItemOptionalBody')} /> : null}
      {requiredSide === 'offer' ? <InfoNotice tone="instruction" title={t('trade.proposals.chooseOfferToPropose')} body={t('trade.proposals.chooseOfferFirst')} /> : null}
      {requiredSide === 'need' ? <InfoNotice tone="instruction" title={t('trade.proposals.chooseNeedToPropose')} body={t('trade.proposals.chooseNeedFirst')} /> : null}

      {requiredSide === 'need' ? (
        <>
          <InventoryPickerShortcut
            kind="need"
            title={t('trade.proposals.chooseNeedToPropose')}
            count={needs.length}
            item={selectedNeed}
            emptyText={t('trade.proposals.createNeedFirst')}
            onChoose={onChooseNeed}
            theme={theme}
            t={t}
          />
          <InventoryPickerShortcut
            kind="offer"
            title={t('trade.proposals.attachOfferToProposal')}
            count={offers.length}
            item={selectedOffer}
            emptyText={t('trade.proposals.createOfferOptional')}
            onChoose={onChooseOffer}
            theme={theme}
            t={t}
          />
        </>
      ) : (
        <>
          <InventoryPickerShortcut
            kind="offer"
            title={requiredSide === 'offer' ? t('trade.proposals.chooseOfferToPropose') : t('trade.proposals.attachOfferToProposal')}
            count={offers.length}
            item={selectedOffer}
            emptyText={requiredSide === 'offer' ? t('trade.proposals.createOfferFirst') : t('trade.proposals.createOfferOptional')}
            onChoose={onChooseOffer}
            theme={theme}
            t={t}
          />
          <InventoryPickerShortcut
            kind="need"
            title={t('trade.proposals.attachNeedToProposal')}
            count={needs.length}
            item={selectedNeed}
            emptyText={t('trade.proposals.createNeedOptional')}
            onChoose={onChooseNeed}
            theme={theme}
            t={t}
          />
        </>
      )}

      <View style={styles.messageComposerBlock}>
        <AppText style={styles.threadLabel}>{t('trade.labels.message')}</AppText>
        <TextInput value={value} onChangeText={onChange} multiline textAlignVertical="top" placeholder={placeholder} placeholderTextColor={theme.color.muted} style={[styles.textArea, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
      </View>

      {missingInventory ? <InfoNotice tone="warning" title={t('trade.proposals.savedInventoryNeeded')} body={requiredSide === 'offer' ? t('trade.proposals.addOfferBeforeProposing') : t('trade.proposals.addNeedBeforeProposing')} /> : null}
      <ActionButton label={submitLabel} variant="primary" disabled={disabled} onPress={onSubmit} theme={theme} />
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
        <View style={[styles.inventoryPickerIcon, { backgroundColor: theme.semantic[kind].softBg }]}>
          <MobileIcon name={kind === 'need' ? 'need' : 'offer'} size={18} color={theme.semantic[kind].text} />
        </View>
      </View>
      {item ? (
        <View style={styles.inventoryPickerSelectedBody}>
          <AppText style={styles.inventoryChoiceTitle} numberOfLines={2}>{item.title}</AppText>
          <AppText style={[styles.inventoryChoiceMeta, { color: theme.semantic[kind].text }]} numberOfLines={1}>{proposalInventoryMeta(kind, item, t)}</AppText>
          <AppText style={[styles.inventoryChoiceDescription, { color: theme.color.muted }]} numberOfLines={2}>{proposalInventoryDescription(item, t)}</AppText>
          <View style={styles.inventoryPickerActionRow}>
            <SemanticBadge label={t('trade.labels.selected')} tone={kind} size="sm" />
            <AppText style={[styles.inventoryPickerActionText, { color: theme.semantic.proposal.bg }]}>{t('common.actions.edit')}</AppText>
          </View>
        </View>
      ) : (
        <View style={styles.inventoryPickerEmptyBody}>
          <AppText style={[styles.muted, { color: theme.color.muted }]}>{count > 0 ? t('trade.proposals.chooseFromSavedItems', { count }) : emptyText}</AppText>
          <AppText style={[styles.inventoryPickerActionText, { color: theme.semantic.proposal.bg }]}>{t('trade.proposals.openPicker')}</AppText>
        </View>
      )}
    </Pressable>
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


function ThreadSplitSection({ publicMessageCount, privateProposalCount, role, hasMyProposal, onOpenPublic, onOpenPrivate, theme, t }: { publicMessageCount: number; privateProposalCount: number; role: DetailRole; hasMyProposal: boolean; onOpenPublic: () => void; onOpenPrivate: () => void; theme: ThemeTokens; t: TFunction }) {
  const privatePreview = role === 'owner'
    ? t('trade.threadSplit.privateOwnerPreview')
    : hasMyProposal
      ? t('trade.threadSplit.privateApplicantPreview')
      : t('trade.threadSplit.privateApplicantBody');
  return (
    <DetailSection eyebrow={t('trade.threadSplit.eyebrow')} title={t('trade.threadSplit.title')} description={t('trade.threadSplit.body')}>
      <View style={styles.threadActionGrid}>
        <ThreadActionCard
          title={t('trade.publicDiscussion.title')}
          body={t('trade.threadSplit.publicBody')}
          meta={publicMessageCount > 0 ? t('trade.publicDiscussion.messageCount', { count: publicMessageCount }) : t('trade.publicDiscussion.emptyTitle')}
          icon="dispute"
          tone="trade"
          onPress={onOpenPublic}
          theme={theme}
          t={t}
        />
        <ThreadActionCard
          title={t('trade.threadSplit.privateTitle')}
          body={privatePreview}
          meta={privateProposalCount > 0 ? t('trade.threadSplit.privateCount', { count: privateProposalCount }) : t('trade.proposals.noProposals')}
          icon="proposal"
          tone="proposal"
          onPress={onOpenPrivate}
          theme={theme}
          t={t}
        />
      </View>
    </DetailSection>
  );
}

function ThreadActionCard({ title, body, meta, icon, tone, onPress, theme, t }: { title: string; body: string; meta: string; icon: 'dispute' | 'proposal'; tone: 'trade' | 'proposal'; onPress: () => void; theme: ThemeTokens; t: TFunction }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.threadActionCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <View style={styles.threadActionTopRow}>
        <View style={[styles.threadActionIcon, { backgroundColor: theme.semantic[tone].softBg, borderColor: theme.semantic[tone].border }]}>
          <MobileIcon name={icon} size={21} color={theme.semantic[tone].text} />
        </View>
        <MobileIcon name="chevron-right" size={20} color={theme.color.muted} />
      </View>
      <View style={styles.threadActionCopy}>
        <AppText style={styles.threadActionTitle}>{title}</AppText>
        <AppText style={[styles.threadActionBody, { color: theme.color.muted }]}>{body}</AppText>
      </View>
      <View style={styles.threadActionFooter}>
        <AppText style={[styles.threadActionMeta, { color: theme.semantic[tone].text }]}>{meta}</AppText>
        <AppText style={[styles.threadActionOpen, { color: theme.semantic[tone].text }]}>{t('common.actions.open')}</AppText>
      </View>
    </Pressable>
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

function ProposalBlock({ proposal, currentUserId, onOpenThread, theme, t }: { proposal: TradeProposalItem; currentUserId?: string; onOpenThread: () => void; theme: ThemeTokens; t: TFunction }) {
  const isApplicant = proposal.applicantId === currentUserId;
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
      <Pressable accessibilityRole="button" onPress={onOpenThread} style={({ pressed }) => [styles.openThreadButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
        <AppText style={[styles.openThreadText, { color: theme.color.muted }]}>{t('trade.proposals.openPrivateThread')}</AppText>
      </Pressable>
    </View>
  );
}

function ProposalSideSummary({ proposal, theme, t }: { proposal: TradeProposalItem; theme: ThemeTokens; t: TFunction }) {
  const need = proposal.proposedNeed;
  const offer = proposal.proposedOffer;
  if (!need && !offer) return null;
  return (
    <View style={{ gap: 10 }}>
      {offer ? <InventoryPreviewCard item={offer} kind="offer" label={t('trade.labels.proposedOffer')} theme={theme} t={t} /> : null}
      {need ? <InventoryPreviewCard item={need} kind="need" label={t('trade.labels.proposedNeed')} theme={theme} t={t} /> : null}
    </View>
  );
}
function ActionButton({ label, variant, disabled, onPress, theme }: { label: string; variant: 'primary' | 'danger' | 'ghost'; disabled?: boolean; onPress: () => void; theme: ThemeTokens }) { const buttonStyle = variant === 'primary' ? { backgroundColor: theme.semantic.proposal.bg, borderColor: theme.semantic.proposal.bg } : variant === 'danger' ? { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border } : { backgroundColor: theme.color.surface, borderColor: theme.color.border }; const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? theme.semantic.danger.text : theme.color.text; return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, buttonStyle, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionButtonText, { color: textColor }]}>{label}</AppText></Pressable>; }

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 20 }, headerShareButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, hero: { gap: 10 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, title: { fontSize: 32, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { fontSize: 14, lineHeight: 20, fontWeight: '800' }, ownerLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, paymentLine: { fontSize: 15, lineHeight: 21, fontWeight: '900' }, separator: { height: 1, opacity: 0.72 }, section: { gap: 13 }, sectionEyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }, sectionTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.45 }, bodyCopy: { fontSize: 16, lineHeight: 23, fontWeight: '600' }, metaLine: { fontSize: 13, lineHeight: 18, fontWeight: '900' }, openSideInvite: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 8 }, emptyImages: { overflow: 'hidden', borderWidth: 1, borderRadius: 22, padding: 18, fontWeight: '800' }, singleImage: { width: '100%', height: 310, borderRadius: 24, backgroundColor: '#E2E8F0' }, imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, gridImageWrap: { width: '48.8%', height: 154, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E2E8F0' }, gridImageLargeFirst: { width: '100%', height: 214 }, gridImage: { width: '100%', height: '100%' }, moreOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)' }, moreOverlayText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' }, detailRows: { gap: 0 }, detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth }, detailLabel: { fontSize: 13, fontWeight: '800' }, detailValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '900', textTransform: 'capitalize' }, detailIdentity: { flex: 1, justifyContent: 'flex-end' }, actionStack: { gap: 10 }, actionRow: { flexDirection: 'row', gap: 10 }, composerBox: { gap: 12 }, proposalPromptBox: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 8 }, proposalPromptText: { lineHeight: 20, fontWeight: '800' }, messageComposerBlock: { gap: 8 }, textArea: { minHeight: 126, borderRadius: 20, borderWidth: 1, padding: 14, fontSize: 16, lineHeight: 22, fontWeight: '600' }, inventoryChoiceBox: { borderRadius: 22, borderWidth: 1, padding: 12, gap: 10 }, inventoryChoiceHeading: { gap: 7 }, inventoryEmptyBox: { borderRadius: 18, borderWidth: 1, padding: 12 }, inventoryChoiceRow: { borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, inventoryChoiceSelected: { borderWidth: 2 }, inventoryChoiceCopy: { flex: 1, gap: 5 }, inventoryChoiceTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, inventoryChoiceTitle: { flex: 1, fontSize: 16, lineHeight: 20, fontWeight: '900' }, inventoryChoiceMeta: { fontSize: 12, fontWeight: '900', lineHeight: 17 }, inventoryChoiceDescription: { fontSize: 12, lineHeight: 17, fontWeight: '700' }, inventoryPickerShortcut: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 12 }, inventoryPickerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, inventoryPickerHeading: { flex: 1, gap: 7 }, inventoryPickerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, inventoryPickerSelectedBody: { gap: 6 }, inventoryPickerEmptyBody: { gap: 8 }, inventoryPickerActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 }, inventoryPickerActionText: { fontWeight: '900' }, selectedSidePreview: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 7 }, selectedSideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectedSideTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' }, selectedSideMeta: { fontSize: 12, lineHeight: 17, fontWeight: '900' }, selectedSideDescription: { lineHeight: 20, fontWeight: '700' }, threadSplitHeader: { gap: 8 }, threadActionGrid: { gap: 12 }, threadActionCard: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 12 }, threadActionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, threadActionIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, threadActionCopy: { gap: 6 }, threadActionTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.35 }, threadActionBody: { lineHeight: 20, fontWeight: '700' }, threadActionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, threadActionMeta: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '900' }, threadActionOpen: { fontSize: 13, fontWeight: '900' }, proposalStack: { gap: 14 }, proposalBlock: { gap: 13, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth }, proposalHeader: { gap: 10 }, proposalHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, proposalIdentityLink: { flex: 1 }, proposalIdentity: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, proposalCopy: { flex: 1, gap: 5 }, proposalTitle: { fontSize: 16, fontWeight: '900' }, proposalMessage: { fontSize: 14, lineHeight: 20, fontWeight: '700' }, threadLabel: { fontSize: 13, fontWeight: '900' }, openThreadButton: { minHeight: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, openThreadText: { fontWeight: '900' }, muted: { lineHeight: 20, fontWeight: '700' }, actionButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 }, actionButtonText: { fontWeight: '900' }, disabledButton: { opacity: 0.52 }, ownerLineModern: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, ownerLabel: { fontSize: 13, fontWeight: '800' }, openSideBody: { gap: 8 }, openSideText: { fontSize: 15, lineHeight: 22, fontWeight: '700' }, imageEmptyState: { paddingVertical: 14 }, participantRows: { gap: 9 }, identityPill: { minHeight: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, identityPillLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }, inlineActionBar: { marginTop: 2, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
