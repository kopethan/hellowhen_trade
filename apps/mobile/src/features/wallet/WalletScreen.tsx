import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { LedgerEntryDto, WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { SemanticColorName } from '@hellowhen/theme';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';

type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };

function formatLedgerType(type: string) {
  return type.replaceAll('_', ' ');
}

function entryAmount(entry: LedgerEntryDto) {
  if (entry.amountCents) return `${entry.amountCents > 0 ? '+' : ''}${formatMoney(entry.amountCents, entry.currency ?? 'eur')}`;
  return entry.amount ? `${entry.amount > 0 ? '+' : ''}${entry.amount} legacy credits` : formatMoney(0, entry.currency ?? 'eur');
}

function ledgerTone(type: string, amountCents: number): SemanticColorName {
  if (type.includes('hold')) return 'time';
  if (type.includes('refund')) return 'warning';
  if (type.includes('release') || type.includes('earned')) return 'success';
  if (amountCents < 0) return 'danger';
  return 'credits';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function WalletScreen() {
  const theme = useThemeTokens();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.wallet.me() as WalletResponse;
      setWallet(result.wallet);
    } catch (caughtError) {
      setWallet(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadWallet(); }, [loadWallet]));

  const currency = wallet?.currency ?? 'eur';
  const total = wallet ? wallet.availableBalanceCents + wallet.heldBalanceCents + wallet.pendingPayoutCents : 0;
  const recentEntries = wallet?.entries ?? [];

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadWallet(); }} />}>
        <AppHeader title="Wallet" onBack={() => navigation.goBack()} />
        <View style={styles.header}>
          <SemanticBadge label="Wallet" tone="credits" />
          <AppText style={styles.title}>Wallet</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Track optional money used in trades, holds, refunds, and pending payouts.</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title="Wallet unavailable" body={error} /> : null}

        <AppCard>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceCopy}>
              <AppText style={[styles.balanceLabel, { color: theme.color.muted }]}>Total balance</AppText>
              <AppText style={styles.balanceValue}>{formatMoney(total, currency)}</AppText>
            </View>
            <MoneyPill amountCents={wallet?.availableBalanceCents ?? 0} currency={currency} label="available" />
          </View>
          <View style={styles.grid}>
            <Metric label="Available" value={wallet?.availableBalanceCents ?? 0} currency={currency} tone="credits" />
            <Metric label="Held" value={wallet?.heldBalanceCents ?? 0} currency={currency} tone="time" />
            <Metric label="Pending payout" value={wallet?.pendingPayoutCents ?? 0} currency={currency} tone="success" />
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('BuyCredits')} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.credits.bg }, pressed && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>Add Money</AppText>
          </Pressable>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Activity</AppText>
          {recentEntries.length === 0 ? (
            <View style={styles.emptyBox}>
              <AppText style={styles.emptyTitle}>No activity yet</AppText>
              <AppText style={styles.emptyText}>Wallet activity appears here after a trade with an optional money amount is held, refunded, or released.</AppText>
            </View>
          ) : recentEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function Metric({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: SemanticColorName }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.metric, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
      <SemanticBadge label={label} tone={tone} size="sm" />
      <AppText style={styles.metricValue}>{formatMoney(value, currency)}</AppText>
    </View>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntryDto }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.ledgerRow, { borderTopColor: theme.color.border }]}>
      <View style={styles.ledgerCopy}>
        <View style={styles.ledgerTitleRow}>
          <SemanticBadge label={formatLedgerType(entry.type)} tone={ledgerTone(entry.type, entry.amountCents || entry.amount)} size="sm" />
          <AppText style={[styles.ledgerDate, { color: theme.color.muted }]}>{formatDate(entry.createdAt)}</AppText>
        </View>
        <AppText style={[styles.ledgerDescription, { color: theme.color.muted }]}>{entry.description ?? entry.balanceType}</AppText>
      </View>
      <AppText style={[styles.ledgerAmount, (entry.amountCents || entry.amount) < 0 && styles.ledgerAmountNegative]}>{entryAmount(entry)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { lineHeight: 20, fontWeight: '600' },
  balanceHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  balanceCopy: { flex: 1 },
  balanceLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  balanceValue: { marginTop: 4, fontSize: 42, fontWeight: '900', letterSpacing: -1.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  metricValue: { fontSize: 18, fontWeight: '900' },
  primaryButton: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#78350F', fontWeight: '900' },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.35 },
  emptyBox: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', padding: 14, gap: 5 },
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
