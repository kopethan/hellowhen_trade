import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MediaAssetDto, ProposalActionStatus, TradeActionStatus, TradeStatus } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { resolveMediaUrl } from './mediaUrls';
import type { NeedItem, OfferItem, ProposalMessageItem, TradeDeckItem, TradeProposalItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'TradeDetail'>;
type TradeResponse = { trade: TradeDeckItem };
type ProposalsResponse = { proposals: TradeProposalItem[] };
type ProposalResponse = { proposal: TradeProposalItem; trade?: TradeDeckItem };
type ProposalMessageResponse = { message?: ProposalMessageItem; proposal?: TradeProposalItem };
type DetailRole = 'owner' | 'provider' | 'applicant' | 'viewer';

const tradeStatuses: TradeStatus[] = ['draft', 'active', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'expired', 'closed', 'cancelled'];

function normalizeStatus(status?: string): TradeStatus {
  return tradeStatuses.includes(status as TradeStatus) ? status as TradeStatus : 'active';
}

function fallback(params: RootStackParamList['TradeDetail']): TradeDeckItem {
  return { id: params.tradeId, ownerId: 'unknown', providerId: null, title: params.title ?? 'Trade detail', description: params.description ?? '', creditAmount: params.creditAmount ?? 0, amountCents: params.amountCents ?? 0, currency: params.currency ?? 'eur', status: normalizeStatus(params.status), isPublic: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), expiresAt: params.expiresAt ?? null, closedAt: null };
}

function personLabel(person?: { profile?: { displayName?: string | null; handle?: string | null } | null } | null) {
  return person?.profile?.displayName || person?.profile?.handle || 'Hellowhen member';
}

function modeLabel(mode?: string | null) {
  if (mode === 'remote') return 'Remote';
  if (mode === 'local') return 'Local';
  if (mode === 'hybrid') return 'Hybrid';
  return null;
}

function compactList(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(' · ');
}

function moneySide(trade: TradeDeckItem) { const amountCents = trade.amountCents ?? 0; if (amountCents <= 0) return null; if (!trade.need && trade.offer) return 'need' as const; if (trade.need && !trade.offer) return 'offer' as const; return null; }
function moneyLabel(trade: TradeDeckItem) { return formatMoney(trade.amountCents ?? 0, trade.currency ?? 'eur'); }
function needTitle(trade: TradeDeckItem) { return moneySide(trade) === 'need' ? 'Wallet money' : trade.need?.title || trade.title || 'Open request'; }
function offerTitle(trade: TradeDeckItem) { return moneySide(trade) === 'offer' ? 'Wallet money' : trade.offer?.title || 'Open offer'; }
function needDescription(trade: TradeDeckItem) { return moneySide(trade) === 'need' ? `Requested wallet money: ${moneyLabel(trade)}` : trade.need?.description ?? trade.description; }
function offerDescription(trade: TradeDeckItem) { return moneySide(trade) === 'offer' ? `Offered wallet money: ${moneyLabel(trade)}` : trade.offer?.description ?? ''; }
function needMeta(need?: NeedItem | null, trade?: TradeDeckItem) { if (trade && moneySide(trade) === 'need') return 'Money request'; return compactList([need?.category, need?.timing, modeLabel(need?.mode), need?.locationLabel]) || 'Need details not set yet'; }
function offerMeta(offer?: OfferItem | null, trade?: TradeDeckItem) { if (trade && moneySide(trade) === 'offer') return 'Wallet money offer'; return compactList([offer?.includes?.[0], offer?.availability, modeLabel(offer?.mode), offer?.locationLabel]) || 'Offer details not set yet'; }
function exchangeLabel(trade: TradeDeckItem) { const side = moneySide(trade); if (side === 'need') return `Money requested · ${moneyLabel(trade)}`; if (side === 'offer') return `Money offered · ${moneyLabel(trade)}`; return (trade.amountCents ?? 0) > 0 ? `Wallet amount · ${moneyLabel(trade)}` : 'Service-for-service'; }

