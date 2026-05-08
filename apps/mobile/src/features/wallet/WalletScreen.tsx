import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LedgerEntryDto, PayoutRequestDto, PayoutSummaryDto, WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { SemanticColorName, ThemeTokens } from '@hellowhen/theme';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Wallet'>;
type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
type PayoutsResponse = { wallet: WalletDto; payouts: PayoutRequestDto[]; summary: PayoutSummaryDto };

function formatLedgerType(type: string) { return type.replaceAll('_', ' '); }
function entryAmount(entry: LedgerEntryDto) { return entry.amountCents ? `${entry.amountCents > 0 ? '+' : ''}${formatMoney(entry.amountCents, entry.currency ?? 'eur')}` : formatMoney(0, entry.currency ?? 'eur'); }
function ledgerTone(type: string, amountCents: number): SemanticColorName { if (type.includes('hold')) return 'time'; if (type.includes('refund')) return 'warning'; if (type.includes('payout')) return amountCents < 0 ? 'danger' : 'info'; if (type.includes('release') || type.includes('earned')) return 'success'; if (amountCents < 0) return 'danger'; return 'credits'; }
function formatDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''; }

export function WalletScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const [wallet, setWallet] = useState<(WalletDto & { entries?: LedgerEntryDto[] }) | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [walletResult, payoutsResult] = await Promise.all([api.wallet.me() as Promise<WalletResponse>, api.wallet.payouts() as Promise<PayoutsResponse>]);
      setWallet((walletResult.wallet ?? payoutsResult.wallet) as (WalletDto & { entries?: LedgerEntryDto[] }) | null);
      setSummary(payoutsResult.summary);
    } catch (caughtError) {
      setWallet(null); setSummary(null); setError(getFriendlyApiErrorMessage(caughtError));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadWallet(); }, [loadWallet]));

  const currency = wallet?.currency ?? summary?.currency ?? 'eur';
  const available = wallet?.availableBalanceCents ?? 0;
  const held = wallet?.heldBalanceCents ?? 0;
  const availableForPayout = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const pendingPayoutRequests = summary?.pendingPayoutRequestsCents ?? 0;
  const paidOut = summary?.paidOutCents ?? 0;
  const recentEntries = wallet?.entries ?? [];

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Wallet" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadWallet(); }} />}>
        <View style={styles.header}>
          <SemanticBadge label="Wallet" tone="credits" />
          <AppText style={styles.title}>Wallet</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Manage spendable wallet money, trade holds, earnings, and simulated payouts.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Wallet unavailable" body={error} /> : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Wallet money</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>Money you can offer in trades and money currently held in active trades.</AppText>
            </View>
            <MoneyPill amountCents={available} currency={currency} label="available" />
          </View>
          <View style={styles.grid}>
            <Metric label="Available to offer" value={available} currency={currency} tone="credits" />
            <Metric label="Held in trades" value={held} currency={currency} tone="time" />
          </View>
          <View style={styles.inlineActions}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('BuyCredits')} style={({ pressed }) => [styles.inlinePrimary, { backgroundColor: theme.semantic.credits.bg }, pressed && styles.pressed]}><AppText style={styles.inlinePrimaryText}>Add demo money</AppText></Pressable>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Earnings</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>Money earned from completed trades. Demo payouts use Stripe simulation only.</AppText>
            </View>
            <MoneyPill amountCents={availableForPayout} currency={currency} label="payout" />
          </View>
          <View style={styles.grid}>
            <Metric label="Available payout" value={availableForPayout} currency={currency} tone="success" />
            <Metric label="Pending payout" value={pendingPayoutRequests} currency={currency} tone="time" />
            <Metric label="Paid out" value={paidOut} currency={currency} tone="info" />
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Payouts')} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>Open payouts</AppText></Pressable>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>How it works</AppText>
          <View style={styles.steps}>
            <Step theme={theme} number="1" text="Add demo money, then offer it under I offer when creating a trade." />
            <Step theme={theme} number="2" text="When a proposal is accepted, the payer’s money is held until completion." />
            <Step theme={theme} number="3" text="Completed trade money becomes earnings that can be sent through demo payouts." />
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Activity</AppText>
          {recentEntries.length === 0 ? <View style={[styles.emptyBox, { borderColor: theme.color.border }]}><AppText style={styles.emptyTitle}>No activity yet</AppText><AppText style={[styles.emptyText, { color: theme.color.muted }]}>Wallet activity appears after demo top-ups, trade holds, refunds, earnings, or payouts.</AppText></View> : recentEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
        </AppCard>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function Metric({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: SemanticColorName }) {
  const theme = useThemeTokens();
  return <View style={[styles.metric, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.metricValue}>{formatMoney(value, currency)}</AppText></View>;
}

function Step({ theme, number, text }: { theme: ThemeTokens; number: string; text: string }) { return <View style={styles.stepRow}><View style={[styles.stepNumber, { backgroundColor: theme.semantic.proposal.softBg }]}><AppText style={[styles.stepNumberText, { color: theme.semantic.proposal.text }]}>{number}</AppText></View><AppText style={[styles.stepText, { color: theme.color.muted }]}>{text}</AppText></View>; }

function LedgerRow({ entry }: { entry: LedgerEntryDto }) {
  const theme = useThemeTokens();
  return <View style={[styles.ledgerRow, { borderTopColor: theme.color.border }]}><View style={styles.ledgerCopy}><View style={styles.ledgerTitleRow}><SemanticBadge label={formatLedgerType(entry.type)} tone={ledgerTone(entry.type, entry.amountCents || entry.amount)} size="sm" /><AppText style={[styles.ledgerDate, { color: theme.color.muted }]}>{formatDate(entry.createdAt)}</AppText></View><AppText style={[styles.ledgerDescription, { color: theme.color.muted }]}>{entry.description ?? entry.balanceType}</AppText></View><AppText style={[styles.ledgerAmount, (entry.amountCents || entry.amount) < 0 && styles.ledgerAmountNegative]}>{entryAmount(entry)}</AppText></View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 56, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  cardText: { lineHeight: 20, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  metricValue: { fontSize: 18, fontWeight: '900' },
  inlineActions: { flexDirection: 'row', gap: 10 },
  inlinePrimary: { flex: 1, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  inlinePrimaryText: { color: '#78350F', fontWeight: '900' },
  secondaryButton: { borderRadius: 16, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  secondaryButtonText: { fontWeight: '900' },
  steps: { gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontWeight: '900' },
  stepText: { flex: 1, lineHeight: 20, fontWeight: '700' },
  emptyBox: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', padding: 14, gap: 5 },
  emptyTitle: { fontWeight: '900' },
  emptyText: { lineHeight: 20, fontWeight: '600' },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 12 },
  ledgerCopy: { flex: 1, gap: 7 },
  ledgerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ledgerDate: { fontSize: 12, fontWeight: '800' },
  ledgerDescription: { lineHeight: 19, fontWeight: '600' },
  ledgerAmount: { color: '#047857', fontSize: 19, fontWeight: '900' },
  ledgerAmountNegative: { color: '#B91C1C' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
