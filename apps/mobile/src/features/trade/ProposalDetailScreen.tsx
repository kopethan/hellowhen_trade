import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProposalActionStatus } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { CreditPill, InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import type { ProposalMessageItem, TradeProposalItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProposalDetail'>;
type ProposalResponse = { proposal: TradeProposalItem; trade?: unknown };
type MessagesResponse = { messages: ProposalMessageItem[] };
function personLabel(person?: { profile?: { displayName?: string | null; handle?: string | null } | null } | null) { return person?.profile?.displayName || person?.profile?.handle || 'Hellowhen member'; }
export function ProposalDetailScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const [proposal, setProposal] = useState<TradeProposalItem | null>(null);
  const [messages, setMessages] = useState<ProposalMessageItem[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<ProposalActionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadProposal = useCallback(async () => { setLoading(true); setError(null); try { const result = await api.proposals.get(route.params.proposalId) as ProposalResponse; setProposal(result.proposal); setMessages(result.proposal.messages ?? []); } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not load this proposal.')); } finally { setLoading(false); } }, [route.params.proposalId]);
  useEffect(() => { void loadProposal(); }, [loadProposal]);
  const isOwner = proposal?.trade?.ownerId === auth.user?.id;
  const isApplicant = proposal?.applicantId === auth.user?.id;
  const isAcceptedProvider = proposal?.trade?.providerId === auth.user?.id;
  const canMessage = proposal ? !['declined', 'withdrawn'].includes(proposal.status) : false;
  const statusHint = useMemo(() => { if (!proposal) return ''; if (proposal.status === 'pending') return isOwner ? 'Review the proposal, ask questions, then accept or decline.' : 'The owner can ask questions here before accepting.'; if (proposal.status === 'accepted') return 'Accepted. The trade moved in progress and fake credits were held.'; if (proposal.status === 'declined') return 'Declined. This proposal conversation is now closed.'; return 'Withdrawn. This proposal conversation is now closed.'; }, [proposal, isOwner]);
  async function sendMessage() { const trimmed = body.trim(); if (!trimmed) return; setSubmitting(true); setError(null); setNotice(null); try { await api.proposals.sendMessage(route.params.proposalId, { body: trimmed }); setBody(''); const messageResult = await api.proposals.messages(route.params.proposalId) as MessagesResponse; setMessages(messageResult.messages ?? []); } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not send this message.')); } finally { setSubmitting(false); } }
  async function updateStatus(status: ProposalActionStatus) { setActionLoading(status); setError(null); setNotice(null); try { const result = await api.proposals.updateStatus(route.params.proposalId, { status }) as ProposalResponse; setProposal(result.proposal); setMessages(result.proposal.messages ?? messages); setNotice(status === 'accepted' ? 'Proposal accepted. Fake credits are now held and the trade is in progress.' : status === 'declined' ? 'Proposal declined.' : 'Proposal withdrawn.'); } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not update this proposal.')); } finally { setActionLoading(null); } }
  if (!proposal) return <AppScreen><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProposal(); }} />}><AppCard><SemanticBadge label="Proposal" tone="proposal" /><AppText style={styles.title}>Proposal</AppText>{error ? <InfoNotice tone="danger" title="Proposal error" body={error} /> : <AppText style={styles.muted}>Loading proposal...</AppText>}<Button title="Back" onPress={() => navigation.goBack()} /></AppCard></ScrollView></AppScreen>;
  return <AppScreen><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProposal(); }} />} keyboardShouldPersistTaps="handled"><AppCard>
    <View style={styles.headerRow}><StatusBadge status={proposal.status} /><SemanticBadge label="Proposal thread" tone="proposal" size="sm" /></View>
    <AppText style={styles.title}>{proposal.trade?.title ?? 'Proposal'}</AppText>
    {proposal.trade ? <CreditPill amount={proposal.trade.creditAmount} label={`${proposal.trade.status.replace('_', ' ')} trade`} /> : <AppText style={styles.subtitle}>Private proposal conversation</AppText>}
    <View style={styles.peopleRow}><MiniPerson label="Owner" name={personLabel(proposal.trade?.owner)} tone="need" /><MiniPerson label="Applicant" name={personLabel(proposal.applicant)} tone="offer" /></View>
    <InfoNotice tone="instruction" title="Proposal next step" body={statusHint} />
    {error ? <InfoNotice tone="danger" title="Proposal error" body={error} /> : null}
    {notice ? <InfoNotice tone="success" title="Proposal updated" body={notice} /> : null}
    <View style={styles.messagesBox}>{messages.length === 0 ? <AppText style={styles.muted}>No messages yet.</AppText> : messages.map((message) => { const mine = message.senderId === auth.user?.id; return <View key={message.id} style={[styles.messageBubble, mine && styles.myMessageBubble]}><SemanticBadge label={mine ? 'You' : personLabel(message.sender)} tone={mine ? 'proposal' : 'info'} size="sm" /><AppText style={styles.messageBody}>{message.body}</AppText></View>; })}</View>
    {canMessage ? <View style={styles.composer}><TextInput value={body} onChangeText={setBody} multiline placeholder="Write a message..." style={styles.input} /><Button title={submitting ? 'Sending...' : 'Send'} disabled={submitting || body.trim().length === 0} onPress={() => { void sendMessage(); }} /></View> : null}
    {isOwner && proposal.status === 'pending' ? <View style={styles.actionRow}><ProposalActionButton label={actionLoading === 'accepted' ? 'Accepting...' : 'Accept'} variant="primary" disabled={Boolean(actionLoading)} onPress={() => { void updateStatus('accepted'); }} /><ProposalActionButton label={actionLoading === 'declined' ? 'Declining...' : 'Decline'} variant="danger" disabled={Boolean(actionLoading)} onPress={() => { void updateStatus('declined'); }} /></View> : null}
    {isApplicant && proposal.status === 'pending' ? <ProposalActionButton label={actionLoading === 'withdrawn' ? 'Withdrawing...' : 'Withdraw proposal'} variant="danger" disabled={Boolean(actionLoading)} onPress={() => { void updateStatus('withdrawn'); }} /> : null}
    {proposal.trade?.id ? <Button title="Open trade detail" onPress={() => navigation.navigate('TradeDetail', { tradeId: proposal.trade!.id, title: proposal.trade!.title, description: proposal.trade!.description, creditAmount: proposal.trade!.creditAmount, status: proposal.trade!.status, expiresAt: proposal.trade!.expiresAt ?? null })} /> : null}
    {isAcceptedProvider ? <InfoNotice tone="success" title="Accepted provider" body="You are the accepted provider for this trade." /> : null}
    <Button title="Back" color="#64748B" onPress={() => navigation.goBack()} />
  </AppCard></ScrollView></AppScreen>;
}
function MiniPerson({ label, name, tone }: { label: string; name: string; tone: 'need' | 'offer' }) { return <View style={styles.personBox}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.personName}>{name}</AppText></View>; }
function ProposalActionButton({ label, variant, disabled, onPress }: { label: string; variant: 'primary' | 'danger'; disabled?: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, variant === 'primary' ? styles.primaryButton : styles.dangerButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionText, variant === 'primary' ? styles.primaryText : styles.dangerText]}>{label}</AppText></Pressable>; }
const styles = StyleSheet.create({ content: { paddingBottom: 28 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, title: { fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { color: '#64748B', lineHeight: 20, fontWeight: '800' }, peopleRow: { flexDirection: 'row', gap: 10 }, personBox: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, backgroundColor: '#F8FAFC', gap: 7 }, personName: { fontWeight: '900' }, messagesBox: { gap: 10 }, messageBubble: { alignSelf: 'flex-start', maxWidth: '92%', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 12, gap: 6 }, myMessageBubble: { alignSelf: 'flex-end', backgroundColor: '#ECFDF5', borderColor: '#5EEAD4' }, messageBody: { lineHeight: 20, fontWeight: '600' }, composer: { gap: 8 }, input: { minHeight: 80, borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 12, fontSize: 16, lineHeight: 22 }, actionRow: { flexDirection: 'row', gap: 10 }, actionButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 12 }, primaryButton: { backgroundColor: '#0F766E' }, dangerButton: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }, actionText: { fontWeight: '900' }, primaryText: { color: '#FFFFFF' }, dangerText: { color: '#991B1B' }, muted: { color: '#64748B', fontWeight: '700' }, disabled: { opacity: 0.52 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
