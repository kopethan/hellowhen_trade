import React, { useCallback, useState } from 'react';
import { Button, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { WalletDto, LedgerEntryDto } from '@hellowhen/contracts';
import { formatCredits } from '@hellowhen/shared';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { CreditPill, InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useAuth } from '../../providers/AuthProvider';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
const formatLedgerType = (type: string) => type.replaceAll('_', ' ');
const formatLedgerAmount = (amount: number) => `${amount > 0 ? '+' : ''}${amount}`;
function ledgerTone(type: string, amount: number): SemanticColorName {
  if (type.includes('hold')) return 'time';
  if (type.includes('refund')) return 'warning';
  if (type.includes('release') || type.includes('earned')) return 'success';
  if (amount < 0) return 'danger';
  return 'credits';
}

export function AccountScreen() {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoadingWallet(true); setWalletError(null);
    try { const result = await api.wallet.me() as WalletResponse; setWallet(result.wallet); }
    catch (caughtError) { setWallet(null); setWalletError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setLoadingWallet(false); }
  }, []);
  useFocusEffect(useCallback(() => { void loadWallet(); }, [loadWallet]));

  const displayName = auth.user?.profile?.displayName || auth.user?.email || 'Hellowhen member';
  const totalCredits = wallet ? wallet.purchasedAvailableCredits + wallet.earnedPendingCredits + wallet.earnedAvailableCredits + wallet.heldCredits : 0;
  const recentEntries = wallet?.entries?.slice(0, 5) ?? [];

  return <AppScreen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loadingWallet} onRefresh={() => { void loadWallet(); }} />}>
    <View><AppText style={styles.title}>Account</AppText><AppText style={styles.subtitle}>Profile, semantic fake credits, settings, support, and logout live here.</AppText></View>
    <AppCard><AppText style={styles.sectionTitle}>Profile</AppText><View style={styles.profileRow}><View style={styles.avatar} /><View style={styles.profileCopy}><AppText style={styles.profileName}>{displayName}</AppText><AppText style={styles.cardText}>{auth.user?.email ?? 'Signed in user'}</AppText></View></View></AppCard>
    <AppCard><View style={styles.sectionHeaderRow}><AppText style={styles.sectionTitle}>Wallet / Credits</AppText><SemanticBadge label="Fake test only" tone="info" size="sm" /></View><CreditPill amount={totalCredits} label="total fake credits" /><InfoNotice tone="info" title="Credit meaning" body="Gold marks credit values. Orange marks held/time-sensitive credits. Green marks earned or successful credit movement. Stripe test-mode purchases can add non-withdrawable credits. No real payouts or Stripe Connect are enabled." />{wallet ? <View style={styles.walletGrid}><WalletMetric label="Available" value={wallet.purchasedAvailableCredits + wallet.earnedAvailableCredits} tone="credits" /><WalletMetric label="Held" value={wallet.heldCredits} tone="time" /><WalletMetric label="Pending earned" value={wallet.earnedPendingCredits} tone="success" /><WalletMetric label="Payout eligible" value={wallet.earnedAvailableCredits} tone="instruction" /></View> : null}<Button title="Buy Test Credits" onPress={() => navigation.navigate('BuyCredits')} />{walletError ? <InfoNotice tone="warning" title="Wallet fallback" body={walletError} /> : null}{loadingWallet ? <AppText style={styles.muted}>Refreshing wallet...</AppText> : null}</AppCard>
    <AppCard><AppText style={styles.sectionTitle}>Recent ledger entries</AppText>{recentEntries.length === 0 ? <AppText style={styles.cardText}>No ledger entries yet. Starting, completing, or cancelling trades will add fake/test credit entries here.</AppText> : recentEntries.map((entry) => <View key={entry.id} style={styles.ledgerRow}><View style={styles.ledgerCopy}><SemanticBadge label={formatLedgerType(entry.type)} tone={ledgerTone(entry.type, entry.amount)} size="sm" /><AppText style={styles.ledgerDescription}>{entry.description ?? entry.balanceType}</AppText></View><AppText style={[styles.ledgerAmount, entry.amount < 0 && styles.ledgerAmountNegative]}>{formatLedgerAmount(entry.amount)}</AppText></View>)}</AppCard>
    <AppCard><SemanticBadge label="Instruction" tone="instruction" size="sm" /><AppText style={styles.sectionTitle}>Settings</AppText><AppText style={styles.cardText}>Appearance, language, account, and notification controls stay here instead of becoming separate tabs.</AppText></AppCard>
    <AppCard><SemanticBadge label="Information" tone="info" size="sm" /><AppText style={styles.sectionTitle}>Support</AppText><AppText style={styles.cardText}>Send feedback, report a problem, ask for help, or follow up with admin support about trades, credits, images, bugs, and safety concerns.</AppText><Button title="Open Support Center" onPress={() => navigation.navigate('SupportCenter')} /></AppCard>
    <Button title="Logout" color="#B91C1C" onPress={() => { void auth.logout(); }} />
  </ScrollView></AppScreen>;
}
function WalletMetric({ label, value, tone }: { label: string; value: number; tone: SemanticColorName }) { return <View style={styles.metricBox}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.metricValue}>{formatCredits(value)}</AppText></View>; }
const styles = StyleSheet.create({ content: { paddingBottom: 30, gap: 14 }, title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 }, subtitle: { marginTop: 8, color: '#64748B', lineHeight: 20, fontWeight: '600' }, sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionTitle: { fontSize: 22, fontWeight: '900' }, cardText: { color: '#64748B', lineHeight: 20, fontWeight: '600' }, muted: { color: '#64748B', fontWeight: '700' }, profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: '#5EEAD4' }, profileCopy: { flex: 1 }, profileName: { fontSize: 20, fontWeight: '900' }, walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metricBox: { width: '47%', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', padding: 12, gap: 8 }, metricValue: { fontSize: 18, fontWeight: '900' }, ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 }, ledgerCopy: { flex: 1, gap: 6 }, ledgerDescription: { color: '#64748B', fontSize: 12, fontWeight: '700' }, ledgerAmount: { color: '#047857', fontSize: 18, fontWeight: '900' }, ledgerAmountNegative: { color: '#B91C1C' } });
