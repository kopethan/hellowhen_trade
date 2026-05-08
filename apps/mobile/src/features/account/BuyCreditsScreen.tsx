import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CreditPurchaseDto, LedgerEntryDto, WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useThemeTokens } from '../../providers/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'BuyCredits'>;
type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
type PurchasesResponse = { purchases: CreditPurchaseDto[] };
function formatDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''; }

export function BuyCreditsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [purchases, setPurchases] = useState<CreditPurchaseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const [walletResult, purchaseResult] = await Promise.all([api.wallet.me() as Promise<WalletResponse>, api.credits.purchasesMine() as Promise<PurchasesResponse>]);
      setWallet(walletResult.wallet ?? null);
      setPurchases(Array.isArray(purchaseResult.purchases) ? purchaseResult.purchases : []);
    } catch (caughtError) {
      setWallet(null); setPurchases([]); setMessage(getFriendlyApiErrorMessage(caughtError));
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const currency = wallet?.currency ?? 'eur';
  const available = wallet?.availableBalanceCents ?? 0;
  const held = wallet?.heldBalanceCents ?? 0;
  const pending = wallet?.pendingPayoutCents ?? 0;
  return <AppScreen><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
    <AppHeader title="Wallet money" onBack={() => navigation.goBack()} />
    <View style={styles.headerCopy}><SemanticBadge label="Wallet" tone="credits" /><AppText style={styles.title}>Wallet money</AppText><AppText style={[styles.subtitle, { color: theme.color.muted }]}>Money is selected inside “I need” or “I offer” when creating a trade.</AppText></View>
    {message ? <InfoNotice tone="warning" title="Wallet unavailable" body={message} /> : null}
    <InfoNotice tone="warning" title="Top-up unavailable" body="Adding new money is not available in this build. Existing wallet money can still be offered in trades." />
    <AppCard><View style={styles.sectionHeaderRow}><View style={styles.sectionCopy}><AppText style={styles.sectionTitle}>Balance</AppText><AppText style={[styles.cardText, { color: theme.color.muted }]}>You can only offer up to your available wallet balance.</AppText></View><MoneyPill amountCents={available} currency={currency} label="available" /></View><View style={styles.metricGrid}><Metric theme={theme} label="Available" value={available} currency={currency} /><Metric theme={theme} label="Held" value={held} currency={currency} /><Metric theme={theme} label="Pending" value={pending} currency={currency} /></View></AppCard>
    <AppCard><AppText style={styles.sectionTitle}>How it works</AppText><View style={styles.steps}><Step theme={theme} number="1" text="Create a trade and choose money under I need or I offer." /><Step theme={theme} number="2" text="Money offered by a payer is held when a proposal is accepted." /><Step theme={theme} number="3" text="After completion, held money moves to pending payout." /></View></AppCard>
    <AppCard><AppText style={styles.sectionTitle}>Recent top-ups</AppText>{purchases.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>No top-up history yet.</AppText> : purchases.slice(0, 8).map((purchase) => <View key={purchase.id} style={[styles.purchaseRow, { borderTopColor: theme.color.border }]}><View style={styles.purchaseCopy}><StatusBadge status={purchase.status} size="sm" /><AppText style={styles.purchaseTitle}>{formatMoney(purchase.amountCents, purchase.currency)}</AppText></View><AppText style={[styles.dateText, { color: theme.color.muted }]}>{formatDate(purchase.createdAt)}</AppText></View>)}</AppCard>
  </ScrollView></AppScreen>;
}
function Metric({ theme, label, value, currency }: { theme: ThemeTokens; label: string; value: number; currency: string }) { return <View style={[styles.metricBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><AppText style={[styles.metricLabel, { color: theme.color.muted }]}>{label}</AppText><AppText style={styles.metricValue}>{formatMoney(value, currency)}</AppText></View>; }
function Step({ theme, number, text }: { theme: ThemeTokens; number: string; text: string }) { return <View style={styles.stepRow}><View style={[styles.stepNumber, { backgroundColor: theme.semantic.proposal.softBg }]}><AppText style={[styles.stepNumberText, { color: theme.semantic.proposal.text }]}>{number}</AppText></View><AppText style={[styles.stepText, { color: theme.color.muted }]}>{text}</AppText></View>; }
const styles = StyleSheet.create({ content: { paddingBottom: 56, gap: 14 }, headerCopy: { gap: 8 }, title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { lineHeight: 20, fontWeight: '700' }, sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, sectionCopy: { flex: 1, gap: 4 }, sectionTitle: { fontSize: 22, fontWeight: '900' }, cardText: { lineHeight: 20, fontWeight: '600' }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metricBox: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 13, gap: 8 }, metricLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 }, metricValue: { fontSize: 18, fontWeight: '900' }, steps: { gap: 12 }, stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, stepNumberText: { fontWeight: '900' }, stepText: { flex: 1, lineHeight: 20, fontWeight: '700' }, purchaseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 10, gap: 10 }, purchaseCopy: { flex: 1, gap: 6 }, purchaseTitle: { fontSize: 16, fontWeight: '900' }, dateText: { fontSize: 12, fontWeight: '800' }, pressed: { opacity: 0.78 } });
