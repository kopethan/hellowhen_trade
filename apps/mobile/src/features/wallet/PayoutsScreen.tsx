import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PayoutRequestDto, PayoutSummaryDto, WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { ThemeTokens } from '@hellowhen/theme';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Payouts'>;
type PayoutsResponse = { wallet: WalletDto; payouts: PayoutRequestDto[]; summary: PayoutSummaryDto };

const presetAmounts = [500, 1000, 2500];

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function parseMoneyToCents(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  return (Number.parseInt(whole || '0', 10) * 100) + Number.parseInt(fraction.padEnd(2, '0').slice(0, 2) || '0', 10);
}

export function PayoutsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequestDto[]>([]);
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'connect' | 'payout' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; title: string; body: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const result = await api.wallet.payouts() as PayoutsResponse;
      setWallet(result.wallet);
      setSummary(result.summary);
      setPayouts(result.payouts ?? []);
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Payouts unavailable', body: getFriendlyApiErrorMessage(caughtError) });
      setWallet(null); setSummary(null); setPayouts([]);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const currency = summary?.currency ?? wallet?.currency ?? 'eur';
  const available = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const pending = summary?.pendingPayoutRequestsCents ?? 0;
  const paid = summary?.paidOutCents ?? 0;
  const selectedAmount = useMemo(() => parseMoneyToCents(amountText), [amountText]);
  const payoutConnected = summary?.payoutAccount.status === 'connected';
  const canRequest = payoutConnected && selectedAmount > 0 && selectedAmount <= available;

  async function connectDemoAccount() {
    setActionLoading('connect'); setNotice(null);
    try {
      const result = await api.wallet.connectDemoPayoutAccount() as PayoutsResponse;
      setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []);
      setNotice({ tone: 'success', title: 'Stripe demo connected', body: 'Your demo payout account is ready. No real bank account was linked.' });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Could not connect payout account', body: getFriendlyApiErrorMessage(caughtError) });
    } finally { setActionLoading(null); }
  }

  async function requestDemoPayout() {
    if (!canRequest) return;
    setActionLoading('payout'); setNotice(null);
    try {
      const result = await api.wallet.requestDemoPayout({ amountCents: selectedAmount, currency }) as PayoutsResponse;
      setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []); setAmountText('');
      setNotice({ tone: 'success', title: 'Demo payout paid', body: `${formatMoney(selectedAmount, currency)} was simulated as a Stripe demo payout. No real bank transfer was sent.` });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Could not request payout', body: getFriendlyApiErrorMessage(caughtError, 'Check your payout balance and try again.') });
    } finally { setActionLoading(null); }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Payouts" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.headerCopy}>
          <SemanticBadge label="Stripe demo" tone="success" />
          <AppText style={styles.title}>Payouts</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>See what you earned and simulate payout setup without moving real money.</AppText>
        </View>

        {notice ? <InfoNotice tone={notice.tone} title={notice.title} body={notice.body} /> : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Earnings</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>Completed money trades become available here for demo payouts.</AppText>
            </View>
            <SemanticBadge label={currency.toUpperCase()} tone="credits" />
          </View>
          <View style={styles.metricGrid}>
            <Metric theme={theme} label="Available" value={available} currency={currency} tone="success" />
            <Metric theme={theme} label="Pending payouts" value={pending} currency={currency} tone="time" />
            <Metric theme={theme} label="Paid out" value={paid} currency={currency} tone="info" />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Stripe payout setup</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{payoutConnected ? 'Demo payout account connected.' : 'Connect a simulated Stripe payout account before requesting payouts.'}</AppText>
            </View>
            <StatusBadge status={payoutConnected ? 'completed' : 'pending'} size="sm" />
          </View>
          <Pressable accessibilityRole="button" disabled={payoutConnected || actionLoading === 'connect'} onPress={() => { void connectDemoAccount(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: payoutConnected ? theme.color.subtleSurface : theme.semantic.proposal.bg }, (payoutConnected || actionLoading === 'connect') && styles.disabled, pressed && !payoutConnected && styles.pressed]}>
            <AppText style={[styles.primaryButtonText, payoutConnected && { color: theme.color.muted }]}>{payoutConnected ? 'Demo account connected' : actionLoading === 'connect' ? 'Connecting...' : 'Set up Stripe demo payout'}</AppText>
          </Pressable>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Request demo payout</AppText>
          <AppText style={[styles.cardText, { color: theme.color.muted }]}>You can request up to {formatMoney(available, currency)}. This simulation marks the payout as paid instantly.</AppText>
          <View style={styles.presetRow}>{presetAmounts.map((amount) => <Pressable key={amount} accessibilityRole="button" onPress={() => setAmountText((amount / 100).toFixed(2))} style={({ pressed }) => [styles.presetButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.presetText}>{formatMoney(amount, currency)}</AppText></Pressable>)}</View>
          <TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
          {selectedAmount > available ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>Amount is above your available payout balance.</AppText> : null}
          {!payoutConnected ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>Connect the Stripe demo payout account first.</AppText> : null}
          <Pressable accessibilityRole="button" disabled={!canRequest || actionLoading === 'payout'} onPress={() => { void requestDemoPayout(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.success.bg }, (!canRequest || actionLoading === 'payout') && styles.disabled, pressed && canRequest && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{actionLoading === 'payout' ? 'Sending...' : 'Request demo payout'}</AppText>
          </Pressable>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Payout history</AppText>
          {payouts.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>No payout history yet.</AppText> : payouts.map((payout) => <PayoutRow key={payout.id} payout={payout} theme={theme} />)}
        </AppCard>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function Metric({ theme, label, value, currency, tone }: { theme: ThemeTokens; label: string; value: number; currency: string; tone: 'success' | 'time' | 'info' }) {
  return <View style={[styles.metricBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.metricValue}>{formatMoney(value, currency)}</AppText></View>;
}

function PayoutRow({ payout, theme }: { payout: PayoutRequestDto; theme: ThemeTokens }) {
  return <View style={[styles.payoutRow, { borderTopColor: theme.color.border }]}><View style={styles.payoutCopy}><StatusBadge status={payout.status} size="sm" /><AppText style={styles.payoutTitle}>{formatMoney(payout.amountCents, payout.currency)}</AppText>{payout.notes ? <AppText style={[styles.payoutNote, { color: theme.color.muted }]}>{payout.notes}</AppText> : null}</View><AppText style={[styles.dateText, { color: theme.color.muted }]}>{formatDate(payout.paidAt ?? payout.requestedAt)}</AppText></View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 56, gap: 14 },
  headerCopy: { gap: 8 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { lineHeight: 20, fontWeight: '700' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900' },
  cardText: { lineHeight: 20, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricBox: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 13, gap: 8 },
  metricValue: { fontSize: 18, fontWeight: '900' },
  primaryButton: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  presetText: { fontWeight: '900' },
  amountInput: { minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, fontSize: 18, fontWeight: '900' },
  validationText: { fontWeight: '800', lineHeight: 19 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 12 },
  payoutCopy: { flex: 1, gap: 6 },
  payoutTitle: { fontSize: 18, fontWeight: '900' },
  payoutNote: { lineHeight: 18, fontWeight: '600' },
  dateText: { fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
