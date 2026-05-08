import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TradeActionStatus, TradeStatus } from '@hellowhen/contracts';
import { formatCredits } from '@hellowhen/shared';
import type { SemanticColorName } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { CreditPill, InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import { MediaStrip } from './components/MediaStrip';
import type { TradeDeckItem, TradeProposalItem } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'TradeDetail'>;
type TradeResponse = { trade: TradeDeckItem };
type ProposalsResponse = { proposals: TradeProposalItem[] };

function normalizeStatus(status?: string): TradeStatus { const statuses = ['draft', 'active', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'expired', 'closed', 'cancelled']; return statuses.includes(status ?? '') ? status as TradeStatus : 'active'; }
function fallback(params: RootStackParamList['TradeDetail']): TradeDeckItem { return { id: params.tradeId, ownerId: 'unknown', providerId: null, title: params.title ?? 'Trade detail', description: params.description ?? '', creditAmount: params.creditAmount ?? 0, status: normalizeStatus(params.status), isPublic: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), expiresAt: params.expiresAt ?? null, closedAt: null }; }
function personLabel(person?: { profile?: { displayName?: string | null; handle?: string | null } | null } | null) { return person?.profile?.displayName || person?.profile?.handle || 'Hellowhen member'; }
function expiryLabel(expiresAt?: string | null) { if (!expiresAt) return 'No expiry set'; const ms = new Date(expiresAt).getTime(); if (!Number.isFinite(ms)) return 'No expiry set'; const diff = ms - Date.now(); if (diff <= 0) return 'Expired'; const hours = Math.ceil(diff / 1000 / 60 / 60); return hours < 24 ? `${hours}h left` : `${Math.ceil(hours / 24)}d left`; }
function statusHint(trade: TradeDeckItem, role: string) { if (trade.status === 'active') return role === 'owner' ? 'Open for proposals. Review conversations before accepting a provider.' : 'Send a proposal to start a private conversation with the owner.'; if (trade.status === 'in_progress') return role === 'owner' ? 'In progress. Complete the trade when the provider delivers, or cancel to release held credits.' : 'In progress. Use the accepted proposal conversation to coordinate delivery.'; if (trade.status === 'completed') return 'Completed. Earned credits will move through the wallet ledger.'; if (trade.status === 'cancelled') return 'Cancelled. Any active credit hold was released.'; return 'Review the current trade status before taking action.'; }

