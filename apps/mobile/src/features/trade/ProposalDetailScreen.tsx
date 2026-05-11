import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProposalActionStatus } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { MoneyPill, InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import type { ProposalMessageItem, TradeProposalItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProposalDetail'>;
type ProposalResponse = { proposal: TradeProposalItem; trade?: unknown };
type MessagesResponse = { messages: ProposalMessageItem[] };
function personLabel(person?: { profile?: { displayName?: string | null; handle?: string | null } | null } | null) { return person?.profile?.displayName || person?.profile?.handle || 'Hellowhen member'; }
function modeLabel(mode?: string | null) { if (mode === 'remote') return 'Remote'; if (mode === 'local') return 'Local'; if (mode === 'hybrid') return 'Hybrid'; return null; }
function compactList(values: Array<string | null | undefined>) { return values.map((value) => value?.trim()).filter(Boolean).join(' · '); }
function proposalSideMeta(proposal: TradeProposalItem) {
  if (proposal.proposedNeed) return compactList([proposal.proposedNeed.category, proposal.proposedNeed.timing, modeLabel(proposal.proposedNeed.mode), proposal.proposedNeed.locationLabel]) || proposal.proposedNeed.itemType || 'Need details';
  if (proposal.proposedOffer) return compactList([proposal.proposedOffer.category, proposal.proposedOffer.availability, modeLabel(proposal.proposedOffer.mode), proposal.proposedOffer.locationLabel]) || proposal.proposedOffer.itemType || 'Offer details';
  return '';
}
function proposalSideDescription(proposal: TradeProposalItem) { return (proposal.proposedNeed?.description ?? proposal.proposedOffer?.description ?? '').trim() || 'No description added yet.'; }

export function ProposalDetailScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const theme = useThemeTokens();
  const [proposal, setProposal] = useState<TradeProposalItem | null>(null);
  const [messages, setMessages] = useState<ProposalMessageItem[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<ProposalActionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProposal = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.proposals.get(route.params.proposalId) as ProposalResponse;
      setProposal(result.proposal);
      setMessages(result.proposal.messages ?? []);
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not load this proposal.')); }
    finally { setLoading(false); }
  }, [route.params.proposalId]);
  useEffect(() => { void loadProposal(); }, [loadProposal]);

  const isOwner = proposal?.trade?.ownerId === auth.user?.id;
  const isApplicant = proposal?.applicantId === auth.user?.id;
  const isAcceptedProvider = proposal?.trade?.providerId === auth.user?.id;
  const canMessage = proposal ? !['declined', 'withdrawn'].includes(proposal.status) : false;
  const statusHint = useMemo(() => {
    if (!proposal) return '';
    if (proposal.status === 'pending') return isOwner ? 'Review the proposal, ask questions, then accept or decline.' : 'The owner can ask questions here before accepting.';
    if (proposal.status === 'accepted') return 'Accepted. The trade moved in progress and wallet money was held when applicable.';
    if (proposal.status === 'declined') return 'Declined. This proposal conversation is now closed.';
    return 'Withdrawn. This proposal conversation is now closed.';
  }, [proposal, isOwner]);

  async function sendMessage() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true); setError(null); setNotice(null);
    try {
      await api.proposals.sendMessage(route.params.proposalId, { body: trimmed });
      setBody('');
      const messageResult = await api.proposals.messages(route.params.proposalId) as MessagesResponse;
      setMessages(messageResult.messages ?? []);
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not send this message.')); }
    finally { setSubmitting(false); }
  }

  async function updateStatus(status: ProposalActionStatus) {
    setActionLoading(status); setError(null); setNotice(null);
    try {
      const result = await api.proposals.updateStatus(route.params.proposalId, { status }) as ProposalResponse;
      setProposal(result.proposal);
      setMessages(result.proposal.messages ?? messages);
      setNotice(status === 'accepted' ? 'Proposal accepted. Wallet money is now held when this trade includes an amount and the trade is in progress.' : status === 'declined' ? 'Proposal declined.' : 'Proposal withdrawn.');
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not update this proposal.')); }
    finally { setActionLoading(null); }
  }

  return <AppScreen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProposal(); }} />}>
    <AppHeader title="Proposal" onBack={() => navigation.goBack()} />
    {!proposal ? <AppCard><SemanticBadge label="Proposal" tone="proposal" /><AppText style={styles.title}>Proposal</AppText>{error ? <InfoNotice tone="danger" title="Proposal error" body={error} /> : <AppText style={[styles.muted, { color: theme.color.muted }]}>Loading proposal...</AppText>}</AppCard> : <AppCard>
      <View style={styles.headerRow}><StatusBadge status={proposal.status} /><SemanticBadge label="Proposal thread" tone="proposal" size="sm" /></View>
      <AppText style={styles.title}>{proposal.trade?.title ?? 'Proposal'}</AppText>
      {proposal.trade ? ((proposal.trade.amountCents ?? 0) > 0 ? <MoneyPill amountCents={proposal.trade.amountCents ?? 0} currency={proposal.trade.currency ?? 'eur'} label={`${proposal.trade.status.replace('_', ' ')} trade`} /> : <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Service-for-service trade</AppText>) : <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Private proposal conversation</AppText>}
      <View style={styles.peopleRow}><MiniPerson label="Owner" name={personLabel(proposal.trade?.owner)} tone="need" /><MiniPerson label="Applicant" name={personLabel(proposal.applicant)} tone="offer" /></View>
      <ProposalSideSummary proposal={proposal} />
      <InfoNotice tone="info" title="Next step" body={statusHint} />
      {error ? <InfoNotice tone="danger" title="Proposal error" body={error} /> : null}
      {notice ? <InfoNotice tone="success" title="Proposal updated" body={notice} /> : null}
      <View style={styles.messagesBox}>{messages.length === 0 ? <AppText style={[styles.muted, { color: theme.color.muted }]}>No messages yet.</AppText> : messages.map((message) => { const mine = message.senderId === auth.user?.id; return <View key={message.id} style={[styles.messageBubble, { backgroundColor: mine ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: mine ? theme.semantic.proposal.border : theme.color.border }, mine && styles.myMessageBubble]}><SemanticBadge label={mine ? 'You' : personLabel(message.sender)} tone={mine ? 'proposal' : 'info'} size="sm" /><AppText style={styles.messageBody}>{message.body}</AppText></View>; })}</View>
      {canMessage ? <View style={styles.composer}><TextInput value={body} onChangeText={setBody} multiline placeholder="Write a message..." placeholderTextColor={theme.color.muted} style={[styles.input, { backgroundColor: theme.color.surface, borderColor: theme.color.border, color: theme.color.text }]} /><Button title={submitting ? 'Sending...' : 'Send'} disabled={submitting || body.trim().length === 0} onPress={() => { void sendMessage(); }} /></View> : null}
      {isOwner && proposal.status === 'pending' ? <View style={styles.actionRow}><ProposalActionButton label={actionLoading === 'accepted' ? 'Accepting...' : 'Accept'} variant="primary" disabled={Boolean(actionLoading)} onPress={() => { void updateStatus('accepted'); }} /><ProposalActionButton label={actionLoading === 'declined' ? 'Declining...' : 'Decline'} variant="danger" disabled={Boolean(actionLoading)} onPress={() => { void updateStatus('declined'); }} /></View> : null}
      {isApplicant && proposal.status === 'pending' ? <ProposalActionButton label={actionLoading === 'withdrawn' ? 'Withdrawing...' : 'Withdraw proposal'} variant="danger" disabled={Boolean(actionLoading)} onPress={() => { void updateStatus('withdrawn'); }} /> : null}
      {proposal.trade?.id ? <Button title="Open trade detail" onPress={() => navigation.navigate('TradeDetail', { tradeId: proposal.trade!.id, title: proposal.trade!.title, description: proposal.trade!.description, amountCents: proposal.trade!.amountCents ?? 0, currency: proposal.trade!.currency ?? 'eur', creditAmount: proposal.trade!.creditAmount, status: proposal.trade!.status, expiresAt: proposal.trade!.expiresAt ?? null })} /> : null}
      {isAcceptedProvider ? <InfoNotice tone="success" title="Accepted provider" body="You are the accepted provider for this trade." /> : null}
    </AppCard>}
  </ScrollView></AppScreen>;
}
function MiniPerson({ label, name, tone }: { label: string; name: string; tone: 'need' | 'offer' }) { const theme = useThemeTokens(); return <View style={[styles.personBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.personName}>{name}</AppText></View>; }
function ProposalSideSummary({ proposal }: { proposal: TradeProposalItem }) {
  const theme = useThemeTokens();
  const need = proposal.proposedNeed;
  const offer = proposal.proposedOffer;
  if (!need && !offer) return null;
  const kind = need ? 'need' : 'offer';
  const item = need ?? offer!;
  return (
    <View style={[styles.proposedSideBox, { backgroundColor: theme.semantic[kind].softBg, borderColor: theme.semantic[kind].border }]}>
      <View style={styles.proposedSideHeader}>
        <SemanticBadge label={kind === 'need' ? 'Proposed Need' : 'Proposed Offer'} tone={kind} size="sm" />
        <AppText style={[styles.proposedSideKind, { color: theme.semantic[kind].text }]}>{kind === 'need' ? 'Need proposal' : 'Offer proposal'}</AppText>
      </View>
      <AppText style={styles.proposedSideTitle} numberOfLines={2}>{item.title}</AppText>
      <AppText style={[styles.proposedSideMeta, { color: theme.semantic[kind].text }]} numberOfLines={1}>{proposalSideMeta(proposal)}</AppText>
      <AppText style={[styles.proposedSideBody, { color: theme.semantic[kind].text }]} numberOfLines={3}>{proposalSideDescription(proposal)}</AppText>
    </View>
  );
}

function ProposalActionButton({ label, variant, disabled, onPress }: { label: string; variant: 'primary' | 'danger'; disabled?: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, variant === 'primary' ? styles.primaryButton : styles.dangerButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionText, variant === 'primary' ? styles.primaryText : styles.dangerText]}>{label}</AppText></Pressable>; }
const styles = StyleSheet.create({ content: { paddingBottom: 28, gap: 14 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, title: { fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { lineHeight: 20, fontWeight: '800' }, peopleRow: { flexDirection: 'row', gap: 10 }, proposedSideBox: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 7 }, proposedSideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, proposedSideKind: { fontSize: 11, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' }, proposedSideTitle: { fontWeight: '900', fontSize: 19, lineHeight: 24 }, proposedSideMeta: { fontSize: 12, lineHeight: 17, fontWeight: '900' }, proposedSideBody: { lineHeight: 20, fontWeight: '700' }, personBox: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, gap: 7 }, personName: { fontWeight: '900' }, messagesBox: { gap: 10 }, messageBubble: { alignSelf: 'flex-start', maxWidth: '92%', borderRadius: 18, borderWidth: 1, padding: 12, gap: 6 }, myMessageBubble: { alignSelf: 'flex-end' }, messageBody: { lineHeight: 20, fontWeight: '600' }, composer: { gap: 8 }, input: { minHeight: 80, borderRadius: 16, borderWidth: 1, padding: 12, fontSize: 16, lineHeight: 22 }, actionRow: { flexDirection: 'row', gap: 10 }, actionButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 12 }, primaryButton: { backgroundColor: '#0F766E' }, dangerButton: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }, actionText: { fontWeight: '900' }, primaryText: { color: '#FFFFFF' }, dangerText: { color: '#991B1B' }, muted: { fontWeight: '700' }, disabled: { opacity: 0.52 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
