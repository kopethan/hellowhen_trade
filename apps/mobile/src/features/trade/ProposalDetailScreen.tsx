import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AcceptedDealSnapshotItemDto, ProposalActionStatus, ReportTargetType, TradeActionStatus } from '@hellowhen/contracts';
import { formatLocalizedDateTime, type SupportedLanguage } from '@hellowhen/i18n';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppActionSheet, type AppActionSheetAction } from '../../components/AppActionSheet';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen, APP_SCREEN_HORIZONTAL_PADDING } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import { ReportContentPanel } from '../../components/ReportContentPanel';
import { MoneyPill, InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { ConversationComposerBar, DetailEmptyState, DetailMetadataChips, DetailSection } from '../../components/detail';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserIdentityPressable } from '../users/UserIdentityPressable';
import { MediaStrip } from './components/MediaStrip';
import { useLocalizedInventoryItem, useLocalizedInventoryItems } from './inventoryDisplay';
import type { NeedItem, OfferItem, ProposalMessageItem, TradeDeckItem, TradeProposalItem } from './types';
import { KEYBOARD_DONE_ACCESSORY_ID } from '../../components/KeyboardDoneAccessory';

type Props = NativeStackScreenProps<RootStackParamList, 'ProposalDetail'>;
type ProposalResponse = { proposal: TradeProposalItem; trade?: TradeDeckItem };
type TradeStatusResponse = { trade?: TradeDeckItem };
type DealProblemReportResponse = { proposal?: TradeProposalItem; trade?: TradeDeckItem; duplicate?: boolean };
type MessagesResponse = { messages: ProposalMessageItem[] };
type MessageMutationResponse = { message?: ProposalMessageItem; proposal?: TradeProposalItem };
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
type ProposalSideKind = 'need' | 'offer';
type RequiredProposalSide = ProposalSideKind | null;
type ProposalSideItem = NeedItem | OfferItem;
type DealAgreementItem = ProposalSideItem | AcceptedDealSnapshotItemDto;
type ActionLoading = ProposalActionStatus | TradeActionStatus | 'send' | 'proposal-note' | 'proposal-package' | 'delete-proposal-note' | 'message-edit' | 'message-delete' | 'cancel-trade' | 'deal-report' | null;
type ThreadInfoMode = 'menu' | 'proposal' | 'agreement' | 'progress' | null;
type ActiveThreadInfoMode = Exclude<ThreadInfoMode, null>;
type PrivateThreadReportTarget = { targetType: Extract<ReportTargetType, 'message' | 'proposal'>; targetId: string; titleKey: string; helperKey: string };
const PRIVATE_THREAD_POLL_INTERVAL_MS = 7000;

type ProposalActionSheet =
  | { type: 'status'; status: ProposalActionStatus }
  | { type: 'deal-status'; status: Extract<TradeActionStatus, 'submitted' | 'completed'> }
  | { type: 'message-options'; message: ProposalMessageItem; canEdit: boolean; canReport: boolean }
  | { type: 'delete-message'; messageId: string }
  | { type: 'proposal-note-options'; canEdit: boolean; canReport: boolean }
  | { type: 'delete-proposal-note' }
  | null;

function modeLabel(mode: string | null | undefined, t: TFunction) {
  if (mode === 'remote') return t('trade.modes.remote');
  if (mode === 'local') return t('trade.modes.local');
  if (mode === 'hybrid') return t('trade.modes.hybrid');
  return null;
}

function compactList(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(' · ');
}

function proposalSideMeta(kind: ProposalSideKind, item: ProposalSideItem, t: TFunction) {
  if (kind === 'need') {
    const need = item as NeedItem;
    return compactList([need.category, need.timing, modeLabel(need.mode, t), need.locationLabel]) || need.itemType || t('trade.labels.needDetails');
  }
  const offer = item as OfferItem;
  return compactList([offer.category, offer.includes?.[0], offer.availability, modeLabel(offer.mode, t), offer.locationLabel]) || offer.itemType || t('trade.labels.offerDetails');
}

function proposalSideDescription(item: ProposalSideItem, t: TFunction) {
  return item.description?.trim() || t('trade.labels.noDescription');
}

function isNeedAvailable(need: NeedItem) { return need.status === 'active'; }
function isOfferAvailable(offer: OfferItem) { return offer.status === 'active'; }
function requiredProposalSideForTrade(trade: TradeDeckItem | undefined): RequiredProposalSide {
  if (trade?.postType === 'open_need' && !trade.offerId) return 'offer';
  if (trade?.postType === 'open_offer' && !trade.needId) return 'need';
  return null;
}

function formatStatus(status: string, t: TFunction) {
  const label = t(`trade.statuses.${status}`);
  return label === `trade.statuses.${status}` ? status.replace(/_/g, ' ') : label;
}

function formatTraceDate(value: string | null | undefined, language: SupportedLanguage) {
  return formatLocalizedDateTime(value, language, '-');
}

function formatEditTrace(count: number | undefined, date: string | null | undefined, language: SupportedLanguage, t: TFunction) {
  if (!date) return '';
  return t('trade.proposals.editedCountAt', { count: Math.max(1, count ?? 1), date: formatTraceDate(date, language) });
}

function formatDeletedTrace(date: string | null | undefined, language: SupportedLanguage, t: TFunction) {
  if (!date) return '';
  return t('trade.proposals.messageDeletedAt', { date: formatTraceDate(date, language) });
}

function proposalSideItems(proposal: TradeProposalItem) {
  const items: Array<{ kind: ProposalSideKind; item: ProposalSideItem }> = [];
  if (proposal.proposedOffer) items.push({ kind: 'offer', item: proposal.proposedOffer as OfferItem });
  if (proposal.proposedNeed) items.push({ kind: 'need', item: proposal.proposedNeed as NeedItem });
  return items;
}

function proposalPackageTitle(proposal: TradeProposalItem, t: TFunction) {
  if (proposal.proposedNeed && proposal.proposedOffer) return t('trade.proposals.needOfferProposal');
  if (proposal.proposedNeed) return t('trade.proposals.needProposal');
  if (proposal.proposedOffer) return t('trade.proposals.offerProposal');
  if (proposal.cashPromise) return t('trade.cashPromise.title');
  return t('trade.proposals.tradeRequest');
}

function isThreadClosed(proposal: TradeProposalItem | null) {
  if (!proposal) return true;
  return ['declined', 'withdrawn'].includes(proposal.status) || ['cancelled', 'closed'].includes(proposal.trade?.status ?? '');
}

function isTradeCancelled(proposal: TradeProposalItem | null) {
  return proposal?.trade?.status === 'cancelled';
}