function expiryLabel(expiresAt?: string | null) {
  if (!expiresAt) return 'No expiry set';
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return 'No expiry set';
  const diff = ms - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.ceil(diff / 1000 / 60 / 60);
  return hours < 24 ? `${hours}h left` : `${Math.ceil(hours / 24)}d left`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatStatus(status: string) { return status.replace(/_/g, ' '); }

function statusHint(trade: TradeDeckItem, role: DetailRole) {
  if (trade.status === 'active') return role === 'owner' ? 'Open for proposals. Review each private proposal thread before accepting someone.' : 'Send a private proposal to ask for this trade.';
  if (trade.status === 'in_progress') return 'In progress. The provider should mark delivered first. The payer confirms before wallet money is released.';
  if (trade.status === 'submitted') return 'Delivery was marked. The other party should confirm only if everything is okay.';
  if (trade.status === 'disputed') return 'Reported. Money movement is frozen while admin reviews this trade.';
  if (trade.status === 'completed') return 'Completed. Wallet money is pending payout when this trade included an amount.';
  if (trade.status === 'cancelled') return 'Cancelled. Held wallet money was refunded when applicable.';
  return 'Review the current trade status before taking action.';
}

function canMessageProposal(proposal: TradeProposalItem) { return !['declined', 'withdrawn'].includes(proposal.status); }
function canShowConversation(proposal: TradeProposalItem, role: DetailRole, userId?: string) { return role === 'owner' ? proposal.status === 'accepted' : proposal.applicantId === userId; }
function hasPrivateMedia(media?: MediaAssetDto[]) { return Boolean(media?.some((item) => item.status !== 'active')); }
function isOpeningProposalMessage(proposal: TradeProposalItem, message: ProposalMessageItem) { return message.senderId === proposal.applicantId && message.body.trim() === proposal.message.trim(); }
function visibleConversationMessages(proposal: TradeProposalItem) {
  const messages = proposal.messages ?? [];
  const openingIndex = messages.findIndex((message) => isOpeningProposalMessage(proposal, message));
  return openingIndex >= 0 ? messages.filter((_, index) => index !== openingIndex) : messages;
}
function upsertProposal(proposals: TradeProposalItem[], next: TradeProposalItem) { return proposals.some((proposal) => proposal.id === next.id) ? proposals.map((proposal) => proposal.id === next.id ? { ...proposal, ...next } : proposal) : [next, ...proposals]; }

export function TradeDetailScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const params = route.params;
  const [trade, setTrade] = useState<TradeDeckItem>(() => fallback(params));
  const [proposals, setProposals] = useState<TradeProposalItem[]>([]);
  const [proposalDraft, setProposalDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
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
  const title = compactList([needTitle(trade), offerTitle(trade)]).replace(' · ', ' ↔ ');
  const paymentLabel = exchangeLabel(trade);
  const createdLabel = formatDate(trade.createdAt);

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

  useEffect(() => { void loadTrade(); }, [loadTrade]);

  const actions = useMemo(() => {
    const payment = trade.payment;
    const userId = auth.user?.id;
    const canSubmit = trade.status === 'in_progress' && (payment?.amountCents ? payment.sellerId === userId : ['owner', 'provider'].includes(role));
    const canConfirm = trade.status === 'submitted' && (payment?.amountCents ? payment.buyerId === userId : ['owner', 'provider'].includes(role)) && trade.deliverySubmittedById !== userId;
    const list: Array<{ status: TradeActionStatus; label: string; variant?: 'primary' | 'danger' | 'ghost' }> = [];
    if (canSubmit) list.push({ status: 'submitted', label: 'Mark delivered', variant: 'primary' });
    if (canConfirm) list.push({ status: 'completed', label: payment?.amountCents ? 'Confirm and release money' : 'Confirm completed', variant: 'primary' });
    if (role === 'owner' && trade.status === 'active') list.push({ status: 'cancelled', label: 'Cancel trade', variant: 'danger' });
    if (role === 'provider' && ['in_progress', 'submitted'].includes(trade.status)) list.push({ status: 'cancelled', label: 'Cancel trade', variant: 'danger' });
    if (['active', 'in_progress', 'submitted', 'completed'].includes(trade.status) && auth.user) list.push({ status: 'disputed', label: 'Report problem', variant: 'danger' });
    return list;
  }, [auth.user, role, trade.deliverySubmittedById, trade.payment, trade.status]);

  const updateStatus = useCallback(async (status: TradeActionStatus) => {
    const runStatusUpdate = async (nextStatus: TradeActionStatus) => {
      setActionLoading(nextStatus); setError(null); setMessage(null);
      try {
        const result = await api.trades.updateStatus(trade.id, { status: nextStatus }) as TradeResponse;
        setTrade(result.trade);
        setMessage(nextStatus === 'submitted' ? 'Delivery marked. The other party can now confirm completion.' : nextStatus === 'completed' ? 'Trade confirmed. Held wallet money moved into pending payout when applicable.' : nextStatus === 'cancelled' ? 'Trade cancelled. Held wallet money was refunded when applicable.' : 'Trade updated.');
        await loadTrade();
      } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not update this trade. Please try again.')); }
      finally { setActionLoading(null); }
    };
    if (status === 'completed' && (trade.payment?.amountCents ?? 0) > 0) {
      return Alert.alert('Confirm and release wallet money?', 'Only confirm if the delivery is okay. This releases held wallet money to the other member’s pending payout balance. Report a problem instead if anything is wrong.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release money', style: 'destructive', onPress: () => { void runStatusUpdate('completed'); } },
      ]);
    }
    if (status === 'disputed') {
      setActionLoading('report'); setError(null); setMessage(null);
      try {
        await api.support.createTicket({ category: 'trade_issue', priority: (trade.amountCents ?? 0) > 0 ? 'high' : 'normal', subject: `Problem with trade: ${trade.title}`.slice(0, 140), message: 'I need admin help with this trade. Please freeze or review the money flow before anything is released.', relatedTradeId: trade.id });
        setMessage('Report sent. Admin can review this trade and money movement is frozen when applicable.');
        await loadTrade();
      } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not report this trade. Try again from Account > Support.')); }
      finally { setActionLoading(null); }
      return;
    }
    await runStatusUpdate(status);
  }, [loadTrade, trade.amountCents, trade.id, trade.payment?.amountCents, trade.title]);

  const createProposal = useCallback(async () => {
    const trimmed = proposalDraft.trim();
    if (trimmed.length < 3) return;
    setCreatingProposal(true); setError(null); setMessage(null);
    try {
      const result = await api.trades.createProposal(trade.id, { message: trimmed }) as ProposalResponse;
      setProposals((current) => upsertProposal(current, result.proposal));
      setProposalDraft('');
      setMessage('Proposal sent. This conversation is private to you and the trade owner.');
      await loadTrade();
    } catch (caughtError) {
      const body = caughtError && typeof caughtError === 'object' && 'body' in caughtError ? (caughtError as { body?: { proposal?: TradeProposalItem } }).body : undefined;
      if (body?.proposal) setProposals((current) => upsertProposal(current, body.proposal!));
      setError(getFriendlyApiErrorMessage(caughtError, 'Could not send this proposal.'));
    } finally { setCreatingProposal(false); }
  }, [loadTrade, proposalDraft, trade.id]);

  const updateProposalStatus = useCallback(async (proposalId: string, status: ProposalActionStatus) => {
    setProposalActionLoading({ proposalId, status }); setError(null); setMessage(null);
    try {
      const result = await api.proposals.updateStatus(proposalId, { status }) as ProposalResponse;
      setProposals((current) => upsertProposal(current, result.proposal));
      if (result.trade) setTrade(result.trade);
      setMessage(status === 'accepted' ? 'Proposal accepted. The trade moved in progress and the accepted conversation is now below.' : status === 'declined' ? 'Proposal declined.' : 'Proposal withdrawn.');
      await loadTrade();
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not update this proposal.')); }
    finally { setProposalActionLoading(null); }
  }, [loadTrade]);

  const sendProposalMessage = useCallback(async (proposalId: string) => {
    const trimmed = (replyDrafts[proposalId] ?? '').trim();
    if (!trimmed) return;
    setReplyingProposalId(proposalId); setError(null); setMessage(null);
    try {
      const result = await api.proposals.sendMessage(proposalId, { body: trimmed }) as ProposalMessageResponse;
      setReplyDrafts((current) => ({ ...current, [proposalId]: '' }));
      if (result.proposal) setProposals((current) => upsertProposal(current, result.proposal!));
      else if (result.message) setProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, messages: [...(proposal.messages ?? []), result.message!] } : proposal));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not send this message.')); }
    finally { setReplyingProposalId(null); }
  }, [replyDrafts]);

  return <AppFixedHeaderScreen header={<AppHeader title="Trade" onBack={() => navigation.goBack()} />}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadTrade(); }} />}>
    <View style={styles.hero}><View style={styles.headerRow}><StatusBadge status={trade.status} /><SemanticBadge label={(trade.amountCents ?? 0) > 0 ? (moneySide(trade) === 'need' ? 'Money needed' : 'Money offered') : 'Service trade'} tone={(trade.amountCents ?? 0) > 0 ? 'credits' : 'trade'} size="sm" /></View><AppText style={styles.title}>{title}</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>Posted by {personLabel(trade.owner)}{trade.expiresAt ? ` · ${expiryLabel(trade.expiresAt)}` : ''}</AppText>{(trade.amountCents ?? 0) > 0 ? <MoneyPill amountCents={trade.amountCents ?? 0} currency={trade.currency ?? 'eur'} label={moneySide(trade) === 'need' ? 'needed' : 'offered'} /> : <AppText style={[styles.paymentLine, { color: theme.color.muted }]}>{paymentLabel}</AppText>}</View>

    <Separator theme={theme} />
    <InventorySection eyebrow="I need" title={needTitle(trade)} description={needDescription(trade)} meta={needMeta(trade.need, trade)} images={trade.need?.media ?? []} emptyImageLabel="No need reference images yet." reviewPending={role === 'owner' && hasPrivateMedia(trade.need?.media)} theme={theme} />
    <Separator theme={theme} />
    <InventorySection eyebrow="I offer" title={offerTitle(trade)} description={offerDescription(trade)} meta={offerMeta(trade.offer, trade)} images={trade.offer?.media ?? []} emptyImageLabel="No offer sample images yet." reviewPending={role === 'owner' && hasPrivateMedia(trade.offer?.media)} theme={theme} />

    <Separator theme={theme} />
    <View style={styles.section}><AppText style={styles.sectionEyebrow}>Trade details</AppText><View style={styles.detailRows}><DetailRow label="Status" value={formatStatus(trade.status)} theme={theme} /><DetailRow label="Expiry" value={expiryLabel(trade.expiresAt)} theme={theme} /><DetailRow label="Exchange" value={paymentLabel} theme={theme} />{(trade.amountCents ?? 0) > 0 ? <DetailRow label="Payment" value={trade.payment?.status ? formatStatus(trade.payment.status) : 'Not held yet'} theme={theme} /> : null}{(trade.amountCents ?? 0) > 0 && trade.escrow ? <DetailRow label="Escrow" value={formatMoney(trade.escrow.heldAmountCents ?? 0, trade.escrow.currency ?? trade.currency ?? 'eur')} theme={theme} /> : null}{createdLabel ? <DetailRow label="Created" value={createdLabel} theme={theme} /> : null}<DetailRow label="Owner" value={personLabel(trade.owner)} theme={theme} />{trade.provider ? <DetailRow label="Provider" value={personLabel(trade.provider)} theme={theme} /> : null}</View><InfoNotice tone="info" title="Next step" body={statusHint(trade, role)} />{actions.length > 0 ? <View style={styles.actionStack}>{actions.map((action) => <ActionButton key={action.status} label={actionLoading === action.status || (action.status === 'disputed' && actionLoading === 'report') ? 'Updating...' : action.label} variant={action.variant ?? (action.status === 'cancelled' ? 'danger' : 'primary')} disabled={Boolean(actionLoading)} onPress={() => { void updateStatus(action.status); }} theme={theme} />)}</View> : null}</View>

    <Separator theme={theme} />
    <View style={styles.section}><AppText style={styles.sectionEyebrow}>{role === 'owner' ? 'Proposals' : myProposal ? 'Your proposal' : 'Ask to trade'}</AppText>{error ? <InfoNotice tone="danger" title="Trade error" body={error} /> : null}{message ? <InfoNotice tone="success" title="Updated" body={message} /> : null}{loading ? <AppText style={[styles.muted, { color: theme.color.muted }]}>Refreshing trade detail...</AppText> : null}{role !== 'owner' && !myProposal && trade.status === 'active' ? <ProposalComposer value={proposalDraft} onChange={setProposalDraft} onSubmit={() => { void createProposal(); }} loading={creatingProposal} theme={theme} /> : null}{role !== 'owner' && !myProposal && trade.status !== 'active' ? <AppText style={[styles.muted, { color: theme.color.muted }]}>This trade is not accepting new proposals.</AppText> : null}{role === 'owner' && proposals.length === 0 ? <AppText style={[styles.muted, { color: theme.color.muted }]}>No proposals yet. New private proposals will appear here.</AppText> : null}{role === 'owner' && acceptedProposal ? <InfoNotice tone="success" title="Accepted conversation" body="Only you and the accepted applicant can see this thread." /> : null}<View style={styles.proposalStack}>{proposals.map((proposal) => <ProposalBlock key={proposal.id} proposal={proposal} role={role} currentUserId={auth.user?.id} replyDraft={replyDrafts[proposal.id] ?? ''} onReplyDraftChange={(value) => setReplyDrafts((current) => ({ ...current, [proposal.id]: value }))} onSendMessage={() => { void sendProposalMessage(proposal.id); }} replying={replyingProposalId === proposal.id} proposalActionLoading={proposalActionLoading} onUpdateStatus={updateProposalStatus} onOpenThread={() => navigation.navigate('ProposalDetail', { proposalId: proposal.id })} theme={theme} />)}</View></View>
  </ScrollView></AppFixedHeaderScreen>;
}