export function TradeDetailScreen({ route, navigation }: Props) {
  const auth = useAuth(); const params = route.params;
  const [trade, setTrade] = useState<TradeDeckItem>(() => fallback(params));
  const [proposals, setProposals] = useState<TradeProposalItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<TradeActionStatus | null>(null);
  const role = useMemo(() => { if (trade.ownerId === auth.user?.id) return 'owner'; if (trade.providerId && trade.providerId === auth.user?.id) return 'provider'; if (proposals.some((proposal) => proposal.applicantId === auth.user?.id && proposal.status === 'accepted')) return 'provider'; if (proposals.some((proposal) => proposal.applicantId === auth.user?.id)) return 'applicant'; return 'viewer'; }, [auth.user?.id, proposals, trade.ownerId, trade.providerId]);
  const myProposal = useMemo(() => proposals.find((proposal) => proposal.applicantId === auth.user?.id) ?? null, [auth.user?.id, proposals]);
  const media = useMemo(() => [...(trade.need?.media ?? []), ...(trade.offer?.media ?? []), ...(trade.media ?? [])], [trade.media, trade.need?.media, trade.offer?.media]);
  const loadTrade = useCallback(async () => { setLoading(true); setError(null); try { const result = await api.trades.get(params.tradeId) as TradeResponse; setTrade(result.trade); try { const proposalResult = await api.trades.proposals(params.tradeId) as ProposalsResponse; setProposals(Array.isArray(proposalResult.proposals) ? proposalResult.proposals : []); } catch { setProposals([]); } } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); setTrade((current) => current.id === params.tradeId ? current : fallback(params)); } finally { setLoading(false); } }, [params]);
  useEffect(() => { void loadTrade(); }, [loadTrade]);
  const actions = useMemo(() => { if (role === 'owner' && (trade.status === 'in_progress' || trade.status === 'submitted')) return [{ status: 'completed' as const, label: 'Mark Completed' }, { status: 'cancelled' as const, label: 'Cancel / Refund' }]; if (role === 'owner' && trade.status === 'active') return [{ status: 'cancelled' as const, label: 'Cancel Trade' }]; if (role === 'provider' && trade.status === 'in_progress') return [{ status: 'cancelled' as const, label: 'Cancel Trade' }]; return []; }, [role, trade.status]);
  const updateStatus = useCallback(async (status: TradeActionStatus) => { setActionLoading(status); setError(null); setMessage(null); try { const result = await api.trades.updateStatus(trade.id, { status }) as TradeResponse; setTrade(result.trade); setMessage(status === 'completed' ? 'Trade completed.' : status === 'cancelled' ? 'Trade cancelled.' : 'Trade updated.'); await loadTrade(); } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError, 'Could not update this trade. Please try again.')); } finally { setActionLoading(null); } }, [loadTrade, trade.id]);
  const openOrCreateProposal = useCallback(() => { if (myProposal) navigation.navigate('ProposalDetail', { proposalId: myProposal.id }); else navigation.navigate('CreateProposal', { tradeId: trade.id, title: trade.title }); }, [myProposal, navigation, trade.id, trade.title]);
  return <AppScreen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadTrade(); }} />}>
    <AppCard>
      <View style={styles.headerRow}><StatusBadge status={trade.status} /><SemanticBadge label="Trade" tone="trade" size="sm" /></View>
      <AppText style={styles.title}>{trade.title}</AppText>
      <MediaStrip media={media} size="large" />
      <AppText style={styles.description}>{trade.description}</AppText>
      <View style={styles.creditBox}><CreditPill amount={trade.creditAmount} label="credits" /><View style={styles.ownerPill}><View style={styles.avatar} /><View style={styles.ownerCopy}><AppText style={styles.metaLabel}>Owner</AppText><AppText style={styles.ownerName}>{personLabel(trade.owner)}</AppText></View></View></View>
      <View style={styles.metaGrid}><MetaBox label="Your role" value={role} tone="proposal" /><MetaBox label="Provider" value={trade.provider ? personLabel(trade.provider) : 'Not accepted yet'} tone="offer" /><MetaBox label="Expiry" value={expiryLabel(trade.expiresAt)} tone="time" /><MetaBox label="Visibility" value={trade.isPublic ? 'Public' : 'Private/closed'} tone="trade" /><MetaBox label="Payment" value={trade.payment?.status ?? 'Not held yet'} tone="credits" /><MetaBox label="Escrow" value={trade.escrow ? formatCredits(trade.escrow.heldCredits) : 'No hold yet'} tone="time" /></View>
      <InfoNotice tone="info" title="Next step" body={statusHint(trade, role)} />
      {error ? <InfoNotice tone="danger" title="Trade error" body={error} /> : null}
      {message ? <InfoNotice tone="success" title="Updated" body={message} /> : null}
      {loading ? <AppText style={styles.muted}>Refreshing trade detail...</AppText> : null}
      {role !== 'owner' && trade.status === 'active' ? <ActionButton label={myProposal ? 'Open Proposal Thread' : 'Send Proposal'} variant="primary" onPress={openOrCreateProposal} /> : null}
      {(role === 'owner' || role === 'provider' || role === 'applicant') && proposals.length > 0 ? <View style={styles.proposalsBox}><AppText style={styles.sectionTitle}>{role === 'owner' ? 'Proposal conversations' : 'Your proposal'}</AppText>{proposals.map((proposal) => <Pressable key={proposal.id} accessibilityRole="button" onPress={() => navigation.navigate('ProposalDetail', { proposalId: proposal.id })} style={({ pressed }) => [styles.proposalRow, pressed && styles.pressed]}><View style={styles.proposalCopy}><AppText style={styles.proposalTitle}>{personLabel(proposal.applicant)}</AppText><AppText style={styles.proposalMessage}>{proposal.message}</AppText></View><StatusBadge status={proposal.status} size="sm" /></Pressable>)}</View> : null}
      {actions.map((action) => <ActionButton key={action.status} label={actionLoading === action.status ? 'Updating...' : action.label} variant={action.status === 'cancelled' ? 'danger' : 'primary'} disabled={Boolean(actionLoading)} onPress={() => { void updateStatus(action.status); }} />)}
      <ActionButton label="Back to Trades" variant="ghost" onPress={() => navigation.goBack()} />
    </AppCard>
  </ScrollView></AppScreen>;
}
function MetaBox({ label, value, tone }: { label: string; value: string; tone: SemanticColorName }) { return <View style={styles.metaBox}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.metaValue}>{value}</AppText></View>; }
function ActionButton({ label, variant, disabled, onPress }: { label: string; variant: 'primary' | 'danger' | 'ghost'; disabled?: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, variant === 'primary' && styles.primaryButton, variant === 'danger' && styles.dangerButton, variant === 'ghost' && styles.ghostButton, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><AppText style={[styles.actionButtonText, variant === 'primary' && styles.primaryButtonText, variant === 'danger' && styles.dangerButtonText, variant === 'ghost' && styles.ghostButtonText]}>{label}</AppText></Pressable>; }
const styles = StyleSheet.create({ content: { paddingBottom: 28 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, title: { fontSize: 32, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8 }, description: { color: '#475569', fontSize: 16, lineHeight: 24, fontWeight: '600' }, creditBox: { borderRadius: 22, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', padding: 16, gap: 14 }, ownerPill: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: '#5EEAD4' }, ownerCopy: { flex: 1 }, ownerName: { marginTop: 2, fontWeight: '900' }, metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metaBox: { width: '47%', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 12, gap: 8 }, metaLabel: { color: '#64748B', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 }, metaValue: { fontWeight: '900' }, proposalsBox: { gap: 10 }, sectionTitle: { fontSize: 18, fontWeight: '900' }, proposalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 12 }, proposalCopy: { flex: 1 }, proposalTitle: { fontWeight: '900' }, proposalMessage: { marginTop: 3, color: '#64748B', fontWeight: '700' }, muted: { color: '#64748B', fontWeight: '700' }, actionButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 }, actionButtonText: { fontWeight: '900' }, primaryButton: { backgroundColor: '#7C3AED' }, primaryButtonText: { color: '#FFFFFF' }, dangerButton: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }, dangerButtonText: { color: '#991B1B' }, ghostButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' }, ghostButtonText: { color: '#334155' }, disabledButton: { opacity: 0.52 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
