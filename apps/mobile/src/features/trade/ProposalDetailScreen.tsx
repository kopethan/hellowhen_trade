import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProposalActionStatus } from '@hellowhen/contracts';
import { formatLocalizedDateTime, type SupportedLanguage } from '@hellowhen/i18n';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppActionSheet, type AppActionSheetAction } from '../../components/AppActionSheet';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { MoneyPill, InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { UserIdentityPressable } from '../users/UserIdentityPressable';
import { MediaStrip } from './components/MediaStrip';
import type { NeedItem, OfferItem, ProposalMessageItem, TradeDeckItem, TradeProposalItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProposalDetail'>;
type ProposalResponse = { proposal: TradeProposalItem; trade?: TradeDeckItem };
type MessagesResponse = { messages: ProposalMessageItem[] };
type MessageMutationResponse = { message?: ProposalMessageItem; proposal?: TradeProposalItem };
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
type ProposalSideKind = 'need' | 'offer';
type RequiredProposalSide = ProposalSideKind | null;
type ProposalSideItem = NeedItem | OfferItem;
type ActionLoading = ProposalActionStatus | 'send' | 'proposal-note' | 'proposal-package' | 'delete-proposal-note' | 'message-edit' | 'message-delete' | 'cancel-trade' | null;
type ProposalActionSheet =
  | { type: 'status'; status: ProposalActionStatus }
  | { type: 'message-options'; message: ProposalMessageItem }
  | { type: 'delete-message'; messageId: string }
  | { type: 'proposal-note-options' }
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
  return t('trade.proposals.tradeRequest');
}

function isThreadClosed(proposal: TradeProposalItem | null) {
  if (!proposal) return true;
  return ['declined', 'withdrawn'].includes(proposal.status) || ['cancelled', 'closed'].includes(proposal.trade?.status ?? '');
}

function isTradeCancelled(proposal: TradeProposalItem | null) {
  return proposal?.trade?.status === 'cancelled';
}

function firstNonDeletedMessages(messages: ProposalMessageItem[], proposal: TradeProposalItem) {
  return messages.filter((message) => !(message.senderId === proposal.applicantId && (message.body.trim() === proposal.message.trim() || Boolean(proposal.messageDeletedAt && message.deletedAt))));
}

export function ProposalDetailScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const [proposal, setProposal] = useState<TradeProposalItem | null>(null);
  const [messages, setMessages] = useState<ProposalMessageItem[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  const [actionSheet, setActionSheet] = useState<ProposalActionSheet>(null);

  const loadMessages = useCallback(async () => {
    const messageResult = await api.proposals.messages(route.params.proposalId) as MessagesResponse;
    setMessages(messageResult.messages ?? []);
  }, [route.params.proposalId]);

  const loadProposal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.proposals.get(route.params.proposalId) as ProposalResponse;
      setProposal(result.proposal);
      setPackageNeedId(route.params.selectedProposalNeedId ?? result.proposal.proposedNeedId ?? result.proposal.proposedNeed?.id ?? '');
      setPackageOfferId(route.params.selectedProposalOfferId ?? result.proposal.proposedOfferId ?? result.proposal.proposedOffer?.id ?? '');
      setMessages(result.proposal.messages ?? []);
      try { await loadMessages(); } catch { /* keep proposal-attached messages if the standalone list fails */ }
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.errors.couldNotLoadProposal')));
    } finally {
      setLoading(false);
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
  const canEditOwnPrivateMessages = Boolean(proposal && proposal.status === 'pending' && !tradeCancelled && (isOwner || isApplicant || isProvider));
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

  const activePackageNeeds = useMemo(() => proposalNeeds.filter(isNeedAvailable), [proposalNeeds]);
  const activePackageOffers = useMemo(() => proposalOffers.filter(isOfferAvailable), [proposalOffers]);
  const selectedPackageNeed = useMemo(() => activePackageNeeds.find((need) => need.id === packageNeedId) ?? (proposal?.proposedNeed?.id === packageNeedId ? proposal.proposedNeed as NeedItem : null), [activePackageNeeds, packageNeedId, proposal?.proposedNeed]);
  const selectedPackageOffer = useMemo(() => activePackageOffers.find((offer) => offer.id === packageOfferId) ?? (proposal?.proposedOffer?.id === packageOfferId ? proposal.proposedOffer as OfferItem : null), [activePackageOffers, packageOfferId, proposal?.proposedOffer]);
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

  async function refreshConversation() {
    const result = await api.proposals.get(route.params.proposalId) as ProposalResponse;
    setProposal(result.proposal);
    await loadMessages();
  }

  async function sendMessage() {
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
    setActionLoading(status);
    setError(null);
    setNotice(null);
    try {
      const result = await api.proposals.updateStatus(route.params.proposalId, { status }) as ProposalResponse;
      setProposal(result.proposal);
      if (result.proposal.messages) setMessages(result.proposal.messages);
      setNotice(status === 'accepted' ? t('trade.proposals.proposalAcceptedNative') : status === 'declined' ? t('trade.proposals.proposalDeclined') : t('trade.proposals.proposalWithdrawn'));
      setActionSheet(null);
      setDetailsOpen(false);
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
    if (!proposal) return;
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
    setDetailsOpen(true);
  }

  async function saveProposalNote() {
    if (!proposal) return;
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
    if (!canEdit) return;
    setActionSheet({ type: 'message-options', message });
  }

  function openProposalNoteOptions() {
    if (!canEditProposalContent) return;
    setActionSheet({ type: 'proposal-note-options' });
  }

  async function deletePrivateMessage(messageId: string) {
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

  async function cancelAcceptedTrade() {
    if (!proposal?.trade?.id) return;
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
      setDetailsOpen(false);
      setNotice(t('trade.proposals.tradeCancelled'));
      await refreshConversation();
    } catch (caughtError) {
      setCancelError(getFriendlyApiErrorMessage(caughtError, t('trade.proposals.couldNotCancelTrade')));
    } finally {
      setActionLoading(null);
    }
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

    if (actionSheet.type === 'message-options') {
      const message = actionSheet.message;
      return {
        title: t('trade.proposals.proposalConversation'),
        actions: [
          { key: 'edit', label: t('trade.proposals.editMessage'), icon: 'more', onPress: () => { startMessageEdit(message); setActionSheet(null); } },
          { key: 'delete', label: t('trade.proposals.deleteMessage'), icon: 'report-flag', tone: 'danger', onPress: () => setActionSheet({ type: 'delete-message', messageId: message.id }) },
        ],
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
      const actions: AppActionSheetAction[] = [
        { key: 'edit-note', label: proposal?.messageDeletedAt ? t('trade.proposals.addProposalNote') : t('trade.proposals.editProposal'), icon: 'more', onPress: () => { startProposalNoteEdit(); setActionSheet(null); } },
      ];
      if (!proposal?.messageDeletedAt) {
        actions.push({ key: 'delete-note', label: t('trade.proposals.deleteProposalNote'), icon: 'report-flag', tone: 'danger', onPress: () => setActionSheet({ type: 'delete-proposal-note' }) });
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

  const headerTitle = proposal
    ? isApplicant
      ? proposal.trade?.owner?.profile?.displayName || proposal.trade?.owner?.profile?.handle || t('trade.labels.owner')
      : proposal.applicant?.profile?.displayName || proposal.applicant?.profile?.handle || t('trade.proposals.tradeProposal')
    : t('trade.proposals.tradeProposal');

  return (
    <AppScreen style={styles.screen}>
      <AppHeader
        title={scrolledCompact && proposal ? `${headerTitle} · ${formatStatus(proposal.status, t)}` : headerTitle}
        onBack={() => navigation.goBack()}
        rightSlot={proposal ? <HeaderDetailsButton onPress={() => setDetailsOpen(true)} label={t('trade.proposals.showProposalItemDetails')} /> : null}
      />

      {!proposal ? (
        <ScrollView contentContainerStyle={styles.loadingContent} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProposal(); }} />}>
          <View style={[styles.loadingCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
            <SemanticBadge label={t('trade.proposals.tradeProposal')} tone="proposal" />
            {error ? <InfoNotice tone="danger" title={t('trade.detail.tradeError')} body={error} /> : <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.loadingProposal')}</AppText>}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chatRoot} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
          <ScrollView
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(event) => {
              const nextCompact = event.nativeEvent.contentOffset.y > 84;
              if (nextCompact !== scrolledCompact) setScrolledCompact(nextCompact);
            }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProposal(); }} />}
          >
            <ProposalTopSummary
              proposal={proposal}
              statusHint={statusHint}
              isOwner={Boolean(isOwner)}
              isApplicant={Boolean(isApplicant)}
              tradeCancelled={tradeCancelled}
              onDetails={() => setDetailsOpen(true)}
              t={t}
            />

            {error ? <InfoNotice tone="danger" title={t('trade.detail.tradeError')} body={error} /> : null}
            {notice ? <InfoNotice tone="success" title={t('trade.proposals.proposalUpdated')} body={notice} /> : null}
            {proposal.trade?.cancelledAt ? <InfoNotice tone="warning" title={t('trade.proposals.tradeCancelled')} body={t('trade.proposals.tradeCancelledWithReason', { date: formatTraceDate(proposal.trade.cancelledAt, language), reason: proposal.trade.cancelReason || t('trade.proposals.noCancelReason') })} /> : null}

            <SystemEvent label={statusHint} />
            <ProposalNoteChatBubble proposal={proposal} mine={isApplicant} canEdit={canEditProposalContent} editing={editingProposalNote} draft={proposalNoteDraft} error={proposalNoteError} onOptions={openProposalNoteOptions} onChangeDraft={(text) => { setProposalNoteDraft(text); if (proposalNoteError) setProposalNoteError(null); }} onSave={() => { void saveProposalNote(); }} onCancel={() => { setEditingProposalNote(false); setProposalNoteDraft(''); setProposalNoteError(null); }} actionLoading={actionLoading} language={language} t={t} />

            {visibleMessages.length === 0 ? <EmptyChatHint label={t('trade.proposals.noMessages')} /> : visibleMessages.map((message) => (
              <PrivateMessageBubble
                key={message.id}
                message={message}
                mine={message.senderId === actorId}
                canEdit={message.senderId === actorId && canEditOwnPrivateMessages && !message.deletedAt}
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
          </ScrollView>

          {canMessage ? (
            <View style={[styles.composerBar, { backgroundColor: theme.color.background, borderTopColor: theme.color.border }]}>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                placeholder={t('trade.proposals.replyPrivately')}
                placeholderTextColor={theme.color.muted}
                style={[styles.chatInput, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]}
              />
              <Pressable accessibilityRole="button" disabled={Boolean(actionLoading) || body.trim().length === 0} onPress={() => { void sendMessage(); }} style={({ pressed }) => [styles.sendButton, { backgroundColor: theme.color.text }, (Boolean(actionLoading) || body.trim().length === 0) && styles.disabled, pressed && styles.pressed]}>
                <AppText style={[styles.sendButtonText, { color: theme.color.background }]}>{actionLoading === 'send' ? t('trade.proposals.sending') : t('trade.proposals.send')}</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.closedBar, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
              <AppText style={[styles.closedText, { color: theme.color.muted }]}>{tradeCancelled ? t('trade.proposals.cancelledConversationClosed') : t('trade.proposals.closedConversation')}</AppText>
            </View>
          )}

          <ProposalDetailsSheet
            visible={detailsOpen}
            proposal={proposal}
            requiredPackageSide={requiredPackageSide}
            selectedPackageNeed={selectedPackageNeed}
            selectedPackageOffer={selectedPackageOffer}
            packageLoading={packageLoading}
            packageError={packageError}
            packageChanged={packageChanged}
            canEditProposalContent={canEditProposalContent}
            canCancelAcceptedTrade={canCancelAcceptedTrade}
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
            language={language}
            onClose={() => setDetailsOpen(false)}
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
            onOpenCancelTrade={() => setCancelTradeOpen(true)}
            onChangeCancelReason={(text) => { setCancelReason(text); if (cancelError) setCancelError(null); }}
            onCancelCancelTrade={() => { setCancelTradeOpen(false); setCancelReason(''); setCancelError(null); }}
            onSubmitCancelTrade={() => { void cancelAcceptedTrade(); }}
            onOpenTradeDetail={() => {
              setDetailsOpen(false);
              if (!proposal.trade?.id) return;
              navigation.navigate('TradeDetail', { tradeId: proposal.trade.id, title: proposal.trade.title, description: proposal.trade.description, amountCents: proposal.trade.amountCents ?? 0, currency: proposal.trade.currency ?? 'eur', creditAmount: proposal.trade.creditAmount, status: proposal.trade.status, expiresAt: proposal.trade.expiresAt ?? null });
            }}
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

function HeaderDetailsButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.headerDetailsButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
      <AppText style={styles.headerDetailsText}>{label}</AppText>
    </Pressable>
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
      {sides.length > 0 ? <View style={styles.summarySides}>{sides.map(({ kind, item }) => <CompactSidePill key={`${kind}-${item.id}`} kind={kind} item={item} t={t} />)}</View> : <AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.noAttachedItem')}</AppText>}
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

function ProposalNoteChatBubble({ proposal, mine, canEdit, editing, draft, error, onOptions, onChangeDraft, onSave, onCancel, actionLoading, language, t }: { proposal: TradeProposalItem; mine: boolean; canEdit: boolean; editing: boolean; draft: string; error: string | null; onOptions: () => void; onChangeDraft: (text: string) => void; onSave: () => void; onCancel: () => void; actionLoading: ActionLoading; language: SupportedLanguage; t: TFunction }) {
  const theme = useThemeTokens();
  if (!proposal.message && !proposal.messageDeletedAt && !editing) return null;
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <Pressable disabled={!canEdit} onLongPress={onOptions} style={[styles.chatBubble, { backgroundColor: mine ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: mine ? theme.semantic.proposal.border : theme.color.border }, mine && styles.chatBubbleMine]}>
        <View style={styles.bubbleHeader}>
          <UserIdentityPressable user={proposal.applicant} userId={proposal.applicantId} displayName={mine ? t('trade.labels.you') : undefined} variant="compact" avatarSize="xs" showHandle={false} />
          {canEdit && !editing ? <Pressable accessibilityRole="button" onPress={onOptions} hitSlop={10} style={styles.moreButton}><MobileIcon name="more" size={20} color={theme.color.muted} /></Pressable> : null}
        </View>
        {editing ? <View style={styles.noteEditBox}><TextInput value={draft} onChangeText={onChangeDraft} multiline autoFocus placeholder={t('trade.proposals.proposalNote')} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />{error ? <AppText style={styles.errorText}>{error}</AppText> : null}<View style={styles.inlineActions}><SmallActionButton label={actionLoading === 'proposal-note' ? t('common.states.saving') : t('trade.proposals.saveProposal')} onPress={onSave} disabled={Boolean(actionLoading)} /><SmallActionButton label={t('common.actions.cancel')} onPress={onCancel} disabled={Boolean(actionLoading)} muted /></View></View> : proposal.messageDeletedAt ? <><AppText style={styles.messageDeleted}>{t('trade.proposals.messageDeleted')}</AppText><AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatDeletedTrace(proposal.messageDeletedAt, language, t)}</AppText></> : <><AppText style={styles.messageBody}>{proposal.message}</AppText>{proposal.messageEditedAt ? <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatEditTrace(proposal.messageEditCount, proposal.messageEditedAt, language, t)}</AppText> : null}</>}
      </Pressable>
    </View>
  );
}

function PrivateMessageBubble({ message, mine, canEdit, editing, draft, error, onOptions, onChangeDraft, onSaveEdit, onCancelEdit, actionLoading, language, t }: { message: ProposalMessageItem; mine: boolean; canEdit: boolean; editing: boolean; draft: string; error: string | null; onOptions: () => void; onChangeDraft: (text: string) => void; onSaveEdit: () => void; onCancelEdit: () => void; actionLoading: ActionLoading; language: SupportedLanguage; t: TFunction }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <Pressable disabled={!canEdit} onLongPress={onOptions} style={[styles.chatBubble, { backgroundColor: mine ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: mine ? theme.semantic.proposal.border : theme.color.border }, mine && styles.chatBubbleMine]}>
        <View style={styles.bubbleHeader}>
          <UserIdentityPressable user={message.sender} userId={message.senderId} displayName={mine ? t('trade.labels.you') : undefined} variant="compact" avatarSize="xs" showHandle={false} />
          {canEdit && !editing ? <Pressable accessibilityRole="button" onPress={onOptions} hitSlop={10} style={styles.moreButton}><MobileIcon name="more" size={20} color={theme.color.muted} /></Pressable> : null}
        </View>
        {editing ? <View style={styles.noteEditBox}><TextInput value={draft} onChangeText={onChangeDraft} multiline autoFocus placeholder={t('trade.proposals.writeMessage')} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />{error ? <AppText style={styles.errorText}>{error}</AppText> : null}<View style={styles.inlineActions}><SmallActionButton label={actionLoading === 'message-edit' ? t('common.states.saving') : t('trade.proposals.saveMessage')} onPress={onSaveEdit} disabled={Boolean(actionLoading)} /><SmallActionButton label={t('common.actions.cancel')} onPress={onCancelEdit} disabled={Boolean(actionLoading)} muted /></View></View> : message.deletedAt ? <><AppText style={styles.messageDeleted}>{t('trade.proposals.messageDeleted')}</AppText><AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatDeletedTrace(message.deletedAt, language, t)}</AppText></> : <><AppText style={styles.messageBody}>{message.body}</AppText>{message.editedAt ? <AppText style={[styles.messageMeta, { color: theme.color.muted }]}>{formatEditTrace(message.editCount, message.editedAt, language, t)}</AppText> : null}</>}
      </Pressable>
    </View>
  );
}

function ProposalDetailsSheet({ visible, proposal, requiredPackageSide, selectedPackageNeed, selectedPackageOffer, packageLoading, packageError, packageChanged, canEditProposalContent, canCancelAcceptedTrade, isOwner, isApplicant, isProvider, editingProposalNote, proposalNoteDraft, proposalNoteError, cancelTradeOpen, cancelReason, cancelError, actionLoading, language, onClose, onChooseNeed, onChooseOffer, onClearNeed, onClearOffer, onSavePackage, onStartProposalNoteEdit, onChangeProposalNote, onSaveProposalNote, onCancelProposalNoteEdit, onDeleteProposalNote, onAccept, onDecline, onWithdraw, onOpenCancelTrade, onChangeCancelReason, onCancelCancelTrade, onSubmitCancelTrade, onOpenTradeDetail, t }: { visible: boolean; proposal: TradeProposalItem; requiredPackageSide: RequiredProposalSide; selectedPackageNeed: NeedItem | null; selectedPackageOffer: OfferItem | null; packageLoading: boolean; packageError: string | null; packageChanged: boolean; canEditProposalContent: boolean; canCancelAcceptedTrade: boolean; isOwner: boolean; isApplicant: boolean; isProvider: boolean; editingProposalNote: boolean; proposalNoteDraft: string; proposalNoteError: string | null; cancelTradeOpen: boolean; cancelReason: string; cancelError: string | null; actionLoading: ActionLoading; language: SupportedLanguage; onClose: () => void; onChooseNeed: () => void; onChooseOffer: () => void; onClearNeed: () => void; onClearOffer: () => void; onSavePackage: () => void; onStartProposalNoteEdit: () => void; onChangeProposalNote: (text: string) => void; onSaveProposalNote: () => void; onCancelProposalNoteEdit: () => void; onDeleteProposalNote: () => void; onAccept: () => void; onDecline: () => void; onWithdraw: () => void; onOpenCancelTrade: () => void; onChangeCancelReason: (text: string) => void; onCancelCancelTrade: () => void; onSubmitCancelTrade: () => void; onOpenTradeDetail: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  const sideItems = proposalSideItems(proposal);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.color.background, borderColor: theme.color.border }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <AppText style={styles.sheetTitle}>{t('trade.proposals.showProposalItemDetails')}</AppText>
              <AppText style={[styles.sheetSubtitle, { color: theme.color.muted }]}>{proposalPackageTitle(proposal, t)} · {formatStatus(proposal.status, t)}</AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.closeButtonText}>×</AppText></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.sheetSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
              <View style={styles.statusLine}><StatusBadge status={proposal.status} label={formatStatus(proposal.status, t)} />{proposal.trade ? <SemanticBadge label={formatStatus(proposal.trade.status, t)} tone="proposal" size="sm" /> : null}</View>
              <AppText style={styles.sheetTradeTitle}>{proposal.trade?.title ?? t('trade.proposals.tradeProposal')}</AppText>
              <View style={styles.peopleRow}><MiniPerson label={t('trade.labels.owner')} user={proposal.trade?.owner} userId={proposal.trade?.ownerId} tone="need" /><MiniPerson label={t('trade.labels.applicant')} user={proposal.applicant} userId={proposal.applicantId} displayName={isApplicant ? t('trade.labels.you') : undefined} tone="offer" /></View>
              {proposal.trade?.cancelledAt ? <InfoNotice tone="warning" title={t('trade.proposals.tradeCancelled')} body={t('trade.proposals.tradeCancelledWithReason', { date: formatTraceDate(proposal.trade.cancelledAt, language), reason: proposal.trade.cancelReason || t('trade.proposals.noCancelReason') })} /> : null}
            </View>

            {sideItems.length === 0 ? <InfoNotice tone="info" title={t('trade.proposals.changeProposalItem')} body={t('trade.proposals.noAttachedItem')} /> : sideItems.map(({ kind, item }) => <ProposalSideDetailCard key={`${kind}-${item.id}`} kind={kind} item={item} t={t} />)}

            {canEditProposalContent ? <ProposalPackageEditor requiredSide={requiredPackageSide} need={selectedPackageNeed} offer={selectedPackageOffer} loading={packageLoading} error={packageError} changed={packageChanged} saving={actionLoading === 'proposal-package'} onChooseNeed={onChooseNeed} onChooseOffer={onChooseOffer} onClearNeed={onClearNeed} onClearOffer={onClearOffer} onSave={onSavePackage} t={t} /> : null}

            {canEditProposalContent ? (
              <View style={[styles.sheetSection, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
                <SemanticBadge label={t('trade.proposals.proposalNote')} tone="proposal" size="sm" />
                {editingProposalNote ? <View style={styles.noteEditBox}><TextInput value={proposalNoteDraft} onChangeText={onChangeProposalNote} multiline autoFocus placeholder={t('trade.proposals.proposalNote')} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />{proposalNoteError ? <AppText style={styles.errorText}>{proposalNoteError}</AppText> : null}<View style={styles.inlineActions}><SmallActionButton label={actionLoading === 'proposal-note' ? t('common.states.saving') : t('trade.proposals.saveProposal')} onPress={onSaveProposalNote} disabled={Boolean(actionLoading)} /><SmallActionButton label={t('common.actions.cancel')} onPress={onCancelProposalNoteEdit} disabled={Boolean(actionLoading)} muted /></View></View> : <View style={styles.inlineActions}><SmallActionButton label={proposal.messageDeletedAt ? t('trade.proposals.addProposalNote') : t('trade.proposals.editProposal')} onPress={onStartProposalNoteEdit} disabled={Boolean(actionLoading)} />{!proposal.messageDeletedAt ? <SmallActionButton label={t('trade.proposals.deleteProposalNote')} onPress={onDeleteProposalNote} disabled={Boolean(actionLoading)} danger /> : null}</View>}
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
      </View>
    </Modal>
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

function CancelTradeForm({ reason, error, loading, onChangeReason, onCancel, onSubmit, t }: { reason: string; error: string | null; loading: boolean; onChangeReason: (text: string) => void; onCancel: () => void; onSubmit: () => void; t: TFunction }) {
  const theme = useThemeTokens();
  return <View style={[styles.cancelBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={styles.cancelTitle}>{t('trade.proposals.cancelAcceptedTradeTitle')}</AppText><AppText style={[styles.muted, { color: theme.color.muted }]}>{t('trade.proposals.cancelAcceptedTradeBody')}</AppText><TextInput value={reason} onChangeText={onChangeReason} multiline placeholder={t('trade.proposals.cancelReasonPlaceholder')} placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} />{error ? <AppText style={styles.errorText}>{error}</AppText> : null}<View style={styles.inlineActions}><SmallActionButton label={loading ? t('trade.proposals.cancellingTrade') : t('trade.proposals.cancelAcceptedTradeAction')} onPress={onSubmit} disabled={loading} danger /><SmallActionButton label={t('trade.proposals.keepAcceptedTrade')} onPress={onCancel} disabled={loading} muted /></View></View>;
}

function SmallActionButton({ label, onPress, disabled, danger, muted }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; muted?: boolean }) {
  const theme = useThemeTokens();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallButton, { backgroundColor: danger ? '#FEE2E2' : muted ? theme.color.surface : theme.color.text, borderColor: danger ? '#FCA5A5' : theme.color.border }, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><AppText style={[styles.smallButtonText, { color: danger ? '#991B1B' : muted ? theme.color.text : theme.color.background }]}>{label}</AppText></Pressable>;
}

function ProposalActionButton({ label, variant, disabled, onPress }: { label: string; variant: 'primary' | 'danger'; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, variant === 'primary' ? styles.primaryButton : styles.dangerButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionText, variant === 'primary' ? styles.primaryText : styles.dangerText]}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  chatRoot: { flex: 1, minHeight: 0 },
  chatScroll: { flex: 1 },
  chatContent: { paddingTop: 14, paddingBottom: 20, gap: 12 },
  loadingContent: { paddingTop: 18, paddingBottom: 28 },
  loadingCard: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 12 },
  headerDetailsButton: { minHeight: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  headerDetailsText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
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
  systemLine: { flex: 1, height: StyleSheet.hairlineWidth },
  systemText: { maxWidth: '74%', textAlign: 'center', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  emptyChat: { alignSelf: 'center', paddingVertical: 18, fontWeight: '800' },
  messageRow: { alignItems: 'flex-start' },
  messageRowMine: { alignItems: 'flex-end' },
  chatBubble: { maxWidth: '88%', borderRadius: 22, borderWidth: 1, padding: 12, gap: 8 },
  chatBubbleMine: { borderBottomRightRadius: 7 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  moreButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  messageBody: { lineHeight: 21, fontWeight: '600' },
  messageMeta: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  messageDeleted: { fontStyle: 'italic', lineHeight: 20, fontWeight: '800', opacity: 0.74 },
  composerBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
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
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
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
  cancelBox: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  cancelTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  muted: { lineHeight: 20, fontWeight: '700' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