function Separator({ theme }: { theme: ThemeTokens }) { return <View style={[styles.separator, { backgroundColor: theme.color.border }]} />; }
function InventorySection({ eyebrow, title, description, meta, images, emptyImageLabel, reviewPending, theme }: { eyebrow: string; title: string; description: string; meta: string; images: MediaAssetDto[]; emptyImageLabel: string; reviewPending?: boolean; theme: ThemeTokens }) { return <View style={styles.section}><AppText style={styles.sectionEyebrow}>{eyebrow}</AppText><AppText style={styles.sectionTitle}>{title}</AppText>{description ? <AppText style={[styles.bodyCopy, { color: theme.color.muted }]}>{description}</AppText> : null}<AppText style={[styles.metaLine, { color: theme.color.muted }]}>{meta}</AppText><TradeDetailImageGrid media={images} emptyLabel={emptyImageLabel} theme={theme} />{reviewPending ? <AppText style={[styles.reviewNote, { color: theme.color.muted }]}>Images appear in the public feed after review.</AppText> : null}</View>; }
function TradeDetailImageGrid({ media, emptyLabel, theme }: { media: MediaAssetDto[]; emptyLabel: string; theme: ThemeTokens }) { const visible = media.slice(0, 4); if (visible.length === 0) return <AppText style={[styles.emptyImages, { color: theme.color.muted, borderColor: theme.color.border, backgroundColor: theme.color.subtleSurface }]}>{emptyLabel}</AppText>; const first = visible[0]; if (visible.length === 1 && first) return <Image source={{ uri: resolveMediaUrl(first.url) }} style={styles.singleImage} resizeMode="cover" />; return <View style={styles.imageGrid}>{visible.map((item, index) => { const isLargeFirst = visible.length === 3 && index === 0; return <View key={item.id} style={[styles.gridImageWrap, isLargeFirst && styles.gridImageLargeFirst]}><Image source={{ uri: resolveMediaUrl(item.url) }} style={styles.gridImage} resizeMode="cover" />{index === 3 && media.length > 4 ? <View style={styles.moreOverlay}><AppText style={styles.moreOverlayText}>+{media.length - 4}</AppText></View> : null}</View>; })}</View>; }
function DetailRow({ label, value, theme }: { label: string; value: string; theme: ThemeTokens }) { return <View style={[styles.detailRow, { borderColor: theme.color.border }]}><AppText style={[styles.detailLabel, { color: theme.color.muted }]}>{label}</AppText><AppText style={styles.detailValue}>{value}</AppText></View>; }
function ProposalComposer({ value, onChange, onSubmit, loading, theme }: { value: string; onChange: (value: string) => void; onSubmit: () => void; loading: boolean; theme: ThemeTokens }) { return <View style={styles.composerBox}><AppText style={[styles.bodyCopy, { color: theme.color.muted }]}>Write a short private proposal. The owner can accept, decline, or continue the conversation here.</AppText><TextInput value={value} onChangeText={onChange} multiline textAlignVertical="top" placeholder="I can help with this. My timing is..." placeholderTextColor={theme.color.muted} style={[styles.textArea, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} /><ActionButton label={loading ? 'Sending...' : 'Send proposal'} variant="primary" disabled={loading || value.trim().length < 3} onPress={onSubmit} theme={theme} /></View>; }

function ProposalBlock({ proposal, role, currentUserId, replyDraft, onReplyDraftChange, onSendMessage, replying, proposalActionLoading, onUpdateStatus, onOpenThread, theme }: { proposal: TradeProposalItem; role: DetailRole; currentUserId?: string; replyDraft: string; onReplyDraftChange: (value: string) => void; onSendMessage: () => void; replying: boolean; proposalActionLoading: { proposalId: string; status: ProposalActionStatus } | null; onUpdateStatus: (proposalId: string, status: ProposalActionStatus) => void; onOpenThread: () => void; theme: ThemeTokens }) {
  const isOwner = role === 'owner'; const isApplicant = proposal.applicantId === currentUserId; const showConversation = canShowConversation(proposal, role, currentUserId); const canMessage = canMessageProposal(proposal); const messages = visibleConversationMessages(proposal);
  return <View style={[styles.proposalBlock, { borderColor: theme.color.border }]}><View style={styles.proposalHeader}><View style={styles.proposalIdentity}><View style={[styles.avatar, { backgroundColor: theme.semantic.proposal.softBg, borderColor: theme.semantic.proposal.border }]} /><View style={styles.proposalCopy}><AppText style={styles.proposalTitle}>{isApplicant ? 'You' : personLabel(proposal.applicant)}</AppText><AppText style={[styles.proposalMessage, { color: theme.color.muted }]}>{proposal.message}</AppText></View></View><StatusBadge status={proposal.status} size="sm" /></View>{isOwner && proposal.status === 'pending' ? <View style={styles.actionRow}><ActionButton label={proposalActionLoading?.proposalId === proposal.id && proposalActionLoading.status === 'accepted' ? 'Accepting...' : 'Accept'} variant="primary" disabled={Boolean(proposalActionLoading)} onPress={() => onUpdateStatus(proposal.id, 'accepted')} theme={theme} /><ActionButton label={proposalActionLoading?.proposalId === proposal.id && proposalActionLoading.status === 'declined' ? 'Declining...' : 'Decline'} variant="danger" disabled={Boolean(proposalActionLoading)} onPress={() => onUpdateStatus(proposal.id, 'declined')} theme={theme} /></View> : null}{isApplicant && proposal.status === 'pending' ? <ActionButton label={proposalActionLoading?.proposalId === proposal.id && proposalActionLoading.status === 'withdrawn' ? 'Withdrawing...' : 'Withdraw proposal'} variant="danger" disabled={Boolean(proposalActionLoading)} onPress={() => onUpdateStatus(proposal.id, 'withdrawn')} theme={theme} /> : null}{showConversation ? <View style={styles.inlineThread}><AppText style={styles.threadLabel}>{proposal.status === 'accepted' ? 'Accepted conversation' : 'Private proposal conversation'}</AppText>{messages.length === 0 ? <AppText style={[styles.muted, { color: theme.color.muted }]}>No messages yet.</AppText> : messages.map((item) => <MessageBubble key={item.id} message={item} mine={item.senderId === currentUserId} theme={theme} />)}{canMessage ? <View style={styles.replyBox}><TextInput value={replyDraft} onChangeText={onReplyDraftChange} multiline textAlignVertical="top" placeholder="Write a private reply..." placeholderTextColor={theme.color.muted} style={[styles.replyInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} /><ActionButton label={replying ? 'Sending...' : 'Send reply'} variant="ghost" disabled={replying || replyDraft.trim().length === 0} onPress={onSendMessage} theme={theme} /></View> : null}</View> : <Pressable accessibilityRole="button" onPress={onOpenThread} style={({ pressed }) => [styles.openThreadButton, { borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.openThreadText, { color: theme.color.muted }]}>Open private thread</AppText></Pressable>}</View>;
}

function MessageBubble({ message, mine, theme }: { message: ProposalMessageItem; mine: boolean; theme: ThemeTokens }) { return <View style={[styles.messageBubble, mine ? styles.myMessageBubble : styles.theirMessageBubble, { backgroundColor: mine ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: mine ? theme.semantic.proposal.border : theme.color.border }]}><AppText style={[styles.messageAuthor, { color: theme.color.muted }]}>{mine ? 'You' : personLabel(message.sender)}</AppText><AppText style={styles.messageBody}>{message.body}</AppText></View>; }
function ActionButton({ label, variant, disabled, onPress, theme }: { label: string; variant: 'primary' | 'danger' | 'ghost'; disabled?: boolean; onPress: () => void; theme: ThemeTokens }) { const buttonStyle = variant === 'primary' ? { backgroundColor: theme.semantic.proposal.bg, borderColor: theme.semantic.proposal.bg } : variant === 'danger' ? { backgroundColor: theme.semantic.danger.softBg, borderColor: theme.semantic.danger.border } : { backgroundColor: theme.color.surface, borderColor: theme.color.border }; const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? theme.semantic.danger.text : theme.color.text; return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, buttonStyle, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionButtonText, { color: textColor }]}>{label}</AppText></Pressable>; }

const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 20 }, hero: { gap: 10 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, title: { fontSize: 32, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { fontSize: 14, lineHeight: 20, fontWeight: '800' }, paymentLine: { fontSize: 15, lineHeight: 21, fontWeight: '900' }, separator: { height: 1, opacity: 0.72 }, section: { gap: 13 }, sectionEyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }, sectionTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.45 }, bodyCopy: { fontSize: 16, lineHeight: 23, fontWeight: '600' }, metaLine: { fontSize: 13, lineHeight: 18, fontWeight: '900' }, reviewNote: { fontSize: 12, lineHeight: 17, fontWeight: '800' }, emptyImages: { overflow: 'hidden', borderWidth: 1, borderRadius: 22, padding: 18, fontWeight: '800' }, singleImage: { width: '100%', height: 310, borderRadius: 24, backgroundColor: '#E2E8F0' }, imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, gridImageWrap: { width: '48.8%', height: 154, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E2E8F0' }, gridImageLargeFirst: { width: '100%', height: 214 }, gridImage: { width: '100%', height: '100%' }, moreOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)' }, moreOverlayText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' }, detailRows: { gap: 0 }, detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth }, detailLabel: { fontSize: 13, fontWeight: '800' }, detailValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '900', textTransform: 'capitalize' }, actionStack: { gap: 10 }, actionRow: { flexDirection: 'row', gap: 10 }, composerBox: { gap: 10 }, textArea: { minHeight: 126, borderRadius: 20, borderWidth: 1, padding: 14, fontSize: 16, lineHeight: 22, fontWeight: '600' }, proposalStack: { gap: 14 }, proposalBlock: { gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth }, proposalHeader: { gap: 10 }, proposalIdentity: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1 }, proposalCopy: { flex: 1, gap: 4 }, proposalTitle: { fontSize: 16, fontWeight: '900' }, proposalMessage: { fontSize: 14, lineHeight: 20, fontWeight: '700' }, inlineThread: { gap: 9 }, threadLabel: { fontSize: 13, fontWeight: '900' }, messageBubble: { maxWidth: '90%', borderRadius: 18, borderWidth: 1, padding: 12, gap: 4 }, myMessageBubble: { alignSelf: 'flex-end' }, theirMessageBubble: { alignSelf: 'flex-start' }, messageAuthor: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }, messageBody: { lineHeight: 20, fontWeight: '600' }, replyBox: { gap: 8 }, replyInput: { minHeight: 88, borderRadius: 18, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 21, fontWeight: '600' }, openThreadButton: { minHeight: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, openThreadText: { fontWeight: '900' }, muted: { lineHeight: 20, fontWeight: '700' }, actionButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 }, actionButtonText: { fontWeight: '900' }, disabledButton: { opacity: 0.52 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