function uniqueInventoryItems(items: Array<ProposalSideItem | null | undefined>) {
  const seen = new Set<string>();
  return items.filter((item): item is ProposalSideItem => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isAcceptedDealSnapshotItem(item: DealAgreementItem): item is AcceptedDealSnapshotItemDto {
  return 'kind' in item && (item.kind === 'need' || item.kind === 'offer' || item.kind === 'cash_promise');
}

function formatMoneyAmount(amountCents?: number, currency = 'eur') {
  return `${currency.toUpperCase()} ${((amountCents ?? 0) / 100).toFixed(2)}`;
}

function liveCashPromiseItem(proposal: TradeProposalItem, ownerId: string | null): AcceptedDealSnapshotItemDto | null {
  const cashPromise = proposal.cashPromise;
  if (!cashPromise) return null;
  const giverId = cashPromise.side === 'offer' ? proposal.applicantId : ownerId;
  if (!giverId) return null;
  return {
    kind: 'cash_promise',
    id: cashPromise.id,
    ownerId: giverId,
    title: 'Cash promise',
    description: cashPromise.note ?? '',
    itemType: 'other',
    category: 'Cash promise',
    mode: null,
    locationLabel: null,
    tags: [],
    status: 'accepted',
    source: 'proposal',
    side: cashPromise.side,
    amountCents: cashPromise.amountCents,
    currency: cashPromise.currency ?? 'eur',
    note: cashPromise.note ?? null,
    acknowledgementText: cashPromise.acknowledgementText,
    snapshottedAt: cashPromise.createdAt,
  };
}

function dealAgreementMeta(item: DealAgreementItem, fallbackKind: ProposalSideKind, t: TFunction) {
  if (isAcceptedDealSnapshotItem(item)) {
    if (item.kind === 'cash_promise') {
      return compactList([formatMoneyAmount(item.amountCents, item.currency), t('trade.cashPromise.notProcessed')]);
    }
    const mode = modeLabel(item.mode, t);
    if (item.kind === 'need') {
      return compactList([item.category, item.timing, mode, item.locationLabel]) || item.itemType || t('trade.labels.needDetails');
    }
    return compactList([item.category, item.includes?.[0], item.availability, mode, item.locationLabel]) || item.itemType || t('trade.labels.offerDetails');
  }
  return proposalSideMeta(fallbackKind, item, t);
}

function acceptedDealAgreement(proposal: TradeProposalItem) {
  const snapshot = proposal.acceptedDealSnapshot;
  if (snapshot) {
    return {
      ownerGives: snapshot.ownerGivesJson ?? [],
      ownerReceives: snapshot.ownerReceivesJson ?? [],
      applicantGives: snapshot.applicantGivesJson ?? [],
      applicantReceives: snapshot.applicantReceivesJson ?? [],
      acceptedMessage: snapshot.acceptedMessage ?? null,
      snapshotCreatedAt: snapshot.createdAt ?? null,
      fromSnapshot: true,
    };
  }

  const trade = proposal.trade;
  const ownerId = trade?.ownerId ?? null;
  const applicantId = proposal.applicantId;
  const needs = uniqueInventoryItems([trade?.need as NeedItem | undefined, proposal.proposedNeed as NeedItem | undefined]) as NeedItem[];
  const offers = uniqueInventoryItems([trade?.offer as OfferItem | undefined, proposal.proposedOffer as OfferItem | undefined]) as OfferItem[];
  const cashPromise = liveCashPromiseItem(proposal, ownerId);
  const ownerGivesCash = cashPromise && cashPromise.ownerId === ownerId ? [cashPromise] : [];
  const applicantGivesCash = cashPromise && cashPromise.ownerId === applicantId ? [cashPromise] : [];

  return {
    ownerGives: [...offers.filter((offer) => offer.ownerId === ownerId), ...ownerGivesCash],
    ownerReceives: [...needs.filter((need) => need.ownerId === ownerId), ...applicantGivesCash],
    applicantGives: [...offers.filter((offer) => offer.ownerId === applicantId), ...applicantGivesCash],
    applicantReceives: [...needs.filter((need) => need.ownerId === applicantId), ...ownerGivesCash],
    acceptedMessage: proposal.messageDeletedAt ? null : proposal.message,
    snapshotCreatedAt: null,
    fromSnapshot: false,
  };
}

function dealStepState(tradeStatus: string | null | undefined, step: 'accepted' | 'in_progress' | 'submitted' | 'completed') {
  if (tradeStatus === 'cancelled' || tradeStatus === 'disputed') return step === 'accepted' ? 'done' : 'pending';
  const order = ['accepted', 'in_progress', 'submitted', 'completed'];
  const statusIndex = tradeStatus === 'completed'
    ? 3
    : tradeStatus === 'submitted'
      ? 2
      : tradeStatus === 'in_progress'
        ? 1
        : 0;
  const stepIndex = order.indexOf(step);
  if (stepIndex < statusIndex) return 'done';
  if (stepIndex === statusIndex) return 'current';
  return 'pending';
}

function firstNonDeletedMessages(messages: ProposalMessageItem[], proposal: TradeProposalItem) {
  return messages.filter((message) => !(message.senderId === proposal.applicantId && (message.body.trim() === proposal.message.trim() || Boolean(proposal.messageDeletedAt && message.deletedAt))));
}

export function ProposalDetailScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const [proposal, setProposal] = useState<TradeProposalItem | null>(null);
  const [messages, setMessages] = useState<ProposalMessageItem[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [threadInfoMode, setThreadInfoMode] = useState<ThreadInfoMode>(null);
  const [scrolledCompact, setScrolledCompact] = useState(false);
  const [proposalNeeds, setProposalNeeds] = useState<NeedItem[]>([]);
  const [proposalOffers, setProposalOffers] = useState<OfferItem[]>([]);
  const [packageNeedId, setPackageNeedId] = useState('');
  const [packageOfferId, setPackageOfferId] = useState('');
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [editingProposalNote, setEditingProposalNote] = useState(false);
  const [proposalNoteDraft, setProposalNoteDraft] = useState('');
  const [proposalNoteError, setProposalNoteError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageEditError, setMessageEditError] = useState<string | null>(null);
  const [cancelTradeOpen, setCancelTradeOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [problemReportOpen, setProblemReportOpen] = useState(false);
  const [threadGuideOpen, setThreadGuideOpen] = useState(false);
  const [messageReportTarget, setMessageReportTarget] = useState<PrivateThreadReportTarget | null>(null);
  const [problemSummary, setProblemSummary] = useState('');
  const [problemError, setProblemError] = useState<string | null>(null);
  const [actionSheet, setActionSheet] = useState<ProposalActionSheet>(null);
  const loadRequestIdRef = useRef(0);
  const pollingInFlightRef = useRef(false);
  const threadFocusedRef = useRef(false);

  const loadMessages = useCallback(async () => {
    const messageResult = await api.proposals.messages(route.params.proposalId) as MessagesResponse;
    setMessages(messageResult.messages ?? []);
  }, [route.params.proposalId]);

  const loadProposal = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const result = await api.proposals.get(route.params.proposalId) as ProposalResponse;
      if (requestId !== loadRequestIdRef.current) return;
      setProposal(result.proposal);
      setPackageNeedId(route.params.selectedProposalNeedId ?? result.proposal.proposedNeedId ?? result.proposal.proposedNeed?.id ?? '');
      setPackageOfferId(route.params.selectedProposalOfferId ?? result.proposal.proposedOfferId ?? result.proposal.proposedOffer?.id ?? '');
      setMessages(result.proposal.messages ?? []);
      try { await loadMessages(); } catch { /* keep proposal-attached messages if the standalone list fails */ }
    } catch (caughtError) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotLoadProposal')));
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [loadMessages, route.params.proposalId, route.params.selectedProposalNeedId, route.params.selectedProposalOfferId, t]);

  useEffect(() => { void loadProposal(); }, [loadProposal]);

  const actorId = auth.user?.id ?? null;
  const isOwner = proposal?.trade?.ownerId === actorId;
  const isApplicant = proposal?.applicantId === actorId;
  const isProvider = Boolean(actorId && proposal?.trade?.providerId === actorId);
  const threadClosed = isThreadClosed(proposal);
  const tradeCancelled = isTradeCancelled(proposal);
  const canMessage = Boolean(proposal && (isOwner || isApplicant || isProvider) && !threadClosed);
  const canEditProposalContent = Boolean(proposal && isApplicant && proposal.status === 'pending' && !tradeCancelled);
  const canReportProposalNote = Boolean(proposal && actorId && proposal.applicantId !== actorId && !proposal.messageDeletedAt && (isOwner || isApplicant || isProvider));
  const canEditOwnPrivateMessages = Boolean(proposal && (isOwner || isApplicant || isProvider) && !threadClosed);
  const canMarkSubmitted = Boolean(proposal && proposal.status === 'accepted' && proposal.trade?.status === 'in_progress' && isProvider);
  const canConfirmCompleted = Boolean(proposal && proposal.status === 'accepted' && proposal.trade?.status === 'submitted' && (isOwner || isApplicant || isProvider) && proposal.trade?.deliverySubmittedById !== actorId);
  const canReportDealProblem = Boolean(proposal && proposal.status === 'accepted' && ['in_progress', 'submitted'].includes(proposal.trade?.status ?? '') && (isOwner || isApplicant || isProvider));
  const canCancelAcceptedTrade = Boolean(proposal && proposal.status === 'accepted' && ['in_progress', 'submitted'].includes(proposal.trade?.status ?? '') && (isOwner || isApplicant || isProvider));
  const requiredPackageSide = requiredProposalSideForTrade(proposal?.trade);

  const loadProposalInventory = useCallback(async () => {
    setPackageLoading(true);
    setPackageError(null);
    try {
      const [needsResult, offersResult] = await Promise.all([api.needs.mine() as Promise<NeedsResponse>, api.offers.mine() as Promise<OffersResponse>]);
      setProposalNeeds(Array.isArray(needsResult.needs) ? needsResult.needs : []);
      setProposalOffers(Array.isArray(offersResult.offers) ? offersResult.offers : []);
    } catch (caughtError) {
      setPackageError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotLoadInventory')));
    } finally {
      setPackageLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let appliedBundledSelection = false;
    if (typeof route.params.selectedProposalNeedId === 'string') {
      setPackageNeedId(route.params.selectedProposalNeedId);
      appliedBundledSelection = true;
    }
    if (typeof route.params.selectedProposalOfferId === 'string') {
      setPackageOfferId(route.params.selectedProposalOfferId);
      appliedBundledSelection = true;
    }
    if (appliedBundledSelection) return;

    const selection = route.params.selectedProposalSide;
    if (!selection || selection.kind === 'money') return;
    if (selection.kind === 'need') setPackageNeedId(selection.id);
    if (selection.kind === 'offer') setPackageOfferId(selection.id);
  }, [route.params.selectedProposalNeedId, route.params.selectedProposalOfferId, route.params.selectedProposalSide]);

  useEffect(() => {
    if (!canEditProposalContent) return;
    void loadProposalInventory();
  }, [canEditProposalContent, loadProposalInventory]);

  const availablePackageNeeds = useMemo(() => proposalNeeds.filter(isNeedAvailable), [proposalNeeds]);
  const availablePackageOffers = useMemo(() => proposalOffers.filter(isOfferAvailable), [proposalOffers]);
  const activePackageNeeds = useLocalizedInventoryItems(availablePackageNeeds);
  const activePackageOffers = useLocalizedInventoryItems(availablePackageOffers);
  const rawSelectedPackageNeed = useMemo(() => activePackageNeeds.find((need) => need.id === packageNeedId) ?? (proposal?.proposedNeed?.id === packageNeedId ? proposal.proposedNeed as NeedItem : null), [activePackageNeeds, packageNeedId, proposal?.proposedNeed]);
  const rawSelectedPackageOffer = useMemo(() => activePackageOffers.find((offer) => offer.id === packageOfferId) ?? (proposal?.proposedOffer?.id === packageOfferId ? proposal.proposedOffer as OfferItem : null), [activePackageOffers, packageOfferId, proposal?.proposedOffer]);
  const selectedPackageNeed = useLocalizedInventoryItem(rawSelectedPackageNeed);
  const selectedPackageOffer = useLocalizedInventoryItem(rawSelectedPackageOffer);
  const packageChanged = Boolean(proposal && ((proposal.proposedNeedId ?? proposal.proposedNeed?.id ?? '') !== packageNeedId || (proposal.proposedOfferId ?? proposal.proposedOffer?.id ?? '') !== packageOfferId));

  const visibleMessages = useMemo(() => proposal ? firstNonDeletedMessages(messages, proposal) : messages, [messages, proposal]);
  const statusHint = useMemo(() => {
    if (!proposal) return '';
    if (tradeCancelled) return t('trade.proposals.cancelledConversationClosed');
    if (proposal.status === 'pending') return isOwner ? t('trade.proposals.ownerPendingHint') : t('trade.proposals.applicantPendingHint');
    if (proposal.status === 'accepted') return t('trade.proposals.acceptedHint');
    if (proposal.status === 'declined') return t('trade.proposals.declinedHint');
    return t('trade.proposals.withdrawnHint');
  }, [proposal, tradeCancelled, isOwner, t]);

  const refreshConversation = useCallback(async () => {
    const result = await api.proposals.get(route.params.proposalId) as ProposalResponse;
    setProposal(result.proposal);
    await loadMessages();
  }, [loadMessages, route.params.proposalId]);

  const pollConversation = useCallback(async () => {
    if (!threadFocusedRef.current || !proposal?.id || pollingInFlightRef.current || actionLoading) return;
    pollingInFlightRef.current = true;
    try {
      await refreshConversation();
    } catch {
      // Keep polling silent. Pull-to-refresh and explicit actions still surface errors.
    } finally {
      pollingInFlightRef.current = false;
    }
  }, [actionLoading, proposal?.id, refreshConversation]);

  useFocusEffect(useCallback(() => {
    threadFocusedRef.current = true;
    void pollConversation();
    const intervalId = setInterval(() => { void pollConversation(); }, PRIVATE_THREAD_POLL_INTERVAL_MS);
    return () => {
      threadFocusedRef.current = false;
      clearInterval(intervalId);
    };
  }, [pollConversation]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pollConversation();
    });
    return () => subscription.remove();
  }, [pollConversation]);

  async function sendMessage() {
    if (actionLoading) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setActionLoading('send');
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.sendMessage(route.params.proposalId, { body: trimmed }) as MessageMutationResponse;
      if (result.proposal) setProposal(result.proposal);
      setBody('');
      await loadMessages();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotSendMessage')));
    } finally {
      setActionLoading(null);
    }
  }

  async function updateStatus(status: ProposalActionStatus) {
    if (actionLoading) return;
    setActionLoading(status);
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.updateStatus(route.params.proposalId, { status }) as ProposalResponse;
      setProposal(result.proposal);
      if (result.proposal.messages) setMessages(result.proposal.messages);
      setNotice(status === 'accepted' ? t('trade.proposals.proposalAcceptedNative') : status === 'declined' ? t('trade.proposals.proposalDeclined') : t('trade.proposals.proposalWithdrawn'));
      setActionSheet(null);
      setThreadInfoMode(null);
      setCancelTradeOpen(false);
      setCancelReason('');
      setCancelError(null);
      try { await loadMessages(); } catch { /* proposal response is still useful */ }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotUpdateProposal')));
    } finally {
      setActionLoading(null);
    }
  }

  function confirmStatus(status: ProposalActionStatus) {
    if (status === 'accepted' || status === 'declined' || status === 'withdrawn') {
      setActionSheet({ type: 'status', status });
      return;
    }
    void updateStatus(status);
  }

  function openPackagePicker(side: ProposalSideKind) {
    if (!proposal) return;
    navigation.navigate('TradeSidePicker', {
      side,
      selection: side === 'need'
        ? (packageNeedId ? { side: 'need', kind: 'need', id: packageNeedId } : null)
        : (packageOfferId ? { side: 'offer', kind: 'offer', id: packageOfferId } : null),
      returnTo: 'proposalDetail',
      proposalId: proposal.id,
      tradeTitle: proposal.trade?.title,
      proposalNeedId: packageNeedId,
      proposalOfferId: packageOfferId,
    });
  }

  async function saveProposalPackage() {
    if (!proposal || actionLoading) return;
    setActionLoading('proposal-package');
    setError(null);
    setPackageError(null);
    setNotice(null);
    try {
      const result = await api.proposals.updateMessage(proposal.id, {
        proposedNeedId: packageNeedId || null,
        proposedOfferId: packageOfferId || null,
      }) as ProposalResponse;
      setProposal(result.proposal);
      setPackageNeedId(result.proposal.proposedNeedId ?? result.proposal.proposedNeed?.id ?? '');
      setPackageOfferId(result.proposal.proposedOfferId ?? result.proposal.proposedOffer?.id ?? '');
      setNotice(t('trade.proposals.proposalUpdated'));
      await loadMessages();
    } catch (caughtError) {
      setPackageError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotUpdateProposal')));
    } finally {
      setActionLoading(null);
    }
  }

  function startProposalNoteEdit() {
    if (!proposal) return;
    setProposalNoteDraft(proposal.messageDeletedAt ? '' : proposal.message ?? '');
    setProposalNoteError(null);
    setEditingProposalNote(true);
  }

  async function saveProposalNote() {
    if (!proposal || actionLoading) return;
    const trimmed = proposalNoteDraft.trim();
    if (trimmed.length < 3) {
      setProposalNoteError(t('trade.proposals.messageTooShort'));
      return;
    }
    setActionLoading('proposal-note');
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.updateMessage(route.params.proposalId, { message: trimmed }) as ProposalResponse;
      setProposal(result.proposal);
      setEditingProposalNote(false);
      setProposalNoteDraft('');
      setProposalNoteError(null);
      setNotice(t('trade.proposals.proposalUpdated'));
      await loadMessages();
    } catch (caughtError) {
      setProposalNoteError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotUpdateProposal')));
    } finally {
      setActionLoading(null);
    }
  }

  function confirmDeleteProposalNote() {
    setActionSheet({ type: 'delete-proposal-note' });
  }

  async function deleteProposalNote() {
    if (actionLoading) return;
    setActionLoading('delete-proposal-note');
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.deleteMessage(route.params.proposalId) as ProposalResponse;
      setProposal(result.proposal);
      setEditingProposalNote(false);
      setProposalNoteDraft('');
      setNotice(t('trade.proposals.proposalNoteDeleted'));
      setActionSheet(null);
      await loadMessages();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotUpdateProposal')));
    } finally {
      setActionLoading(null);
    }
  }

  function startMessageEdit(message: ProposalMessageItem) {
    setEditingMessageId(message.id);
    setMessageDraft(message.body);
    setMessageEditError(null);
  }

  async function saveMessageEdit(messageId: string) {
    if (actionLoading) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) {
      setMessageEditError(t('trade.proposals.messageEditRequired'));
      return;
    }
    setActionLoading('message-edit');
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.updatePrivateMessage(route.params.proposalId, messageId, { body: trimmed }) as MessageMutationResponse;
      if (result.proposal) setProposal(result.proposal);
      setEditingMessageId(null);
      setMessageDraft('');
      setMessageEditError(null);
      await loadMessages();
    } catch (caughtError) {
      setMessageEditError(getFriendlyApiErrorMessage(caughtError, t('trade.proposals.couldNotUpdateMessage')));
    } finally {
      setActionLoading(null);
    }
  }

  function confirmDeletePrivateMessage(messageId: string) {
    setActionSheet({ type: 'delete-message', messageId });
  }

  function openMessageOptions(message: ProposalMessageItem) {
    const canEdit = message.senderId === actorId && canEditOwnPrivateMessages && !message.deletedAt;
    const canReport = Boolean(actorId && message.senderId !== actorId && !message.deletedAt);
    if (!canEdit && !canReport) return;
    setActionSheet({ type: 'message-options', message, canEdit, canReport });
  }

  function openProposalNoteOptions() {
    if (!canEditProposalContent && !canReportProposalNote) return;
    setActionSheet({ type: 'proposal-note-options', canEdit: canEditProposalContent, canReport: canReportProposalNote });
  }

  function openPrivateMessageReport(messageId: string) {
    setActionSheet(null);
    setMessageReportTarget({ targetType: 'message', targetId: messageId, titleKey: 'trade.proposals.reportMessageTitle', helperKey: 'report.helper.privateMessage' });
  }

  function openProposalNoteReport() {
    if (!proposal) return;
    setActionSheet(null);
    setMessageReportTarget({ targetType: 'proposal', targetId: proposal.id, titleKey: 'trade.proposals.reportProposalNoteTitle', helperKey: 'report.helper.proposalMessage' });
  }

  async function deletePrivateMessage(messageId: string) {
    if (actionLoading) return;
    setActionLoading('message-delete');
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.deletePrivateMessage(route.params.proposalId, messageId) as MessageMutationResponse;
      if (result.proposal) setProposal(result.proposal);
      setActionSheet(null);
      await loadMessages();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.proposals.couldNotUpdateMessage')));
    } finally {
      setActionLoading(null);
    }
  }

  async function updateAcceptedTradeStatus(status: TradeActionStatus) {
    if (!proposal?.trade?.id || actionLoading) return;
    setActionLoading(status);
    setError(null);
    setNotice(null);
    try {
      const result = await api.trades.updateStatus(proposal.trade.id, { status }) as TradeStatusResponse;
      if (result.trade) setProposal((current) => current ? { ...current, trade: result.trade } : current);
      setNotice(status === 'submitted' ? t('trade.detail.deliveryMarked') : status === 'completed' ? t('trade.detail.tradeConfirmed') : status === 'disputed' ? t('trade.detail.tradeReported') : t('trade.detail.tradeUpdated'));
      await refreshConversation();
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.detail.couldNotUpdateNative')));
    } finally {
      setActionLoading(null);
    }
  }

  async function submitDealProblemReport() {
    if (!proposal || actionLoading) return;
    const details = problemSummary.trim();
    setProblemError(null);
    if (details.length < 3) {
      setProblemError(t('trade.deal.problemReportSummaryRequired'));
      return;
    }
    setActionLoading('deal-report');
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.reportProblem(proposal.id, { reason: 'other', details }) as DealProblemReportResponse;
      if (result.proposal) setProposal(result.proposal);
      else if (result.trade) setProposal((current) => current ? { ...current, trade: result.trade } : current);
      setProblemReportOpen(false);
      setProblemSummary('');
      setProblemError(null);
      setNotice(result.duplicate ? t('trade.deal.problemReportUpdated') : t('trade.deal.problemReportSent'));
      await refreshConversation();
    } catch (caughtError) {
      setProblemError(getFriendlyApiErrorMessage(caughtError, t('trade.deal.problemReportCouldNotSend')));
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelAcceptedTrade() {
    if (!proposal?.trade?.id || actionLoading) return;
    const reason = cancelReason.trim();
    setCancelError(null);
    if (reason.length < 3) {
      setCancelError(t('trade.proposals.cancelReasonRequired'));
      return;
    }
    setActionLoading('cancel-trade');
    setError(null);
    setNotice(null);
    try {
      await api.trades.updateStatus(proposal.trade.id, { status: 'cancelled', cancelReason: reason });
      setCancelTradeOpen(false);
      setCancelReason('');
      setCancelError(null);
      setThreadInfoMode(null);
      setNotice(t('trade.proposals.tradeCancelled'));
      await refreshConversation();
    } catch (caughtError) {
      setCancelError(getFriendlyApiErrorMessage(caughtError, t('trade.proposals.couldNotCancelTrade')));
    } finally {
      setActionLoading(null);
    }
  }

  function confirmDealStatus(status: Extract<TradeActionStatus, 'submitted' | 'completed'>) {
    if (actionLoading) return;
    setActionSheet({ type: 'deal-status', status });
  }

  function getActionSheetConfig(): { title: string; body?: string; actions: AppActionSheetAction[] } {
    if (!actionSheet) return { title: '', actions: [] };

    if (actionSheet.type === 'status') {
      const status = actionSheet.status;
      if (status === 'accepted') {
        return {
          title: t('trade.proposals.acceptConfirmTitle'),
          body: t('trade.proposals.acceptConfirmBody'),
          actions: [{ key: 'accept', label: t('trade.proposals.accept'), icon: 'proposal-accepted', tone: 'primary', disabled: Boolean(actionLoading), onPress: () => { void updateStatus('accepted'); } }],
        };
      }
      if (status === 'declined') {
        return {
          title: t('trade.proposals.declineConfirmTitle'),
          body: t('trade.proposals.declineConfirmBody'),
          actions: [{ key: 'decline', label: t('trade.proposals.decline'), icon: 'proposal-declined', tone: 'danger', disabled: Boolean(actionLoading), onPress: () => { void updateStatus('declined'); } }],
        };
      }
      return {
        title: t('trade.proposals.withdrawConfirmTitle'),
        body: t('trade.proposals.withdrawConfirmBody'),
        actions: [{ key: 'withdraw', label: t('trade.proposals.withdrawConfirmAction'), icon: 'proposal-declined', tone: 'danger', disabled: Boolean(actionLoading), onPress: () => { void updateStatus('withdrawn'); } }],
      };
    }

    if (actionSheet.type === 'deal-status') {
      const status = actionSheet.status;
      if (status === 'submitted') {
        return {
          title: t('trade.deal.markSubmittedConfirmTitle'),
          body: t('trade.deal.markSubmittedConfirmBody'),
          actions: [{ key: 'mark-submitted', label: t('trade.deal.markSubmittedConfirmAction'), icon: 'proposal-accepted', tone: 'primary', disabled: Boolean(actionLoading), onPress: () => { setActionSheet(null); void updateAcceptedTradeStatus('submitted'); } }],
        };
      }
      return {
        title: t('trade.deal.confirmCompletedConfirmTitle'),
        body: t('trade.deal.confirmCompletedConfirmBody'),
        actions: [{ key: 'confirm-completed', label: t('trade.deal.confirmCompletedConfirmAction'), icon: 'proposal-accepted', tone: 'primary', disabled: Boolean(actionLoading), onPress: () => { setActionSheet(null); void updateAcceptedTradeStatus('completed'); } }],
      };
    }

    if (actionSheet.type === 'message-options') {
      const message = actionSheet.message;
      const actions: AppActionSheetAction[] = [];
      if (actionSheet.canEdit) {
        actions.push(
          { key: 'edit', label: t('trade.proposals.editMessage'), icon: 'more', onPress: () => { startMessageEdit(message); setActionSheet(null); } },
          { key: 'delete', label: t('trade.proposals.deleteMessage'), icon: 'report-flag', tone: 'danger', onPress: () => setActionSheet({ type: 'delete-message', messageId: message.id }) },
        );
      }
      if (actionSheet.canReport) {
        actions.push({ key: 'report', label: t('trade.proposals.reportMessage'), icon: 'report-flag', tone: 'danger', onPress: () => openPrivateMessageReport(message.id) });
      }
      return {
        title: t('trade.proposals.messageOptions'),
        actions,
      };
    }

    if (actionSheet.type === 'delete-message') {
      const messageId = actionSheet.messageId;
      return {
        title: t('trade.proposals.deleteMessageTitle'),
        body: t('trade.proposals.deleteMessageBody'),
        actions: [{ key: 'confirm-delete', label: t('trade.proposals.deleteMessageAction'), icon: 'report-flag', tone: 'danger', disabled: Boolean(actionLoading), onPress: () => { void deletePrivateMessage(messageId); } }],
      };
    }

    if (actionSheet.type === 'proposal-note-options') {
      const actions: AppActionSheetAction[] = [];
      if (actionSheet.canEdit) {
        actions.push({ key: 'edit-note', label: proposal?.messageDeletedAt ? t('trade.proposals.addProposalNote') : t('trade.proposals.editProposal'), icon: 'more', onPress: () => { startProposalNoteEdit(); setActionSheet(null); } });
        if (!proposal?.messageDeletedAt) {
          actions.push({ key: 'delete-note', label: t('trade.proposals.deleteProposalNote'), icon: 'report-flag', tone: 'danger', onPress: () => setActionSheet({ type: 'delete-proposal-note' }) });
        }
      }
      if (actionSheet.canReport) {
        actions.push({ key: 'report-note', label: t('trade.proposals.reportProposalNote'), icon: 'report-flag', tone: 'danger', onPress: openProposalNoteReport });
      }
      return { title: t('trade.proposals.proposalNote'), actions };
    }

    return {
      title: t('trade.proposals.deleteProposalNoteTitle'),
      body: t('trade.proposals.deleteProposalNoteBody'),
      actions: [{ key: 'confirm-delete-note', label: t('trade.proposals.deleteProposalNoteAction'), icon: 'report-flag', tone: 'danger', disabled: Boolean(actionLoading), onPress: () => { void deleteProposalNote(); } }],
    };
  }


  const actionSheetConfig = getActionSheetConfig();

  const baseHeaderTitle = proposal?.status === 'accepted' ? t('trade.deal.title') : t('trade.proposals.proposalThread');
  const headerTitle = scrolledCompact && proposal ? `${baseHeaderTitle} · ${formatStatus(proposal.status, t)}` : baseHeaderTitle;

  function openTradeDetailFromThread() {
    if (!proposal?.trade?.id) return;
    setThreadInfoMode(null);
    navigation.navigate('TradeDetail', { tradeId: proposal.trade.id, title: proposal.trade.title, description: proposal.trade.description, amountCents: proposal.trade.amountCents ?? 0, currency: proposal.trade.currency ?? 'eur', creditAmount: proposal.trade.creditAmount, status: proposal.trade.status, expiresAt: proposal.trade.expiresAt ?? null });
  }

  if (threadGuideOpen) {
    return (
      <AppScreen style={styles.screen}>
        <View style={styles.infoScreenRoot}>
          <AppHeader title={t('trade.proposals.guideTitle')} onBack={() => setThreadGuideOpen(false)} />
          <ScrollView contentContainerStyle={styles.infoScreenContent}>
            <PrivateThreadGuide t={t} />
          </ScrollView>
        </View>
      </AppScreen>
    );
  }

  if (messageReportTarget) {
    return (
      <AppScreen style={styles.screen}>
        <View style={styles.infoScreenRoot}>
          <AppHeader title={t(messageReportTarget.titleKey)} onBack={() => setMessageReportTarget(null)} />
          <ScrollView contentContainerStyle={styles.infoScreenContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <ReportContentPanel targetType={messageReportTarget.targetType} targetId={messageReportTarget.targetId} helperKey={messageReportTarget.helperKey} initialOpen />
          </ScrollView>
        </View>
      </AppScreen>
    );
  }

  if (proposal && threadInfoMode) {
    return (
      <AppScreen style={styles.screen}>
        <ProposalThreadInfoScreen
          mode={threadInfoMode}
          proposal={proposal}
          requiredPackageSide={requiredPackageSide}
          selectedPackageNeed={selectedPackageNeed}
          selectedPackageOffer={selectedPackageOffer}
          packageLoading={packageLoading}
          packageError={packageError}
          packageChanged={packageChanged}
          canEditProposalContent={canEditProposalContent}
          canCancelAcceptedTrade={canCancelAcceptedTrade}
          canMarkSubmitted={canMarkSubmitted}
          canConfirmCompleted={canConfirmCompleted}
          canReportDealProblem={canReportDealProblem}
          isOwner={Boolean(isOwner)}
          isApplicant={Boolean(isApplicant)}
          isProvider={Boolean(isProvider)}
          editingProposalNote={editingProposalNote}
          proposalNoteDraft={proposalNoteDraft}
          proposalNoteError={proposalNoteError}
          cancelTradeOpen={cancelTradeOpen}
          cancelReason={cancelReason}
          cancelError={cancelError}
          actionLoading={actionLoading}
          actorId={actorId}
          language={language}
          onClose={() => setThreadInfoMode(null)}
          onOpenMode={setThreadInfoMode}
          onOpenTradeDetail={openTradeDetailFromThread}
          onOpenGuide={() => setThreadGuideOpen(true)}
          onReportThread={() => { if (proposal?.id) setMessageReportTarget({ targetType: 'proposal', targetId: proposal.id, titleKey: 'trade.proposals.reportThreadTitle', helperKey: 'report.helper.proposalMessage' }); }}
          onChooseNeed={() => openPackagePicker('need')}
          onChooseOffer={() => openPackagePicker('offer')}
          onClearNeed={() => setPackageNeedId('')}
          onClearOffer={() => setPackageOfferId('')}
          onSavePackage={() => { void saveProposalPackage(); }}
          onStartProposalNoteEdit={startProposalNoteEdit}
          onChangeProposalNote={(text) => { setProposalNoteDraft(text); if (proposalNoteError) setProposalNoteError(null); }}
          onSaveProposalNote={() => { void saveProposalNote(); }}
          onCancelProposalNoteEdit={() => { setEditingProposalNote(false); setProposalNoteDraft(''); setProposalNoteError(null); }}
          onDeleteProposalNote={confirmDeleteProposalNote}
          onAccept={() => confirmStatus('accepted')}
          onDecline={() => confirmStatus('declined')}
          onWithdraw={() => confirmStatus('withdrawn')}
          onMarkSubmitted={() => confirmDealStatus('submitted')}
          onConfirmCompleted={() => confirmDealStatus('completed')}
          onReportProblem={() => setProblemReportOpen(true)}
          onOpenCancelTrade={() => setCancelTradeOpen(true)}
          onChangeCancelReason={(text) => { setCancelReason(text); if (cancelError) setCancelError(null); }}
          onCancelCancelTrade={() => { setCancelTradeOpen(false); setCancelReason(''); setCancelError(null); }}
          onSubmitCancelTrade={() => { void cancelAcceptedTrade(); }}
          t={t}
        />
        <ProblemReportSheet
          visible={problemReportOpen}
          summary={problemSummary}
          error={problemError}
          loading={actionLoading === 'deal-report'}
          onChangeSummary={(text) => { setProblemSummary(text); if (problemError) setProblemError(null); }}
          onCancel={() => { if (actionLoading) return; setProblemReportOpen(false); setProblemSummary(''); setProblemError(null); }}
          onSubmit={() => { void submitDealProblemReport(); }}
          t={t}
        />
        <AppActionSheet
          visible={Boolean(actionSheet)}
          title={actionSheetConfig.title}
          body={actionSheetConfig.body}
          actions={actionSheetConfig.actions}
          cancelLabel={t('common.actions.cancel')}
          onClose={() => setActionSheet(null)}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.screen}>
      <AppHeader
        title={headerTitle}
        onBack={() => navigation.goBack()}
        rightSlot={proposal ? <HeaderDetailsButton onPress={() => setThreadInfoMode('menu')} label={t('trade.proposals.threadMenu')} /> : null}
      />

      {!proposal ? (
        <ScrollView contentContainerStyle={styles.loadingContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProposal(); }} />}>
          <View style={[styles.loadingCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <SemanticBadge label={t('trade.proposals.tradeProposal')} tone="proposal" />
            {error ? <DetailEmptyState icon="warning" title={t('trade.detail.tradeError')} body={error} actionLabel={t('common.actions.tryAgain')} onAction={() => { void loadProposal(); }} /> : <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.loadingProposal')}</AppText>}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chatRoot} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
          <ScrollView
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            onScroll={(event) => {
              const nextCompact = event.nativeEvent.contentOffset.y > 84;
              if (nextCompact !== scrolledCompact) setScrolledCompact(nextCompact);
            }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProposal(); }} />}
          >
            {error ? <InfoNotice tone="danger" title={t('trade.detail.tradeError')} body={error} /> : null}
            {notice ? <InfoNotice tone="success" title={t('trade.proposals.proposalUpdated')} body={notice} /> : null}
            {proposal.trade?.cancelledAt ? <InfoNotice tone="warning" title={t('trade.proposals.tradeCancelled')} body={t('trade.proposals.tradeCancelledWithReason', { date: formatTraceDate(proposal.trade.cancelledAt, language), reason: proposal.trade.cancelReason || t('trade.proposals.noCancelReason') })} /> : null}

            <View style={[styles.timelineShell, { borderTopColor: theme.color.border }]}>
              <View style={styles.timelineHeader}>
                <View style={styles.timelineHeaderCopy}>
                  <AppText style={styles.timelineTitle}>{proposal.status === 'accepted' ? t('trade.proposals.acceptedTradeConversation') : t('trade.proposals.privateProposalConversation')}</AppText>
                  <AppText style={[styles.timelineBody, { color: theme.color.muted }]}>{proposal.status === 'accepted' ? t('trade.proposals.acceptedConversationBody') : t('trade.proposals.proposalConversationPrivateBody')}</AppText>
                </View>
                <SemanticBadge label={formatStatus(proposal.status, t)} tone={proposal.status === 'accepted' ? 'success' : proposal.status === 'pending' ? 'proposal' : 'muted'} size="sm" />
              </View>

              <SystemEvent label={proposal.status === 'accepted' ? t('trade.proposals.proposalAcceptedNative') : isApplicant ? t('trade.proposals.youSentProposal') : t('trade.proposals.sentProposal')} />
              <ProposalNoteChatBubble proposal={proposal} mine={isApplicant} canEdit={canEditProposalContent} canReport={canReportProposalNote} editing={editingProposalNote} draft={proposalNoteDraft} error={proposalNoteError} onOptions={openProposalNoteOptions} onChangeDraft={(text) => { setProposalNoteDraft(text); if (proposalNoteError) setProposalNoteError(null); }} onSave={() => { void saveProposalNote(); }} onCancel={() => { setEditingProposalNote(false); setProposalNoteDraft(''); setProposalNoteError(null); }} actionLoading={actionLoading} language={language} t={t} />

              <View style={styles.timelineMessages}>
                {visibleMessages.length === 0 ? <DetailEmptyState icon="proposal" title={t('trade.proposals.conversationEmptyTitle')} body={t('trade.proposals.conversationEmptyBody')} style={styles.inlineEmptyState} /> : visibleMessages.map((message) => (
                  <PrivateMessageBubble
                    key={message.id}
                    message={message}
                    mine={message.senderId === actorId}
                    canEdit={message.senderId === actorId && canEditOwnPrivateMessages && !message.deletedAt}
                    canReport={Boolean(actorId && message.senderId !== actorId && !message.deletedAt)}
                    editing={editingMessageId === message.id}
                    draft={messageDraft}
                    error={editingMessageId === message.id ? messageEditError : null}
                    onOptions={() => openMessageOptions(message)}
                    onChangeDraft={(text) => { setMessageDraft(text); if (messageEditError) setMessageEditError(null); }}
                    onSaveEdit={() => { void saveMessageEdit(message.id); }}
                    onCancelEdit={() => { setEditingMessageId(null); setMessageDraft(''); setMessageEditError(null); }}
                    actionLoading={actionLoading}
                    language={language}
                    t={t}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {canMessage ? (
            <ConversationComposerBar
              value={body}
              onChangeText={setBody}
              onSend={() => { void sendMessage(); }}
              placeholder={t('trade.proposals.replyPrivately')}
              sendLabel={actionLoading === 'send' ? t('trade.proposals.sending') : t('trade.proposals.send')}
              disabled={Boolean(actionLoading)}
              sending={actionLoading === 'send'}
              style={{ paddingBottom: Math.max(10, insets.bottom + 8) }}
            />
          ) : (
            <View style={[styles.closedBar, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border, marginBottom: Math.max(10, insets.bottom + 8) }]}>
              <AppText style={[styles.closedText, { color: theme.color.muted }]}>{tradeCancelled ? t('trade.proposals.cancelledConversationClosed') : t('trade.proposals.closedConversation')}</AppText>
            </View>
          )}


          <ProblemReportSheet
            visible={problemReportOpen}
            summary={problemSummary}
            error={problemError}
            loading={actionLoading === 'deal-report'}
            onChangeSummary={(text) => { setProblemSummary(text); if (problemError) setProblemError(null); }}
            onCancel={() => { if (actionLoading) return; setProblemReportOpen(false); setProblemSummary(''); setProblemError(null); }}
            onSubmit={() => { void submitDealProblemReport(); }}
            t={t}
          />

          <AppActionSheet
            visible={Boolean(actionSheet)}
            title={actionSheetConfig.title}
            body={actionSheetConfig.body}
            actions={actionSheetConfig.actions}
            cancelLabel={t('common.actions.cancel')}
            onClose={() => setActionSheet(null)}
          />
        </KeyboardAvoidingView>
      )}
    </AppScreen>
  );
}

function ProposalThreadInfoScreen({ mode, proposal, requiredPackageSide, selectedPackageNeed, selectedPackageOffer, packageLoading, packageError, packageChanged, canEditProposalContent, canCancelAcceptedTrade, canMarkSubmitted, canConfirmCompleted, canReportDealProblem, isOwner, isApplicant, isProvider, editingProposalNote, proposalNoteDraft, proposalNoteError, cancelTradeOpen, cancelReason, cancelError, actionLoading, actorId, language, onClose, onOpenMode, onOpenTradeDetail, onOpenGuide, onReportThread, onChooseNeed, onChooseOffer, onClearNeed, onClearOffer, onSavePackage, onStartProposalNoteEdit, onChangeProposalNote, onSaveProposalNote, onCancelProposalNoteEdit, onDeleteProposalNote, onAccept, onDecline, onWithdraw, onMarkSubmitted, onConfirmCompleted, onReportProblem, onOpenCancelTrade, onChangeCancelReason, onCancelCancelTrade, onSubmitCancelTrade, t }: { mode: ActiveThreadInfoMode; proposal: TradeProposalItem; requiredPackageSide: RequiredProposalSide; selectedPackageNeed: NeedItem | null; selectedPackageOffer: OfferItem | null; packageLoading: boolean; packageError: string | null; packageChanged: boolean; canEditProposalContent: boolean; canCancelAcceptedTrade: boolean; canMarkSubmitted: boolean; canConfirmCompleted: boolean; canReportDealProblem: boolean; isOwner: boolean; isApplicant: boolean; isProvider: boolean; editingProposalNote: boolean; proposalNoteDraft: string; proposalNoteError: string | null; cancelTradeOpen: boolean; cancelReason: string; cancelError: string | null; actionLoading: ActionLoading; actorId: string | null; language: SupportedLanguage; onClose: () => void; onOpenMode: (mode: ThreadInfoMode) => void; onOpenTradeDetail: () => void; onOpenGuide: () => void; onReportThread: () => void; onChooseNeed: () => void; onChooseOffer: () => void; onClearNeed: () => void; onClearOffer: () => void; onSavePackage: () => void; onStartProposalNoteEdit: () => void; onChangeProposalNote: (text: string) => void; onSaveProposalNote: () => void; onCancelProposalNoteEdit: () => void; onDeleteProposalNote: () => void; onAccept: () => void; onDecline: () => void; onWithdraw: () => void; onMarkSubmitted: () => void; onConfirmCompleted: () => void; onReportProblem: () => void; onOpenCancelTrade: () => void; onChangeCancelReason: (text: string) => void; onCancelCancelTrade: () => void; onSubmitCancelTrade: () => void; t: TFunction }) {
  if (mode === 'menu') {
    return <ThreadInfoMenu proposal={proposal} onClose={onClose} onOpenMode={onOpenMode} onOpenTradeDetail={onOpenTradeDetail} onOpenGuide={onOpenGuide} onReportThread={onReportThread} t={t} />;
  }
  if (mode === 'agreement') {
    return <DealAgreementInfoScreen proposal={proposal} onClose={() => onOpenMode('menu')} t={t} />;
  }
  if (mode === 'progress') {
    return <DealProgressInfoScreen proposal={proposal} canMarkSubmitted={canMarkSubmitted} canConfirmCompleted={canConfirmCompleted} canReportProblem={canReportDealProblem} canCancelAcceptedTrade={canCancelAcceptedTrade} cancelTradeOpen={cancelTradeOpen} cancelReason={cancelReason} cancelError={cancelError} actionLoading={actionLoading} actorId={actorId} onClose={() => onOpenMode('menu')} onMarkSubmitted={onMarkSubmitted} onConfirmCompleted={onConfirmCompleted} onReportProblem={onReportProblem} onOpenCancelTrade={onOpenCancelTrade} onChangeCancelReason={onChangeCancelReason} onCancelCancelTrade={onCancelCancelTrade} onSubmitCancelTrade={onSubmitCancelTrade} t={t} />;
  }
  return (
    <ProposalDetailsSheet
      visible
      proposal={proposal}
      requiredPackageSide={requiredPackageSide}
      selectedPackageNeed={selectedPackageNeed}
      selectedPackageOffer={selectedPackageOffer}
      packageLoading={packageLoading}
      packageError={packageError}
      packageChanged={packageChanged}
      canEditProposalContent={canEditProposalContent}
      canCancelAcceptedTrade={canCancelAcceptedTrade}
      isOwner={isOwner}
      isApplicant={isApplicant}
      isProvider={isProvider}
      editingProposalNote={editingProposalNote}
      proposalNoteDraft={proposalNoteDraft}
      proposalNoteError={proposalNoteError}
      cancelTradeOpen={cancelTradeOpen}
      cancelReason={cancelReason}
      cancelError={cancelError}
      actionLoading={actionLoading}
      language={language}
      onClose={() => onOpenMode('menu')}
      onChooseNeed={onChooseNeed}
      onChooseOffer={onChooseOffer}
      onClearNeed={onClearNeed}
      onClearOffer={onClearOffer}
      onSavePackage={onSavePackage}
      onStartProposalNoteEdit={onStartProposalNoteEdit}
      onChangeProposalNote={onChangeProposalNote}
      onSaveProposalNote={onSaveProposalNote}
      onCancelProposalNoteEdit={onCancelProposalNoteEdit}
      onDeleteProposalNote={onDeleteProposalNote}
      onAccept={onAccept}
      onDecline={onDecline}
      onWithdraw={onWithdraw}
      onOpenCancelTrade={onOpenCancelTrade}
      onChangeCancelReason={onChangeCancelReason}
      onCancelCancelTrade={onCancelCancelTrade}
      onSubmitCancelTrade={onSubmitCancelTrade}
      onOpenTradeDetail={onOpenTradeDetail}
      t={t}
    />
  );
}

function ThreadInfoMenu({ proposal, onClose, onOpenMode, onOpenTradeDetail, onOpenGuide, onReportThread, t }: { proposal: TradeProposalItem; onClose: () => void; onOpenMode: (mode: ThreadInfoMode) => void; onOpenTradeDetail: () => void; onOpenGuide: () => void; onReportThread: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const isAccepted = proposal.status === 'accepted';
  return (
    <View style={styles.infoScreenRoot}>
      <AppHeader title={t('trade.proposals.threadInfoTitle')} onBack={onClose} />
      <ScrollView contentContainerStyle={styles.infoScreenContent}>
        <View style={[styles.infoHero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}> 
          <SemanticBadge label={formatStatus(proposal.status, t)} tone={isAccepted ? 'success' : proposal.status === 'pending' ? 'proposal' : 'muted'} size="sm" />
          <AppText style={styles.infoHeroTitle}>{proposal.trade?.title ?? t('trade.proposals.proposalThread')}</AppText>
          <AppText style={[styles.infoHeroBody, { color: theme.color.muted }]}>{t('trade.proposals.threadInfoBody')}</AppText>
        </View>
        <ThreadInfoMenuItem icon="trade" title={t('trade.proposals.threadInfoTradeDetail')} body={t('trade.proposals.threadInfoTradeDetailBody')} onPress={onOpenTradeDetail} />
        <ThreadInfoMenuItem icon="proposal" title={t('trade.proposals.threadInfoProposalDetails')} body={t('trade.proposals.threadInfoProposalDetailsBody')} onPress={() => onOpenMode('proposal')} />
        {isAccepted ? <ThreadInfoMenuItem icon="activity" title={t('trade.proposals.threadInfoDealProgress')} body={t('trade.proposals.threadInfoDealProgressBody')} onPress={() => onOpenMode('progress')} /> : null}
        <ThreadInfoMenuItem icon="help" title={t('trade.proposals.seeGuide')} body={t('trade.proposals.seeGuideBody')} onPress={onOpenGuide} />
        <ThreadInfoMenuItem icon="report-flag" title={t('trade.proposals.reportThread')} body={t('trade.proposals.reportThreadBody')} onPress={onReportThread} tone="danger" />
      </ScrollView>
    </View>
  );
}

function ThreadInfoMenuItem({ icon, title, body, onPress, tone = 'default' }: { icon: MobileIconName; title: string; body: string; onPress: () => void; tone?: 'default' | 'danger' }) {
  const theme = useThemeTokens();
  const isDanger = tone === 'danger';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.infoMenuItem, { backgroundColor: theme.color.surface, borderColor: isDanger ? theme.semantic.danger.border : theme.color.border }, isDanger && { backgroundColor: theme.semantic.danger.softBg }, pressed && styles.pressed]}>
      <View style={[styles.infoMenuIcon, { backgroundColor: isDanger ? theme.semantic.danger.softBg : theme.color.subtleSurface, borderColor: isDanger ? theme.semantic.danger.border : theme.color.border }]}><MobileIcon name={icon} size={20} color={isDanger ? theme.semantic.danger.text : theme.color.text} decorative /></View>
      <View style={styles.infoMenuCopy}>
        <AppText style={[styles.infoMenuTitle, isDanger && { color: theme.semantic.danger.text }]}>{title}</AppText>
        <AppText style={[styles.infoMenuBody, { color: isDanger ? theme.semantic.danger.text : theme.color.muted }]}>{body}</AppText>
      </View>
      <MobileIcon name="chevron-right" size={18} color={isDanger ? theme.semantic.danger.text : theme.color.muted} decorative />
    </Pressable>
  );
}

function DealAgreementInfoScreen({ proposal, onClose, t }: { proposal: TradeProposalItem; onClose: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const agreement = acceptedDealAgreement(proposal);
  return (
    <View style={styles.infoScreenRoot}>
      <AppHeader title={t('trade.deal.agreementTitle')} onBack={onClose} />
      <ScrollView contentContainerStyle={styles.infoScreenContent}>
        <View style={[styles.infoHero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}> 
          <SemanticBadge label={agreement.fromSnapshot ? t('trade.deal.snapshotBadge') : t('trade.deal.acceptedDeal')} tone="proposal" size="sm" />
          <AppText style={styles.infoHeroTitle}>{proposal.trade?.title ?? t('trade.deal.title')}</AppText>
          <AppText style={[styles.infoHeroBody, { color: theme.color.muted }]}>{t('trade.proposals.threadInfoDealAgreementBody')}</AppText>
        </View>
        {agreement.fromSnapshot ? <InfoNotice tone="info" title={t('trade.deal.snapshotTitle')} body={t('trade.deal.snapshotBody')} /> : null}
        {agreement.acceptedMessage ? <View style={[styles.dealAcceptedMessage, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <AppText style={[styles.dealAcceptedMessageLabel, { color: theme.color.muted }]}>{t('trade.deal.acceptedMessage')}</AppText>
          <AppText style={styles.dealAcceptedMessageText}>{agreement.acceptedMessage}</AppText>
        </View> : null}
        <View style={styles.dealAgreementGrid}>
          <DealAgreementColumn label={t('trade.deal.ownerGives')} items={agreement.ownerGives} emptyLabel={t('trade.deal.notSet')} tone="offer" t={t} />
          <DealAgreementColumn label={t('trade.deal.ownerReceives')} items={agreement.ownerReceives} emptyLabel={t('trade.deal.notSet')} tone="need" t={t} />
          <DealAgreementColumn label={t('trade.deal.applicantGives')} items={agreement.applicantGives} emptyLabel={t('trade.deal.notSet')} tone="offer" t={t} />
          <DealAgreementColumn label={t('trade.deal.applicantReceives')} items={agreement.applicantReceives} emptyLabel={t('trade.deal.notSet')} tone="need" t={t} />
        </View>
      </ScrollView>
    </View>
  );
}

function DealProgressInfoScreen({ proposal, canMarkSubmitted, canConfirmCompleted, canReportProblem, canCancelAcceptedTrade, cancelTradeOpen, cancelReason, cancelError, actionLoading, actorId, onClose, onMarkSubmitted, onConfirmCompleted, onReportProblem, onOpenCancelTrade, onChangeCancelReason, onCancelCancelTrade, onSubmitCancelTrade, t }: { proposal: TradeProposalItem; canMarkSubmitted: boolean; canConfirmCompleted: boolean; canReportProblem: boolean; canCancelAcceptedTrade: boolean; cancelTradeOpen: boolean; cancelReason: string; cancelError: string | null; actionLoading: ActionLoading; actorId: string | null; onClose: () => void; onMarkSubmitted: () => void; onConfirmCompleted: () => void; onReportProblem: () => void; onOpenCancelTrade: () => void; onChangeCancelReason: (text: string) => void; onCancelCancelTrade: () => void; onSubmitCancelTrade: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const trade = proposal.trade;
  const status = trade?.status ?? 'in_progress';
  const stateBody = status === 'submitted'
    ? t('trade.deal.submittedStateBody')
    : status === 'completed'
      ? t('trade.deal.completedStateBody')
      : status === 'disputed'
        ? t('trade.deal.disputedStateBody')
        : status === 'cancelled'
          ? t('trade.deal.cancelledStateBody')
          : t('trade.deal.inProgressStateBody');
  const submittedByYou = Boolean(actorId && trade?.deliverySubmittedById === actorId);
  const roleGuard = getDealRoleGuard(status, canMarkSubmitted, canConfirmCompleted, submittedByYou, t);
  return (
    <View style={styles.infoScreenRoot}>
      <AppHeader title={t('trade.deal.progressTitle')} onBack={onClose} />
      <ScrollView contentContainerStyle={styles.infoScreenContent}>
        <View style={[styles.infoHero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}> 
          <SemanticBadge label={formatStatus(status, t)} tone={status === 'completed' ? 'success' : status === 'disputed' || status === 'cancelled' ? 'warning' : 'proposal'} size="sm" />
          <AppText style={styles.infoHeroTitle}>{trade?.title ?? t('trade.deal.title')}</AppText>
          <AppText style={[styles.infoHeroBody, { color: theme.color.muted }]}>{stateBody}</AppText>
        </View>
        {roleGuard ? <View style={[styles.dealGuardCard, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}> 
          <SemanticBadge label={roleGuard.label} tone={roleGuard.tone} size="sm" />
          <View style={styles.dealGuardCopy}>
            <AppText style={styles.dealGuardTitle}>{roleGuard.title}</AppText>
            <AppText style={[styles.dealGuardBody, { color: theme.color.muted }]}>{roleGuard.body}</AppText>
          </View>
        </View> : null}
        <View style={[styles.infoSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}> 
          <AppText style={styles.sectionTitle}>{t('trade.deal.progressTitle')}</AppText>
          <View style={styles.dealProgressList}>{(['accepted', 'in_progress', 'submitted', 'completed'] as const).map((step, index) => <DealProgressStep key={step} step={step} index={index + 1} state={dealStepState(status, step)} t={t} />)}</View>
          {status === 'disputed' ? <InfoNotice tone="warning" title={t('trade.deal.problemReportedTitle')} body={t('trade.deal.disputedStateBody')} /> : null}
          {status === 'cancelled' ? <InfoNotice tone="warning" title={t('trade.deal.cancelledTitle')} body={trade?.cancelReason ? t('trade.deal.cancelledWithReason', { reason: trade.cancelReason }) : t('trade.deal.cancelledStateBody')} /> : null}
        </View>
        <View style={[styles.infoSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}> 
          <AppText style={styles.sectionTitle}>{t('trade.deal.safeActionsTitle')}</AppText>
          <View style={styles.actionRowWrap}>
            {canMarkSubmitted ? <SmallActionButton label={actionLoading === 'submitted' ? t('common.states.working') : t('trade.detail.markDelivered')} onPress={onMarkSubmitted} disabled={Boolean(actionLoading)} /> : null}
            {canConfirmCompleted ? <SmallActionButton label={actionLoading === 'completed' ? t('common.states.working') : t('trade.detail.confirmCompleted')} onPress={onConfirmCompleted} disabled={Boolean(actionLoading)} /> : null}
            {canReportProblem ? <SmallActionButton label={actionLoading === 'deal-report' ? t('common.states.working') : t('trade.detail.reportProblem')} onPress={onReportProblem} disabled={Boolean(actionLoading)} danger /> : null}
            {canCancelAcceptedTrade ? cancelTradeOpen ? null : <SmallActionButton label={t('trade.proposals.cancelAcceptedTrade')} onPress={onOpenCancelTrade} disabled={Boolean(actionLoading)} danger /> : null}
          </View>
          {!canMarkSubmitted && !canConfirmCompleted && !canReportProblem && !canCancelAcceptedTrade ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.deal.noSafeActionsBody')}</AppText> : null}
          {cancelTradeOpen ? <CancelTradeForm reason={cancelReason} error={cancelError} loading={actionLoading === 'cancel-trade'} onChangeReason={onChangeCancelReason} onCancel={onCancelCancelTrade} onSubmit={onSubmitCancelTrade} t={t} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function ThreadTradeStrip({ proposal, onOpenTradeDetail, t }: { proposal: TradeProposalItem; onOpenTradeDetail: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const trade = proposal.trade;
  const needTitle = trade?.need?.title || t('trade.labels.need');
  const offerTitle = trade?.offer?.title || t('trade.labels.offer');
  const title = trade?.title || `${needTitle} ↔ ${offerTitle}`;
  const hasTrade = Boolean(trade?.id);

  return (
    <Pressable
      accessibilityRole={hasTrade ? 'button' : undefined}
      accessibilityLabel={hasTrade ? `${t('trade.proposals.openTradeDetail')}: ${title}` : undefined}
      accessibilityState={{ disabled: !hasTrade }}
      disabled={!hasTrade}
      onPress={onOpenTradeDetail}
      style={({ pressed }) => [styles.threadTradeStrip, { borderBottomColor: theme.color.border }, pressed && hasTrade && styles.pressed]}
    >
      <View style={styles.threadTradeIconRow}>
        <View style={[styles.threadTradeIcon, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <MobileIcon name="trade" size={18} color={theme.color.text} decorative />
        </View>
        <View style={styles.threadTradeCopy}>
          <AppText style={[styles.threadEyebrow, { color: theme.color.muted }]}>{t('trade.proposals.tradeSummary')}</AppText>
          <AppText style={styles.threadTradeTitle} numberOfLines={2}>{title}</AppText>
          <AppText style={[styles.threadTradeMeta, { color: theme.color.muted }]} numberOfLines={1}>{needTitle} ↔ {offerTitle}</AppText>
        </View>
      </View>
      <View style={styles.threadTradeStatusRow}>
        <StatusBadge status={proposal.status} label={formatStatus(proposal.status, t)} />
        {trade ? <SemanticBadge label={formatStatus(trade.status, t)} tone="proposal" size="sm" /> : null}
        {hasTrade ? <MobileIcon name="chevron-right" size={18} color={theme.color.muted} decorative /> : null}
      </View>
    </Pressable>
  );
}



function getDealRoleGuard(status: string | null | undefined, canMarkSubmitted: boolean, canConfirmCompleted: boolean, submittedByYou: boolean, t: TFunction) {
  if (status === 'in_progress') {
    return canMarkSubmitted
      ? { label: t('trade.deal.yourNextStep'), title: t('trade.deal.submitterNextStepTitle'), body: t('trade.deal.submitterNextStepBody'), tone: 'proposal' as const }
      : { label: t('trade.deal.waitingStep'), title: t('trade.deal.waitingSubmitterTitle'), body: t('trade.deal.waitingSubmitterBody'), tone: 'muted' as const };
  }
  if (status === 'submitted') {
    return canConfirmCompleted
      ? { label: t('trade.deal.yourNextStep'), title: t('trade.deal.reviewerNextStepTitle'), body: t('trade.deal.reviewerNextStepBody'), tone: 'proposal' as const }
      : submittedByYou
        ? { label: t('trade.deal.guardBlocked'), title: t('trade.deal.submitterCannotConfirmTitle'), body: t('trade.deal.submitterCannotConfirmBody'), tone: 'warning' as const }
        : { label: t('trade.deal.waitingStep'), title: t('trade.deal.waitingReviewerTitle'), body: t('trade.deal.waitingReviewerBody'), tone: 'muted' as const };
  }
  if (status === 'completed') {
    return { label: t('trade.deal.closedStep'), title: t('trade.deal.completedClosedTitle'), body: t('trade.deal.completedClosedBody'), tone: 'success' as const };
  }
  return null;
}

function AcceptedDealWorkspace({ proposal, canMarkSubmitted, canConfirmCompleted, canReportProblem, canCancelAcceptedTrade, cancelTradeOpen, cancelReason, cancelError, actionLoading, actorId, onMarkSubmitted, onConfirmCompleted, onReportProblem, onOpenCancelTrade, onChangeCancelReason, onCancelCancelTrade, onSubmitCancelTrade, onDetails, t }: { proposal: TradeProposalItem; canMarkSubmitted: boolean; canConfirmCompleted: boolean; canReportProblem: boolean; canCancelAcceptedTrade: boolean; cancelTradeOpen: boolean; cancelReason: string; cancelError: string | null; actionLoading: ActionLoading; actorId: string | null; onMarkSubmitted: () => void; onConfirmCompleted: () => void; onReportProblem: () => void; onOpenCancelTrade: () => void; onChangeCancelReason: (text: string) => void; onCancelCancelTrade: () => void; onSubmitCancelTrade: () => void; onDetails: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const trade = proposal.trade;
  const agreement = acceptedDealAgreement(proposal);
  const status = trade?.status ?? 'in_progress';
  const statusTone = (status === 'completed' ? 'success' : status === 'disputed' || status === 'cancelled' ? 'warning' : 'proposal') as 'success' | 'warning' | 'proposal';
  const stateBody = status === 'submitted'
    ? t('trade.deal.submittedStateBody')
    : status === 'completed'
      ? t('trade.deal.completedStateBody')
      : status === 'disputed'
        ? t('trade.deal.disputedStateBody')
        : status === 'cancelled'
          ? t('trade.deal.cancelledStateBody')
          : t('trade.deal.inProgressStateBody');
  const submittedByYou = Boolean(actorId && trade?.deliverySubmittedById === actorId);
  const roleGuard = getDealRoleGuard(status, canMarkSubmitted, canConfirmCompleted, submittedByYou, t);
  const canTakeSafeAction = canMarkSubmitted || canConfirmCompleted || canReportProblem || canCancelAcceptedTrade || cancelTradeOpen;
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(canTakeSafeAction);

  useEffect(() => {
    if (canTakeSafeAction) setActionsOpen(true);
  }, [canTakeSafeAction]);

  return (
    <View style={styles.dealStack}>
      <View style={[styles.dealSummaryCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <View style={styles.dealSummaryHeader}>
          <SemanticBadge label={t('trade.deal.acceptedDeal')} tone="proposal" size="sm" />
          <SemanticBadge label={formatStatus(status, t)} tone={statusTone} size="sm" />
        </View>
        <AppText style={styles.dealSummaryTitle}>{trade?.title ?? t('trade.deal.title')}</AppText>
        <AppText style={[styles.dealSummaryMeta, { color: theme.color.muted }]}>{stateBody}</AppText>
      </View>

      {roleGuard ? <View style={[styles.dealGuardCard, styles.dealGuardCardCompact, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
        <SemanticBadge label={roleGuard.label} tone={roleGuard.tone} size="sm" />
        <View style={styles.dealGuardCopy}>
          <AppText style={styles.dealGuardTitle}>{roleGuard.title}</AppText>
          <AppText style={[styles.dealGuardBody, { color: theme.color.muted }]}>{roleGuard.body}</AppText>
        </View>
      </View> : null}

      <DealCollapsibleSection title={t('trade.deal.agreementTitle')} body={t('trade.deal.agreementBody')} badge={agreement.fromSnapshot ? t('trade.deal.snapshotBadge') : undefined} open={agreementOpen} onToggle={() => setAgreementOpen((value) => !value)}>
        {agreement.fromSnapshot ? <InfoNotice tone="info" title={t('trade.deal.snapshotTitle')} body={t('trade.deal.snapshotBody')} /> : null}
        {agreement.acceptedMessage ? <View style={[styles.dealAcceptedMessage, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <AppText style={[styles.dealAcceptedMessageLabel, { color: theme.color.muted }]}>{t('trade.deal.acceptedMessage')}</AppText>
          <AppText style={styles.dealAcceptedMessageText}>{agreement.acceptedMessage}</AppText>
        </View> : null}
        <View style={styles.dealAgreementGrid}>
          <DealAgreementColumn label={t('trade.deal.ownerGives')} items={agreement.ownerGives} emptyLabel={t('trade.deal.notSet')} tone="offer" t={t} />
          <DealAgreementColumn label={t('trade.deal.ownerReceives')} items={agreement.ownerReceives} emptyLabel={t('trade.deal.notSet')} tone="need" t={t} />
          <DealAgreementColumn label={t('trade.deal.applicantGives')} items={agreement.applicantGives} emptyLabel={t('trade.deal.notSet')} tone="offer" t={t} />
          <DealAgreementColumn label={t('trade.deal.applicantReceives')} items={agreement.applicantReceives} emptyLabel={t('trade.deal.notSet')} tone="need" t={t} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('trade.proposals.showProposalItemDetails')} onPress={onDetails} style={({ pressed }) => [styles.dealDetailsButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
          <AppText style={[styles.dealDetailsText, { color: theme.color.text }]}>{t('trade.proposals.showProposalItemDetails')}</AppText>
        </Pressable>
      </DealCollapsibleSection>

      <DealCollapsibleSection title={t('trade.deal.safetyTitle')} body={t('trade.deal.safetyBody')} badge={t('trade.deal.safetyBadge')} open={safetyOpen} onToggle={() => setSafetyOpen((value) => !value)}>
        <View style={styles.safetyChecklist}>
          {[t('trade.deal.safetyKeepChat'), t('trade.deal.safetyConfirmScope'), t('trade.deal.safetyNoSensitive'), t('trade.deal.safetyReportSuspicious')].map((item) => (
            <View key={item} style={styles.safetyChecklistItem}>
              <View style={[styles.safetyCheck, { backgroundColor: theme.semantic.success.softBg, borderColor: theme.semantic.success.border }]}>
                <AppText style={[styles.safetyCheckText, { color: theme.semantic.success.text }]}>✓</AppText>
              </View>
              <AppText style={[styles.safetyChecklistText, { color: theme.color.text }]}>{item}</AppText>
            </View>
          ))}
        </View>
      </DealCollapsibleSection>

      <DealCollapsibleSection title={t('trade.deal.progressTitle')} body={stateBody} badge={formatStatus(status, t)} open={progressOpen} onToggle={() => setProgressOpen((value) => !value)}>
        <View style={styles.dealProgressList}>
          {(['accepted', 'in_progress', 'submitted', 'completed'] as const).map((step, index) => <DealProgressStep key={step} step={step} index={index + 1} state={dealStepState(status, step)} t={t} />)}
        </View>
        {status === 'disputed' ? <InfoNotice tone="warning" title={t('trade.deal.problemReportedTitle')} body={t('trade.deal.disputedStateBody')} /> : null}
        {status === 'cancelled' ? <InfoNotice tone="warning" title={t('trade.deal.cancelledTitle')} body={trade?.cancelReason ? t('trade.deal.cancelledWithReason', { reason: trade.cancelReason }) : t('trade.deal.cancelledStateBody')} /> : null}
      </DealCollapsibleSection>

      <DealCollapsibleSection title={t('trade.deal.safeActionsTitle')} body={canTakeSafeAction ? t('trade.deal.safeActionsBody') : t('trade.deal.noSafeActionsBody')} badge={canTakeSafeAction ? t('trade.deal.actionsAvailable') : t('trade.deal.actionsClosed')} open={actionsOpen} onToggle={() => setActionsOpen((value) => !value)}>
        {canTakeSafeAction ? <>
          <View style={styles.actionRowWrap}>
            {canMarkSubmitted ? <SmallActionButton label={actionLoading === 'submitted' ? t('common.states.working') : t('trade.detail.markDelivered')} onPress={onMarkSubmitted} disabled={Boolean(actionLoading)} /> : null}
            {canConfirmCompleted ? <SmallActionButton label={actionLoading === 'completed' ? t('common.states.working') : t('trade.detail.confirmCompleted')} onPress={onConfirmCompleted} disabled={Boolean(actionLoading)} /> : null}
            {canReportProblem ? <SmallActionButton label={actionLoading === 'deal-report' ? t('common.states.working') : t('trade.detail.reportProblem')} onPress={onReportProblem} disabled={Boolean(actionLoading)} danger /> : null}
            {canCancelAcceptedTrade ? cancelTradeOpen ? null : <SmallActionButton label={t('trade.proposals.cancelAcceptedTrade')} onPress={onOpenCancelTrade} disabled={Boolean(actionLoading)} danger /> : null}
          </View>
          {cancelTradeOpen ? <CancelTradeForm reason={cancelReason} error={cancelError} loading={actionLoading === 'cancel-trade'} onChangeReason={onChangeCancelReason} onCancel={onCancelCancelTrade} onSubmit={onSubmitCancelTrade} t={t} /> : null}
        </> : <AppText style={[styles.dealCollapsedBody, { color: theme.color.muted }]}>{t('trade.deal.noSafeActionsBody')}</AppText>}
      </DealCollapsibleSection>
    </View>
  );
}

function DealCollapsibleSection({ title, body, badge, open, onToggle, children }: { title: string; body?: string; badge?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.dealCollapsedSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={({ pressed }) => [styles.dealCollapsedHeader, pressed && styles.pressed]}>
        <View style={styles.dealCollapsedCopy}>
          <View style={styles.dealCollapsedTitleRow}>
            <AppText style={styles.dealCollapsedTitle}>{title}</AppText>
            {badge ? <SemanticBadge label={badge} tone={open ? 'proposal' : 'muted'} size="sm" /> : null}
          </View>
          {body ? <AppText style={[styles.dealCollapsedBody, { color: theme.color.muted }]} numberOfLines={open ? 3 : 2}>{body}</AppText> : null}
        </View>
        <View style={[styles.dealCollapsedIcon, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <MobileIcon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.color.muted} decorative />
        </View>
      </Pressable>
      {open ? <View style={styles.dealCollapsedContent}>{children}</View> : null}
    </View>
  );
}

function DealAgreementColumn({ label, items, emptyLabel, tone, t }: { label: string; items: DealAgreementItem[]; emptyLabel: string; tone: ProposalSideKind; t: TFunction }) {
  const theme = useThemeTokens();
  const color = theme.semantic[tone];
  return (
    <View style={[styles.dealAgreementColumn, { backgroundColor: color.softBg, borderColor: color.border }]}>
      <SemanticBadge label={label} tone={tone} size="sm" />
      {items.length ? items.map((item) => (
        <View key={`${isAcceptedDealSnapshotItem(item) ? item.kind : tone}-${item.id}`} style={styles.dealAgreementItem}>
          <AppText style={styles.dealAgreementTitle} numberOfLines={2}>{isAcceptedDealSnapshotItem(item) && item.kind === 'cash_promise' ? t('trade.cashPromise.title') : item.title}</AppText>
          <AppText style={[styles.dealAgreementMeta, { color: color.text }]} numberOfLines={1}>{dealAgreementMeta(item, tone, t)}</AppText>
        </View>
      )) : <AppText style={[styles.dealAgreementEmpty, { color: theme.color.muted }]}>{emptyLabel}</AppText>}
    </View>
  );
}

function DealProgressStep({ step, index, state, t }: { step: 'accepted' | 'in_progress' | 'submitted' | 'completed'; index: number; state: 'done' | 'current' | 'pending'; t: TFunction }) {
  const theme = useThemeTokens();
  const isDone = state === 'done';
  const isCurrent = state === 'current';
  const label = step === 'accepted' ? t('trade.deal.stepAccepted') : step === 'in_progress' ? t('trade.deal.stepInProgress') : step === 'submitted' ? t('trade.deal.stepSubmitted') : t('trade.deal.stepCompleted');
  return (
    <View style={styles.dealProgressStep}>
      <View style={[styles.dealProgressDot, { backgroundColor: isDone || isCurrent ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: isDone || isCurrent ? theme.semantic.proposal.border : theme.color.border }]}>
        <AppText style={[styles.dealProgressDotText, { color: isDone || isCurrent ? theme.semantic.proposal.text : theme.color.muted }]}>{isDone ? '✓' : index}</AppText>
      </View>
      <AppText style={[styles.dealProgressLabel, { color: isCurrent ? theme.color.text : theme.color.muted }]}>{label}</AppText>
    </View>
  );
}

function ProposalStatusBlock({ proposal, statusHint, tradeCancelled, t }: { proposal: TradeProposalItem; statusHint: string; tradeCancelled: boolean; t: TFunction }) {
  const theme = useThemeTokens();
  return (
    <DetailSection title={t('trade.proposals.proposalStatus')} compact withTopBorder={false}>
      <View style={styles.statusBlockCopy}>
        <DetailMetadataChips
          compact
          chips={[
            { label: formatStatus(proposal.status, t), tone: proposal.status === 'accepted' ? 'success' : proposal.status === 'pending' ? 'proposal' : proposal.status === 'declined' || proposal.status === 'withdrawn' ? 'danger' : 'muted', icon: proposal.status === 'accepted' ? 'proposal-accepted' : proposal.status === 'declined' || proposal.status === 'withdrawn' ? 'proposal-declined' : 'proposal' },
            proposal.trade ? { label: formatStatus(proposal.trade.status, t), tone: tradeCancelled ? 'warning' : 'muted', icon: tradeCancelled ? 'warning' : 'trade' } : null,
          ]}
        />
        <AppText style={[styles.statusHintText, { color: theme.color.text }]}>{statusHint}</AppText>
      </View>
    </DetailSection>
  );
}

function ProposalPackageThreadBlock({ proposal, canEditProposalContent, onDetails, t }: { proposal: TradeProposalItem; canEditProposalContent: boolean; onDetails: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const sideItems = proposalSideItems(proposal);
  const hasCashPromise = Boolean(proposal.cashPromise);
  const actionLabel = canEditProposalContent ? t('trade.proposals.manageProposal') : t('trade.proposals.showProposalItemDetails');

  return (
    <DetailSection
      title={t('trade.proposals.proposalPackage')}
      description={sideItems.length > 0 || hasCashPromise ? proposalPackageTitle(proposal, t) : t('trade.proposals.noAttachedItem')}
      compact
      rightSlot={
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onDetails} style={({ pressed }) => [styles.inlineDetailsButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
          <AppText style={[styles.inlineDetailsText, { color: theme.color.text }]}>{actionLabel}</AppText>
        </Pressable>
      }
    >
      {sideItems.length === 0 && !hasCashPromise ? (
        <View style={[styles.inlinePackageEmpty, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
          <MobileIcon name="proposal" size={18} color={theme.color.muted} decorative />
          <AppText style={[styles.inlinePackageEmptyText, { color: theme.color.muted }]}>{t('trade.proposals.noAttachedItem')}</AppText>
        </View>
      ) : (
        <View style={styles.inlinePackageList}>
          {sideItems.map(({ kind, item }) => <ProposalSideInlineItem key={`${kind}-${item.id}`} kind={kind} item={item} t={t} />)}
          {proposal.cashPromise ? <CashPromiseInlineItem amountCents={proposal.cashPromise.amountCents} currency={proposal.cashPromise.currency ?? 'eur'} side={proposal.cashPromise.side} note={proposal.cashPromise.note ?? null} t={t} /> : null}
        </View>
      )}
    </DetailSection>
  );
}

function ProposalSideInlineItem({ kind, item, t }: { kind: ProposalSideKind; item: ProposalSideItem; t: TFunction }) {
  const theme = useThemeTokens();
  const color = theme.semantic[kind];
  const mediaCount = item.media?.length ?? 0;
  return (
    <View style={[styles.inlineSideItem, { borderTopColor: theme.color.border }]}>
      <View style={[styles.inlineSideIcon, { backgroundColor: color.softBg, borderColor: color.border }]}>
        <MobileIcon name={kind} size={18} color={color.text} decorative />
      </View>
      <View style={styles.inlineSideCopy}>
        <View style={styles.inlineSideHeader}>
          <SemanticBadge label={kind === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')} tone={kind} size="sm" />
          {mediaCount > 0 ? <SemanticBadge label={`${mediaCount} ${t('trade.labels.images')}`} tone={kind} size="sm" /> : null}
        </View>
        <AppText style={styles.inlineSideTitle} numberOfLines={2}>{item.title}</AppText>
        <AppText style={[styles.inlineSideMeta, { color: color.text }]} numberOfLines={1}>{proposalSideMeta(kind, item, t)}</AppText>
        <AppText style={[styles.inlineSideDescription, { color: theme.color.muted }]} numberOfLines={3}>{proposalSideDescription(item, t)}</AppText>
      </View>
    </View>
  );
}

function CashPromiseInlineItem({ amountCents, currency, side, note, t }: { amountCents: number; currency: string; side: 'need' | 'offer'; note?: string | null; t: TFunction }) {
  const theme = useThemeTokens();
  const tone = side === 'need' ? theme.semantic.need : theme.semantic.offer;
  return (
    <View style={[styles.inlineSideItem, { borderTopColor: theme.color.border }]}>
      <View style={[styles.inlineSideIcon, { backgroundColor: theme.semantic.warning.softBg, borderColor: theme.semantic.warning.border }]}>
        <MobileIcon name="proposal" size={18} color={theme.semantic.warning.text} decorative />
      </View>
      <View style={styles.inlineSideCopy}>
        <View style={styles.inlineSideHeader}>
          <SemanticBadge label={side === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')} tone={side} size="sm" />
          <SemanticBadge label={t('trade.cashPromise.notProcessed')} tone="warning" size="sm" />
        </View>
        <AppText style={styles.inlineSideTitle} numberOfLines={2}>{t('trade.cashPromise.title')} · {formatMoneyAmount(amountCents, currency)}</AppText>
        <AppText style={[styles.inlineSideMeta, { color: tone.text }]} numberOfLines={1}>{t('trade.cashPromise.outsideAppTitle')}</AppText>
        {note ? <AppText style={[styles.inlineSideDescription, { color: theme.color.muted }]} numberOfLines={3}>{note}</AppText> : null}
      </View>
    </View>
  );
}

function HeaderDetailsButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.headerDetailsButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <MobileIcon name="more" size={20} color={theme.color.text} />
    </Pressable>
  );
}

function PrivateThreadGuide({ t }: { t: TFunction }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.threadGuideContent}>
      <AppText style={styles.threadGuideTitle}>{t('trade.proposals.guideHeading')}</AppText>
      <AppText style={[styles.threadGuideBody, { color: theme.color.muted }]}>{t('trade.proposals.guideBody')}</AppText>
      <View style={[styles.threadGuideSection, { borderColor: theme.color.border }]}>
        <AppText style={styles.threadGuideSectionTitle}>{t('trade.proposals.guidePrivateTitle')}</AppText>
        <AppText style={[styles.threadGuideSectionBody, { color: theme.color.muted }]}>{t('trade.proposals.guidePrivateBody')}</AppText>
      </View>
      <View style={[styles.threadGuideSection, { borderColor: theme.color.border }]}>
        <AppText style={styles.threadGuideSectionTitle}>{t('trade.proposals.guideDetailsTitle')}</AppText>
        <AppText style={[styles.threadGuideSectionBody, { color: theme.color.muted }]}>{t('trade.proposals.guideDetailsBody')}</AppText>
      </View>
    </View>
  );
}

function ThreadDetailsPanel({ expanded, proposal, tradeCancelled, onClose, children, t }: { expanded: boolean; proposal: TradeProposalItem; tradeCancelled: boolean; onClose: () => void; children?: React.ReactNode; t: TFunction }) {
  const theme = useThemeTokens();
  if (!expanded) return null;
  const tone = proposal.status === 'accepted' ? 'success' : proposal.status === 'pending' ? 'proposal' : tradeCancelled ? 'warning' : 'muted';

  return (
    <View style={[styles.threadDetailsPanel, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.threadDetailsPanelHeader}>
        <View style={styles.threadDetailsPanelTitleWrap}>
          <View style={styles.threadDetailsPanelBadges}>
            <SemanticBadge label={proposal.status === 'accepted' ? t('trade.deal.acceptedDeal') : t('trade.proposals.tradeProposal')} tone={tone} size="sm" />
            {proposal.trade ? <SemanticBadge label={formatStatus(proposal.trade.status, t)} tone={tradeCancelled ? 'warning' : 'muted'} size="sm" /> : null}
          </View>
          <AppText style={styles.threadDetailsPanelTitle}>{t('trade.proposals.threadDetailsTitle')}</AppText>
          <AppText style={[styles.threadDetailsPanelBody, { color: theme.color.muted }]}>{t('trade.proposals.threadDetailsBody')}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('trade.proposals.hideThreadDetails')} hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.threadDetailsPanelClose, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
          <MobileIcon name="chevron-up" size={18} color={theme.color.text} decorative />
        </Pressable>
      </View>

      <View style={styles.threadDetailsPanelContent}>{children}</View>
    </View>
  );
}

function PrivateThreadContextCard({ proposal, statusHint, tradeCancelled, expanded, onToggle, onOpenTradeDetail, t }: { proposal: TradeProposalItem; statusHint: string; tradeCancelled: boolean; expanded: boolean; onToggle: () => void; onOpenTradeDetail: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const trade = proposal.trade;
  const needTitle = trade?.need?.title || t('trade.labels.need');
  const offerTitle = trade?.offer?.title || t('trade.labels.offer');
  const title = trade?.title || `${needTitle} ↔ ${offerTitle}`;
  const tradeStatusLabel = trade ? formatStatus(trade.status, t) : null;
  const detailLabel = expanded ? t('trade.proposals.hideThreadDetails') : t('trade.proposals.showThreadDetails');
  const tone = proposal.status === 'accepted' ? 'success' : proposal.status === 'pending' ? 'proposal' : tradeCancelled ? 'warning' : 'muted';

  return (
    <View style={[styles.threadContextCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.threadContextTop}>
        <View style={[styles.threadContextIcon, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }]}>
          <MobileIcon name={proposal.status === 'accepted' ? 'proposal-accepted' : 'proposal'} size={19} color={theme.semantic.proposal.text} decorative />
        </View>
        <View style={styles.threadContextCopy}>
          <View style={styles.threadContextBadges}>
            <SemanticBadge label={proposal.status === 'accepted' ? t('trade.deal.acceptedDeal') : t('trade.proposals.tradeProposal')} tone={tone} size="sm" />
            {tradeStatusLabel ? <SemanticBadge label={tradeStatusLabel} tone={tradeCancelled ? 'warning' : 'muted'} size="sm" /> : null}
          </View>
          <Pressable accessibilityRole={trade?.id ? 'button' : undefined} disabled={!trade?.id} onPress={onOpenTradeDetail} style={({ pressed }) => [styles.threadContextTitleButton, pressed && Boolean(trade?.id) && styles.pressed]}>
            <AppText style={styles.threadContextTitle} numberOfLines={2}>{title}</AppText>
          </Pressable>
          <AppText style={[styles.threadContextMeta, { color: theme.color.muted }]} numberOfLines={1}>{needTitle} ↔ {offerTitle}</AppText>
        </View>
      </View>

      <View style={[styles.threadContextStatus, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
        <AppText style={[styles.threadContextHint, { color: theme.color.text }]} numberOfLines={2}>{statusHint}</AppText>
        {!expanded ? <AppText style={[styles.threadContextCollapsedHint, { color: theme.color.muted }]}>{t('trade.proposals.threadDetailsCollapsedHint')}</AppText> : null}
      </View>

      <View style={styles.threadContextActions}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={detailLabel} onPress={onToggle} style={({ pressed }) => [styles.threadContextAction, { backgroundColor: theme.color.text, borderColor: theme.color.text }, pressed && styles.pressed]}>
          <AppText style={[styles.threadContextActionText, { color: theme.color.background }]}>{detailLabel}</AppText>
          <MobileIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.color.background} decorative />
        </Pressable>
        {trade?.id ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('trade.proposals.openTradeDetail')} onPress={onOpenTradeDetail} style={({ pressed }) => [styles.threadContextAction, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
            <AppText style={[styles.threadContextActionText, { color: theme.color.text }]}>{t('trade.proposals.openTradeDetail')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ProposalTopSummary({ proposal, statusHint, isOwner, isApplicant, tradeCancelled, onDetails, t }: { proposal: TradeProposalItem; statusHint: string; isOwner: boolean; isApplicant: boolean; tradeCancelled: boolean; onDetails: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const sides = proposalSideItems(proposal);
  const actionLabel = tradeCancelled
    ? t('trade.proposals.showProposalItemDetails')
    : isOwner && proposal.status === 'pending'
      ? t('trade.proposals.reviewProposal')
      : isApplicant && proposal.status === 'pending'
        ? t('trade.proposals.manageProposal')
        : t('trade.proposals.showProposalItemDetails');
  return (
    <View style={[styles.topSummary, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.summaryHeaderRow}>
        <View style={styles.summaryIdentity}>
          <StatusBadge status={proposal.status} label={formatStatus(proposal.status, t)} />
          <UserIdentityPressable user={proposal.applicant} userId={proposal.applicantId} displayName={isApplicant ? t('trade.labels.you') : undefined} variant="compact" showHandle />
        </View>
        <Pressable accessibilityRole="button" onPress={onDetails} style={({ pressed }) => [styles.textLinkButton, pressed && styles.pressed]}>
          <AppText style={[styles.textLink, { color: theme.semantic.proposal.text }]}>{actionLabel}</AppText>
        </Pressable>
      </View>
      <AppText style={styles.summaryTitle} numberOfLines={2}>{proposal.trade?.title ?? t('trade.proposals.tradeProposal')}</AppText>
      {proposal.trade ? ((proposal.trade.amountCents ?? 0) > 0 ? <MoneyPill amountCents={proposal.trade.amountCents ?? 0} currency={proposal.trade.currency ?? 'eur'} label={`${formatStatus(proposal.trade.status, t)} ${t('trade.labels.trade').toLowerCase()}`} /> : <AppText style={[styles.summaryMeta, { color: theme.color.muted }]}>{t('trade.labels.serviceForService')} {t('trade.labels.trade').toLowerCase()}</AppText>) : null}
      {sides.length > 0 || proposal.cashPromise ? <View style={styles.summarySides}>{sides.map(({ kind, item }) => <CompactSidePill key={`${kind}-${item.id}`} kind={kind} item={item} t={t} />)}{proposal.cashPromise ? <CompactCashPromisePill proposal={proposal} t={t} /> : null}</View> : <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.noAttachedItem')}</AppText>}
      <View style={[styles.summaryActionHint, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
        <AppText style={[styles.summaryHint, { color: theme.color.muted }]}>{statusHint}</AppText>
        <Pressable accessibilityRole="button" onPress={onDetails} style={({ pressed }) => [styles.summaryActionButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
          <AppText style={[styles.summaryActionText, { color: theme.color.background }]}>{actionLabel}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function CompactSidePill({ kind, item, t }: { kind: ProposalSideKind; item: ProposalSideItem; t: TFunction }) {
  const theme = useThemeTokens();
  const color = theme.semantic[kind];
  return (
    <View style={[styles.compactSidePill, { backgroundColor: color.softBg, borderColor: color.border }]}>
      <SemanticBadge label={kind === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')} tone={kind} size="sm" />
      <AppText style={styles.compactSideTitle} numberOfLines={1}>{item.title}</AppText>
      <AppText style={[styles.compactSideMeta, { color: color.text }]} numberOfLines={1}>{proposalSideMeta(kind, item, t)}</AppText>
    </View>
  );
}

function SystemEvent({ label }: { label: string }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.systemEventWrap}>
      <View style={[styles.systemLine, { backgroundColor: theme.color.border }]} />
      <AppText style={[styles.systemText, { color: theme.color.muted }]} numberOfLines={2}>{label}</AppText>
      <View style={[styles.systemLine, { backgroundColor: theme.color.border }]} />
    </View>
  );
}

function EmptyChatHint({ label }: { label: string }) {
  const theme = useThemeTokens();
  return <AppText style={[styles.emptyChat, { color: theme.color.muted }]}>{label}</AppText>;
}

function ProposalNoteChatBubble({ proposal, mine, canEdit, canReport, editing, draft, error, onOptions, onChangeDraft, onSave, onCancel, actionLoading, language, t }: { proposal: TradeProposalItem; mine: boolean; canEdit: boolean; canReport: boolean; editing: boolean; draft: string; error: string | null; onOptions: () => void; onChangeDraft: (text: string) => void; onSave: () => void; onCancel: () => void; actionLoading: ActionLoading; language: SupportedLanguage; t: TFunction }) {
  const theme = useThemeTokens();
  const canOpenOptions = (canEdit || canReport) && !editing;
  if (!proposal.message && !proposal.messageDeletedAt && !editing) return null;
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <Pressable
        disabled={!canOpenOptions}
        onLongPress={canOpenOptions ? onOptions : undefined}
                      style={[
          styles.chatBubble,
          { backgroundColor: mine ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: mine ? theme.semantic.proposal.border : theme.color.border },
          mine ? styles.chatBubbleMine : styles.chatBubbleOther,
        ]}
      >
        <View style={styles.bubbleHeader}>
          <UserIdentityPressable user={proposal.applicant} userId={proposal.applicantId} displayName={mine ? t('trade.labels.you') : undefined} variant="compact" avatarSize="xs" showHandle={false} />
          {canOpenOptions ? <Pressable accessibilityRole="button" accessibilityLabel={t('trade.proposals.messageOptions')} onPress={onOptions} hitSlop={10} style={styles.moreButton}><MobileIcon name="more" size={20} color={theme.color.muted} /></Pressable> : null}
        </View>
        {editing ? (
          <View style={styles.noteEditBox}>
            <TextInput value={draft} onChangeText={onChangeDraft} multiline autoFocus placeholder={t('trade.proposals.proposalNote')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="default" blurOnSubmit={false} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
            {error ? <AppText style={styles.errorText}>{error}</AppText> : null}
            <View style={styles.inlineActions}>
              <SmallActionButton label={actionLoading === 'proposal-note' ? t('common.states.saving') : t('trade.proposals.saveProposal')} onPress={onSave} disabled={Boolean(actionLoading)} />
              <SmallActionButton label={t('common.actions.cancel')} onPress={onCancel} disabled={Boolean(actionLoading)} muted />
            </View>
          </View>
        ) : proposal.messageDeletedAt ? (
          <>
            <AppText style={styles.messageDeleted}>{t('trade.proposals.messageDeleted')}</AppText>
            <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatDeletedTrace(proposal.messageDeletedAt, language, t)}</AppText>
          </>
        ) : (
          <>
            <AppText style={styles.messageBody}>{proposal.message}</AppText>
            <View style={styles.bubbleFooter}>
              <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatTraceDate(proposal.createdAt, language)}</AppText>
              {proposal.messageEditedAt ? <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatEditTrace(proposal.messageEditCount, proposal.messageEditedAt, language, t)}</AppText> : null}
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

function PrivateMessageBubble({ message, mine, canEdit, canReport, editing, draft, error, onOptions, onChangeDraft, onSaveEdit, onCancelEdit, actionLoading, language, t }: { message: ProposalMessageItem; mine: boolean; canEdit: boolean; canReport: boolean; editing: boolean; draft: string; error: string | null; onOptions: () => void; onChangeDraft: (text: string) => void; onSaveEdit: () => void; onCancelEdit: () => void; actionLoading: ActionLoading; language: SupportedLanguage; t: TFunction }) {
  const theme = useThemeTokens();
  const canOpenOptions = (canEdit || canReport) && !editing;
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <Pressable
        disabled={!canOpenOptions}
        onLongPress={canOpenOptions ? onOptions : undefined}
                      style={[
          styles.chatBubble,
          { backgroundColor: mine ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: mine ? theme.semantic.proposal.border : theme.color.border },
          mine ? styles.chatBubbleMine : styles.chatBubbleOther,
        ]}
      >
        <View style={styles.bubbleHeader}>
          <UserIdentityPressable user={message.sender} userId={message.senderId} displayName={mine ? t('trade.labels.you') : undefined} variant="compact" avatarSize="xs" showHandle={false} />
          {canOpenOptions ? <Pressable accessibilityRole="button" accessibilityLabel={t('trade.proposals.messageOptions')} onPress={onOptions} hitSlop={10} style={styles.moreButton}><MobileIcon name="more" size={20} color={theme.color.muted} /></Pressable> : null}
        </View>
        {editing ? (
          <View style={styles.noteEditBox}>
            <TextInput value={draft} onChangeText={onChangeDraft} multiline autoFocus placeholder={t('trade.proposals.writeMessage')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="default" blurOnSubmit={false} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />
            {error ? <AppText style={styles.errorText}>{error}</AppText> : null}
            <View style={styles.inlineActions}>
              <SmallActionButton label={actionLoading === 'message-edit' ? t('common.states.saving') : t('trade.proposals.saveMessage')} onPress={onSaveEdit} disabled={Boolean(actionLoading)} />
              <SmallActionButton label={t('common.actions.cancel')} onPress={onCancelEdit} disabled={Boolean(actionLoading)} muted />
            </View>
          </View>
        ) : message.deletedAt ? (
          <>
            <AppText style={styles.messageDeleted}>{t('trade.proposals.messageDeleted')}</AppText>
            <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatDeletedTrace(message.deletedAt, language, t)}</AppText>
          </>
        ) : (
          <>
            <AppText style={styles.messageBody}>{message.body}</AppText>
            <View style={styles.bubbleFooter}>
              <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatTraceDate(message.createdAt, language)}</AppText>
              {message.editedAt ? <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatEditTrace(message.editCount, message.editedAt, language, t)}</AppText> : null}
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

function CompactCashPromisePill({ proposal, t }: { proposal: TradeProposalItem; t: TFunction }) {
  const theme = useThemeTokens();
  const cashPromise = proposal.cashPromise;
  if (!cashPromise) return null;
  return <View style={[styles.compactSidePill, { backgroundColor: theme.semantic.warning.softBg, borderColor: theme.semantic.warning.border }]}><SemanticBadge label={t('trade.cashPromise.notProcessed')} tone="warning" size="sm" /><AppText style={[styles.compactSideTitle, { color: theme.semantic.warning.text }]}>{t('trade.cashPromise.title')} · {formatMoneyAmount(cashPromise.amountCents, cashPromise.currency ?? 'eur')}</AppText></View>;
}

function ProposalDetailsSheet({ visible, proposal, requiredPackageSide, selectedPackageNeed, selectedPackageOffer, packageLoading, packageError, packageChanged, canEditProposalContent, canCancelAcceptedTrade, isOwner, isApplicant, isProvider, editingProposalNote, proposalNoteDraft, proposalNoteError, cancelTradeOpen, cancelReason, cancelError, actionLoading, language, onClose, onChooseNeed, onChooseOffer, onClearNeed, onClearOffer, onSavePackage, onStartProposalNoteEdit, onChangeProposalNote, onSaveProposalNote, onCancelProposalNoteEdit, onDeleteProposalNote, onAccept, onDecline, onWithdraw, onOpenCancelTrade, onChangeCancelReason, onCancelCancelTrade, onSubmitCancelTrade, onOpenTradeDetail, t }: { visible: boolean; proposal: TradeProposalItem; requiredPackageSide: RequiredProposalSide; selectedPackageNeed: NeedItem | null; selectedPackageOffer: OfferItem | null; packageLoading: boolean; packageError: string | null; packageChanged: boolean; canEditProposalContent: boolean; canCancelAcceptedTrade: boolean; isOwner: boolean; isApplicant: boolean; isProvider: boolean; editingProposalNote: boolean; proposalNoteDraft: string; proposalNoteError: string | null; cancelTradeOpen: boolean; cancelReason: string; cancelError: string | null; actionLoading: ActionLoading; language: SupportedLanguage; onClose: () => void; onChooseNeed: () => void; onChooseOffer: () => void; onClearNeed: () => void; onClearOffer: () => void; onSavePackage: () => void; onStartProposalNoteEdit: () => void; onChangeProposalNote: (text: string) => void; onSaveProposalNote: () => void; onCancelProposalNoteEdit: () => void; onDeleteProposalNote: () => void; onAccept: () => void; onDecline: () => void; onWithdraw: () => void; onOpenCancelTrade: () => void; onChangeCancelReason: (text: string) => void; onCancelCancelTrade: () => void; onSubmitCancelTrade: () => void; onOpenTradeDetail: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const sideItems = proposalSideItems(proposal);
  if (!visible) return null;
  return (
    <View style={styles.infoScreenRoot}>
      <AppHeader title={t('trade.proposals.showProposalItemDetails')} onBack={onClose} />
      <ScrollView contentContainerStyle={styles.infoScreenContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={[styles.infoHero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}> 
          <SemanticBadge label={proposalPackageTitle(proposal, t)} tone="proposal" size="sm" />
          <AppText style={styles.infoHeroTitle}>{proposal.trade?.title ?? t('trade.proposals.tradeProposal')}</AppText>
          <AppText style={[styles.infoHeroBody, { color: theme.color.muted }]}>{formatStatus(proposal.status, t)}{proposal.trade ? ` · ${formatStatus(proposal.trade.status, t)}` : ''}</AppText>
        </View>
            <View style={[styles.sheetSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
              <View style={styles.statusLine}><StatusBadge status={proposal.status} label={formatStatus(proposal.status, t)} />{proposal.trade ? <SemanticBadge label={formatStatus(proposal.trade.status, t)} tone="proposal" size="sm" /> : null}</View>
              <AppText style={styles.sheetTradeTitle}>{proposal.trade?.title ?? t('trade.proposals.tradeProposal')}</AppText>
              <View style={styles.peopleRow}><MiniPerson label={t('trade.labels.owner')} user={proposal.trade?.owner} userId={proposal.trade?.ownerId} tone="need" /><MiniPerson label={t('trade.labels.applicant')} user={proposal.applicant} userId={proposal.applicantId} displayName={isApplicant ? t('trade.labels.you') : undefined} tone="offer" /></View>
              {proposal.trade?.cancelledAt ? <InfoNotice tone="warning" title={t('trade.proposals.tradeCancelled')} body={t('trade.proposals.tradeCancelledWithReason', { date: formatTraceDate(proposal.trade.cancelledAt, language), reason: proposal.trade.cancelReason || t('trade.proposals.noCancelReason') })} /> : null}
            </View>

            {sideItems.length === 0 && !proposal.cashPromise ? <InfoNotice tone="info" title={t('trade.proposals.changeProposalItem')} body={t('trade.proposals.noAttachedItem')} /> : (
              <>
                {sideItems.map(({ kind, item }) => <ProposalSideDetailCard key={`${kind}-${item.id}`} kind={kind} item={item} t={t} />)}
                {proposal.cashPromise ? <CashPromiseInlineItem amountCents={proposal.cashPromise.amountCents} currency={proposal.cashPromise.currency ?? 'eur'} side={proposal.cashPromise.side} note={proposal.cashPromise.note ?? null} t={t} /> : null}
              </>
            )}

            {canEditProposalContent ? <ProposalPackageEditor requiredSide={requiredPackageSide} need={selectedPackageNeed} offer={selectedPackageOffer} loading={packageLoading} error={packageError} changed={packageChanged} saving={actionLoading === 'proposal-package'} onChooseNeed={onChooseNeed} onChooseOffer={onChooseOffer} onClearNeed={onClearNeed} onClearOffer={onClearOffer} onSave={onSavePackage} t={t} /> : null}

            {canEditProposalContent ? (
              <View style={[styles.sheetSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
                <SemanticBadge label={t('trade.proposals.proposalNote')} tone="proposal" size="sm" />
                {editingProposalNote ? <View style={styles.noteEditBox}><TextInput value={proposalNoteDraft} onChangeText={onChangeProposalNote} multiline autoFocus placeholder={t('trade.proposals.proposalNote')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="default" blurOnSubmit={false} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />{proposalNoteError ? <AppText style={styles.errorText}>{proposalNoteError}</AppText> : null}<View style={styles.inlineActions}><SmallActionButton label={actionLoading === 'proposal-note' ? t('common.states.saving') : t('trade.proposals.saveProposal')} onPress={onSaveProposalNote} disabled={Boolean(actionLoading)} /><SmallActionButton label={t('common.actions.cancel')} onPress={onCancelProposalNoteEdit} disabled={Boolean(actionLoading)} muted /></View></View> : <View style={styles.inlineActions}><SmallActionButton label={proposal.messageDeletedAt ? t('trade.proposals.addProposalNote') : t('trade.proposals.editProposal')} onPress={onStartProposalNoteEdit} disabled={Boolean(actionLoading)} />{!proposal.messageDeletedAt ? <SmallActionButton label={t('trade.proposals.deleteProposalNote')} onPress={onDeleteProposalNote} disabled={Boolean(actionLoading)} danger /> : null}</View>}
              </View>
            ) : null}

            <ProposalActionCenter
              proposal={proposal}
              canCancelAcceptedTrade={canCancelAcceptedTrade}
              isOwner={isOwner}
              isApplicant={isApplicant}
              isProvider={isProvider}
              cancelTradeOpen={cancelTradeOpen}
              cancelReason={cancelReason}
              cancelError={cancelError}
              actionLoading={actionLoading}
              onAccept={onAccept}
              onDecline={onDecline}
              onWithdraw={onWithdraw}
              onOpenCancelTrade={onOpenCancelTrade}
              onChangeCancelReason={onChangeCancelReason}
              onCancelCancelTrade={onCancelCancelTrade}
              onSubmitCancelTrade={onSubmitCancelTrade}
              onOpenTradeDetail={onOpenTradeDetail}
              t={t}
            />
      </ScrollView>
    </View>
  );
}


function ProposalActionCenter({ proposal, canCancelAcceptedTrade, isOwner, isApplicant, isProvider, cancelTradeOpen, cancelReason, cancelError, actionLoading, onAccept, onDecline, onWithdraw, onOpenCancelTrade, onChangeCancelReason, onCancelCancelTrade, onSubmitCancelTrade, onOpenTradeDetail, t }: { proposal: TradeProposalItem; canCancelAcceptedTrade: boolean; isOwner: boolean; isApplicant: boolean; isProvider: boolean; cancelTradeOpen: boolean; cancelReason: string; cancelError: string | null; actionLoading: ActionLoading; onAccept: () => void; onDecline: () => void; onWithdraw: () => void; onOpenCancelTrade: () => void; onChangeCancelReason: (text: string) => void; onCancelCancelTrade: () => void; onSubmitCancelTrade: () => void; onOpenTradeDetail: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const isPending = proposal.status === 'pending';
  const isAccepted = proposal.status === 'accepted';
  const isClosed = ['declined', 'withdrawn'].includes(proposal.status) || ['cancelled', 'closed'].includes(proposal.trade?.status ?? '');
  const title = isPending && isOwner
    ? t('trade.proposals.reviewProposal')
    : isPending && isApplicant
      ? t('trade.proposals.manageProposal')
      : isAccepted
        ? t('trade.proposals.acceptedConversation')
        : t('trade.proposals.closedConversation');
  const body = isPending && isOwner
    ? t('trade.proposals.reviewProposalBody')
    : isPending && isApplicant
      ? t('trade.proposals.manageProposalBody')
      : isAccepted
        ? t('trade.proposals.acceptedActionsBody')
        : t('trade.proposals.closedActionsBody');
  return (
    <View style={[styles.sheetSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.actionCenterHeader}>
        <View style={styles.actionCenterCopy}>
          <AppText style={styles.sectionTitle}>{title}</AppText>
          <AppText style={[styles.muted, { color: theme.color.muted }]}>{body}</AppText>
        </View>
        <StatusBadge status={proposal.status} label={formatStatus(proposal.status, t)} />
      </View>

      {isOwner && isPending ? (
        <View style={styles.actionRow}>
          <ProposalActionButton label={actionLoading === 'accepted' ? t('trade.proposals.accepting') : t('trade.proposals.accept')} variant="primary" disabled={Boolean(actionLoading)} onPress={onAccept} />
          <ProposalActionButton label={actionLoading === 'declined' ? t('trade.proposals.declining') : t('trade.proposals.decline')} variant="danger" disabled={Boolean(actionLoading)} onPress={onDecline} />
        </View>
      ) : null}

      {isApplicant && isPending ? <ProposalActionButton label={actionLoading === 'withdrawn' ? t('trade.proposals.withdrawing') : t('trade.proposals.withdraw')} variant="danger" disabled={Boolean(actionLoading)} onPress={onWithdraw} /> : null}

      {isAccepted && isProvider ? <InfoNotice tone="success" title={t('trade.proposals.acceptedProvider')} body={t('trade.proposals.acceptedProviderBody')} /> : null}

      {canCancelAcceptedTrade ? cancelTradeOpen ? <CancelTradeForm reason={cancelReason} error={cancelError} loading={actionLoading === 'cancel-trade'} onChangeReason={onChangeCancelReason} onCancel={onCancelCancelTrade} onSubmit={onSubmitCancelTrade} t={t} /> : <SmallActionButton label={t('trade.proposals.cancelAcceptedTrade')} onPress={onOpenCancelTrade} disabled={Boolean(actionLoading)} danger /> : null}

      {proposal.trade?.id && !cancelTradeOpen ? <SmallActionButton label={t('trade.proposals.openTradeDetail')} onPress={onOpenTradeDetail} disabled={Boolean(actionLoading)} muted={isClosed} /> : null}
    </View>
  );
}

function MiniPerson({ label, user, userId, displayName, tone }: { label: string; user?: TradeProposalItem['applicant']; userId?: string | null; displayName?: string | null; tone: 'need' | 'offer' }) {
  const theme = useThemeTokens();
  return <View style={[styles.personBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SemanticBadge label={label} tone={tone} size="sm" /><UserIdentityPressable user={user} userId={userId} displayName={displayName} variant="compact" showHandle /></View>;
}

function ProposalPackageEditor({ requiredSide, need, offer, loading, error, changed, saving, onChooseNeed, onChooseOffer, onClearNeed, onClearOffer, onSave, t }: { requiredSide: RequiredProposalSide; need: NeedItem | null; offer: OfferItem | null; loading: boolean; error: string | null; changed: boolean; saving: boolean; onChooseNeed: () => void; onChooseOffer: () => void; onClearNeed: () => void; onClearOffer: () => void; onSave: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.sheetSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.packageEditorHeader}>
        <SemanticBadge label={t('trade.proposals.changeProposalItem')} tone="proposal" size="sm" />
        {loading ? <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{t('trade.proposals.loadingInventory')}</AppText> : null}
      </View>
      {error ? <InfoNotice tone="danger" title={t('trade.proposals.couldNotUpdateProposal')} body={error} /> : null}
      <ProposalPackagePickerRow kind="offer" item={offer} required={requiredSide === 'offer'} title={requiredSide === 'offer' ? t('trade.proposals.chooseOfferToPropose') : t('trade.proposals.optionalOfferBody')} onChoose={onChooseOffer} onClear={onClearOffer} canClear={requiredSide !== 'offer'} t={t} />
      <ProposalPackagePickerRow kind="need" item={need} required={requiredSide === 'need'} title={requiredSide === 'need' ? t('trade.proposals.chooseNeedToPropose') : t('trade.proposals.optionalNeedBody')} onChoose={onChooseNeed} onClear={onClearNeed} canClear={requiredSide !== 'need'} t={t} />
      <SmallActionButton label={saving ? t('common.states.saving') : t('trade.proposals.saveProposal')} onPress={onSave} disabled={!changed || saving || loading} />
    </View>
  );
}

function ProposalPackagePickerRow({ kind, item, required, title, onChoose, onClear, canClear, t }: { kind: ProposalSideKind; item: ProposalSideItem | null; required: boolean; title: string; onChoose: () => void; onClear: () => void; canClear: boolean; t: TFunction }) {
  const theme = useThemeTokens();
  const color = theme.semantic[kind];
  return (
    <View style={[styles.packagePickerRow, { backgroundColor: theme.color.subtleSurface, borderColor: item ? color.border : theme.color.border }]}>
      <View style={styles.packagePickerCopy}>
        <View style={styles.packagePickerTitleRow}>
          <SemanticBadge label={kind === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')} tone={kind} size="sm" />
          {required ? <SemanticBadge label={t('common.states.required')} tone={kind} size="sm" /> : null}
        </View>
        <AppText style={styles.packagePickerTitle}>{item ? item.title : title}</AppText>
        <AppText style={[styles.packagePickerMeta, { color: item ? color.text : theme.color.muted }]}>{item ? proposalSideMeta(kind, item, t) : t('trade.proposals.noProposalItemSelected')}</AppText>
      </View>
      <View style={styles.packagePickerActions}>
        <SmallActionButton label={item ? (kind === 'need' ? t('trade.proposals.changeNeed') : t('trade.proposals.changeOffer')) : (kind === 'need' ? t('trade.proposals.chooseNeed') : t('trade.proposals.chooseOffer'))} onPress={onChoose} />
        {item && canClear ? <SmallActionButton label={kind === 'need' ? t('trade.proposals.removeNeed') : t('trade.proposals.removeOffer')} onPress={onClear} muted /> : null}
      </View>
    </View>
  );
}

function ProposalSideDetailCard({ kind, item, t }: { kind: ProposalSideKind; item: ProposalSideItem; t: TFunction }) {
  const theme = useThemeTokens();
  const color = theme.semantic[kind];
  const tags = item.tags ?? [];
  return (
    <View style={[styles.sheetSection, { backgroundColor: color.softBg, borderColor: color.border }]}>
      <View style={styles.proposedSideHeader}>
        <SemanticBadge label={kind === 'need' ? t('trade.labels.proposedNeed') : t('trade.labels.proposedOffer')} tone={kind} size="sm" />
        <AppText style={[styles.proposedSideKind, { color: color.text }]}>{kind === 'need' ? t('trade.proposals.needProposal') : t('trade.proposals.offerProposal')}</AppText>
      </View>
      <AppText style={styles.proposedSideTitle}>{item.title}</AppText>
      <AppText style={[styles.proposedSideMeta, { color: color.text }]}>{proposalSideMeta(kind, item, t)}</AppText>
      <AppText style={[styles.proposedSideBody, { color: color.text }]}>{proposalSideDescription(item, t)}</AppText>
      <View style={styles.expandedDetails}>
        <DetailRow label={t('trade.labels.category')} value={item.category || t('trade.labels.noDescription')} />
        <DetailRow label={kind === 'need' ? t('trade.labels.timing') : t('trade.labels.availability')} value={kind === 'need' ? ((item as NeedItem).timing || '-') : ((item as OfferItem).availability || '-')} />
        <DetailRow label={t('trade.labels.mode')} value={modeLabel(item.mode, t) || '-'} />
        <DetailRow label={t('trade.labels.location')} value={item.locationLabel || '-'} />
        {tags.length > 0 ? <DetailRow label={t('trade.labels.tags')} value={tags.join(' · ')} /> : null}
        <MediaStrip media={item.media} size="large" />
        {!item.media || item.media.length === 0 ? <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.noProposalItemImages')}</AppText> : null}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();
  return <View style={[styles.detailRow, { borderBottomColor: theme.color.border }]}><AppText style={[styles.detailLabel, { color: theme.color.muted }]}>{label}</AppText><AppText style={styles.detailValue}>{value}</AppText></View>;
}


function ProblemReportSheet({ visible, summary, error, loading, onChangeSummary, onCancel, onSubmit, t }: { visible: boolean; summary: string; error: string | null; loading: boolean; onChangeSummary: (text: string) => void; onCancel: () => void; onSubmit: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onCancel} />
        <View style={[styles.problemSheet, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.problemSheetHeader}>
            <View style={[styles.problemSheetIcon, { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border }]}>
              <MobileIcon name="warning" size={22} color={theme.semantic.danger.text} decorative />
            </View>
            <View style={styles.problemSheetCopy}>
              <SemanticBadge label={t('trade.deal.problemReportBadge')} tone="danger" size="sm" />
              <AppText style={styles.problemSheetTitle}>{t('trade.deal.problemReportTitle')}</AppText>
              <AppText style={[styles.problemSheetBody, { color: theme.color.muted }]}>{t('trade.deal.problemReportBody')}</AppText>
            </View>
          </View>
          <InfoNotice tone="warning" title={t('trade.deal.problemReportEvidenceTitle')} body={t('trade.deal.problemReportEvidenceBody')} />
          <TextInput
            value={summary}
            onChangeText={onChangeSummary}
            multiline
            textAlignVertical="top"
            placeholder={t('trade.deal.problemReportPlaceholder')}
            placeholderTextColor={theme.color.muted}
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                      returnKeyType="default"
                      blurOnSubmit={false}
                      style={[styles.problemTextArea, { backgroundColor: theme.color.subtleSurface, borderColor: error ? theme.semantic.danger.border : theme.color.border, color: theme.color.text }]}
          />
          {error ? <AppText style={styles.errorText}>{error}</AppText> : null}
          <View style={styles.inlineActions}>
            <SmallActionButton label={loading ? t('common.states.working') : t('trade.deal.problemReportSubmit')} onPress={onSubmit} disabled={loading} danger />
            <SmallActionButton label={t('common.actions.cancel')} onPress={onCancel} disabled={loading} muted />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CancelTradeForm({ reason, error, loading, onChangeReason, onCancel, onSubmit, t }: { reason: string; error: string | null; loading: boolean; onChangeReason: (text: string) => void; onCancel: () => void; onSubmit: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  return <View style={[styles.cancelBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={styles.cancelTitle}>{t('trade.proposals.cancelAcceptedTradeTitle')}</AppText><AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.cancelAcceptedTradeBody')}</AppText><TextInput value={reason} onChangeText={onChangeReason} multiline placeholder={t('trade.proposals.cancelReasonPlaceholder')} placeholderTextColor={theme.color.muted} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} returnKeyType="default" blurOnSubmit={false} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />{error ? <AppText style={styles.errorText}>{error}</AppText> : null}<View style={styles.inlineActions}><SmallActionButton label={loading ? t('trade.proposals.cancellingTrade') : t('trade.proposals.cancelAcceptedTradeAction')} onPress={onSubmit} disabled={loading} danger /><SmallActionButton label={t('trade.proposals.keepAcceptedTrade')} onPress={onCancel} disabled={loading} muted /></View></View>;
}

function SmallActionButton({ label, onPress, disabled, danger, muted }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; muted?: boolean }) {
  const theme = useThemeTokens();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallButton, { backgroundColor: danger ? '#FEE2E2' : muted ? theme.color.surface : theme.color.text, borderColor: danger ? '#FCA5A5' : theme.color.border }, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><AppText style={[styles.smallButtonText, { color: danger ? '#991B1B' : muted ? theme.color.text : theme.color.background }]}>{label}</AppText></Pressable>;
}

function ProposalActionButton({ label, variant, disabled, onPress }: { label: string; variant: 'primary' | 'danger'; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, variant === 'primary' ? styles.primaryButton : styles.dangerButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionText, variant === 'primary' ? styles.primaryText : styles.dangerText]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  chatRoot: { flex: 1, minHeight: 0 },
  chatScroll: { flex: 1 },
  chatContent: { paddingTop: 10, paddingBottom: 24, gap: 12 },
  infoScreenRoot: { flex: 1, minHeight: 0 },
  infoScreenContent: { paddingTop: 14, paddingBottom: 28, gap: 12 },
  infoHero: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 9 },
  infoHeroTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.55 },
  infoHeroBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  infoMenuItem: { borderRadius: 22, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoMenuIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoMenuCopy: { flex: 1, minWidth: 0, gap: 4 },
  infoMenuTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.2 },
  infoMenuBody: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  infoSection: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 12 },
  loadingContent: { paddingTop: 18, paddingBottom: 28 },
  loadingCard: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 12 },
  threadContextCard: { borderRadius: 24, borderWidth: 1, padding: 14, gap: 11 },
  threadContextTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  threadContextIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  threadContextCopy: { flex: 1, minWidth: 0, gap: 5 },
  threadContextBadges: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  threadContextTitleButton: { alignSelf: 'stretch' },
  threadContextTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.25 },
  threadContextMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  threadContextStatus: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 5 },
  threadContextHint: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  threadContextCollapsedHint: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  threadContextActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  threadContextAction: { minHeight: 38, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12 },
  threadContextActionText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  threadDetailsPanel: { borderRadius: 24, borderWidth: 1, padding: 14, gap: 12 },
  threadDetailsPanelHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  threadDetailsPanelTitleWrap: { flex: 1, minWidth: 0, gap: 5 },
  threadDetailsPanelBadges: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  threadDetailsPanelTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.35 },
  threadDetailsPanelBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  threadDetailsPanelClose: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  threadDetailsPanelContent: { gap: 12 },
  timelineShell: { marginHorizontal: -APP_SCREEN_HORIZONTAL_PADDING, paddingHorizontal: APP_SCREEN_HORIZONTAL_PADDING, paddingTop: 12, borderTopWidth: 1, gap: 12 },
  timelineHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  timelineHeaderCopy: { flex: 1, minWidth: 0, gap: 3 },
  timelineTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.25 },
  timelineBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  timelineMessages: { gap: 7 },
  threadTradeStrip: { paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  threadTradeIconRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  threadTradeIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  threadTradeCopy: { flex: 1, minWidth: 0, gap: 4 },
  threadEyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.65, textTransform: 'uppercase' },
  threadTradeTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.35 },
  threadTradeMeta: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  threadTradeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 54 },
  dealStack: { gap: 12 },
  dealSummaryCard: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 9 },
  dealSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dealSummaryTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.35 },
  dealSummaryMeta: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  dealAgreementGrid: { gap: 9 },
  dealAcceptedMessage: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 6 },
  dealAcceptedMessageLabel: { fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  dealAcceptedMessageText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  dealAgreementColumn: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  dealAgreementItem: { gap: 3 },
  dealAgreementTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  dealAgreementMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  dealAgreementEmpty: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  dealDetailsButton: { minHeight: 40, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  dealDetailsText: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  dealGuardCard: { borderRadius: 18, borderWidth: 1, padding: 13, gap: 8 },
  dealGuardCardCompact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dealGuardCopy: { flex: 1, minWidth: 0, gap: 4 },
  dealCollapsedSection: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  dealCollapsedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  dealCollapsedCopy: { flex: 1, minWidth: 0, gap: 6 },
  dealCollapsedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dealCollapsedTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.2 },
  dealCollapsedBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  dealCollapsedIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dealCollapsedContent: { paddingHorizontal: 13, paddingBottom: 13, gap: 12 },
  dealGuardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  dealGuardBody: { lineHeight: 20, fontWeight: '700' },
  safetyChecklist: { gap: 10 },
  safetyChecklistItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  safetyCheck: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  safetyCheckText: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  safetyChecklistText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  dealProgressList: { gap: 9 },
  dealProgressStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dealProgressDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dealProgressDotText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  dealProgressLabel: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  actionRowWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBlockCopy: { gap: 10 },
  statusHintText: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  inlineDetailsButton: { minHeight: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 },
  inlineDetailsText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  inlinePackageList: { gap: 0 },
  inlinePackageEmpty: { borderRadius: 18, borderWidth: 1, minHeight: 58, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlinePackageEmptyText: { flex: 1, lineHeight: 19, fontWeight: '800' },
  inlineSideItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, borderTopWidth: 1 },
  inlineSideIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  inlineSideCopy: { flex: 1, minWidth: 0, gap: 5 },
  inlineSideHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  inlineSideTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.2 },
  inlineSideMeta: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  inlineSideDescription: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  inlineEmptyState: { borderStyle: 'dashed' },
  headerDetailsButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerDetailsText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  threadGuideContent: { gap: 14 },
  threadGuideTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.4 },
  threadGuideBody: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  threadGuideSection: { borderTopWidth: 1, paddingTop: 14, gap: 6 },
  threadGuideSectionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  threadGuideSectionBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  topSummary: { borderRadius: 26, borderWidth: 1, padding: 16, gap: 12 },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  summaryIdentity: { flex: 1, gap: 8 },
  textLinkButton: { minHeight: 32, justifyContent: 'center' },
  textLink: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  summaryTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.55 },
  summaryMeta: { lineHeight: 20, fontWeight: '800' },
  summarySides: { gap: 8 },
  summaryHint: { flex: 1, lineHeight: 20, fontWeight: '700' },
  summaryActionHint: { borderRadius: 20, borderWidth: 1, padding: 12, gap: 12 },
  summaryActionButton: { minHeight: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  summaryActionText: { fontWeight: '900' },
  compactSidePill: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 4 },
  compactSideTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  compactSideMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  systemEventWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  systemLine: { flex: 1, height: 1 },
  systemText: { maxWidth: '74%', textAlign: 'center', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  emptyChat: { alignSelf: 'center', paddingVertical: 18, fontWeight: '800' },
  messageRow: { alignItems: 'flex-start', paddingVertical: 1 },
  messageRowMine: { alignItems: 'flex-end' },
  chatBubble: { maxWidth: '84%', borderRadius: 22, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  chatBubbleMine: { borderBottomRightRadius: 7 },
  chatBubbleOther: { borderBottomLeftRadius: 7 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bubbleFooter: { gap: 3, alignItems: 'flex-end' },
  moreButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  messageBody: { lineHeight: 21, fontWeight: '700' },
  messageMeta: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  messageDeleted: { fontStyle: 'italic', lineHeight: 20, fontWeight: '800', opacity: 0.74 },
  composerBar: { borderTopWidth: 1, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  chatInput: { flex: 1, maxHeight: 118, minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  sendButton: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  sendButtonText: { fontWeight: '900' },
  closedBar: { borderRadius: 20, borderWidth: 1, padding: 12, marginTop: 10, marginBottom: 10 },
  closedText: { textAlign: 'center', fontWeight: '800', lineHeight: 19 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.42)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 0 },
  sheetHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 999, backgroundColor: 'rgba(148, 163, 184, 0.8)', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  sheetTitleWrap: { flex: 1, gap: 2 },
  sheetTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.4 },
  sheetSubtitle: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  closeButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 27, lineHeight: 29, fontWeight: '800' },
  sheetContent: { paddingBottom: 28, gap: 12 },
  sheetSection: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 12 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sheetTradeTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.35 },
  peopleRow: { flexDirection: 'row', gap: 10 },
  personBox: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, gap: 8 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.2 },
  actionCenterHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  actionCenterCopy: { flex: 1, gap: 6 },
  packageEditorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  packagePickerRow: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 10 },
  packagePickerCopy: { gap: 6 },
  packagePickerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  packagePickerTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  packagePickerMeta: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  packagePickerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  proposedSideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  proposedSideKind: { fontSize: 11, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  proposedSideTitle: { fontWeight: '900', fontSize: 20, lineHeight: 25 },
  proposedSideMeta: { fontSize: 12, lineHeight: 17, fontWeight: '900' },
  proposedSideBody: { lineHeight: 20, fontWeight: '700' },
  expandedDetails: { gap: 8, paddingTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1 },
  detailLabel: { fontSize: 12, fontWeight: '800' },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  noteEditBox: { gap: 8 },
  input: { minHeight: 80, borderRadius: 16, borderWidth: 1, padding: 12, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  inlineActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  smallButton: { minHeight: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 12 },
  primaryButton: { backgroundColor: '#0F766E' },
  dangerButton: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  actionText: { fontWeight: '900' },
  primaryText: { color: '#FFFFFF' },
  dangerText: { color: '#991B1B' },
  problemSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 14 },
  problemSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  problemSheetIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  problemSheetCopy: { flex: 1, gap: 6 },
  problemSheetTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.35 },
  problemSheetBody: { lineHeight: 20, fontWeight: '700' },
  problemTextArea: { minHeight: 128, borderRadius: 18, borderWidth: 1, padding: 13, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  cancelBox: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  cancelTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  muted: { lineHeight: 20, fontWeight: '700' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
