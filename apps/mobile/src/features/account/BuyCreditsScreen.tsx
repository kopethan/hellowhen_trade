import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LedgerEntryDto, WalletDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useThemeTokens } from '../../providers/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'BuyCredits'>;
type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null; message?: string };

const demoAmounts = [500, 1000, 2500, 5000];

function parseMoneyToCents(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  return (Number.parseInt(whole || '0', 10) * 100) + Number.parseInt(fraction.padEnd(2, '0').slice(0, 2) || '0', 10);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

function entryAmount(entry: LedgerEntryDto) {
  if (entry.amountCents) return `${entry.amountCents > 0 ? '+' : ''}${formatMoney(entry.amountCents, entry.currency ?? 'eur')}`;
  return formatMoney(0, entry.currency ?? 'eur');
}

export function BuyCreditsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; title: string; body: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    try {
      const result = await api.wallet.me() as WalletResponse;
      setWallet(result.wallet ?? null);
    } catch (caughtError) {
      setWallet(null); setNotice({ tone: 'danger', title: 'Wallet unavailable', body: getFriendlyApiErrorMessage(caughtError) });
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const currency = wallet?.currency ?? 'eur';
  const selectedAmount = useMemo(() => parseMoneyToCents(amountText), [amountText]);
  const topUps = (wallet?.entries ?? []).filter((entry) => entry.type === 'test_credit_grant' || entry.type === 'credit_purchase').slice(0, 8);
  const canAdd = selectedAmount >= 100 && selectedAmount <= 100000;

  async function addDemoMoney() {
    if (!canAdd) return;
    setAdding(true); setNotice(null);
    try {
      const result = await api.wallet.demoTopUp({ amountCents: selectedAmount, currency }) as WalletResponse;
      setWallet(result.wallet ?? null);
      setAmountText('');
      setNotice({ tone: 'success', title: 'Demo money added', body: `${formatMoney(selectedAmount, currency)} was added to your wallet. No real card was charged.` });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Could not add demo money', body: getFriendlyApiErrorMessage(caughtError, 'Please try again.') });
    } finally { setAdding(false); }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Add money" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.headerCopy}>
          <SemanticBadge label="Stripe demo" tone="credits" />
          <AppText style={styles.title}>Add demo money</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>Simulate a Stripe wallet top-up for testing trades. No real card is charged.</AppText>
        </View>

        {notice ? <InfoNotice tone={notice.tone} title={notice.title} body={notice.body} /> : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Wallet balance</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>Available money can be offered inside “I offer” on a trade.</AppText>
            </View>
            <View style={[styles.balancePill, { backgroundColor: theme.semantic.credits.softBg, borderColor: theme.semantic.credits.border }]}>
              <AppText style={[styles.balanceValue, { color: theme.semantic.credits.text }]}>{formatMoney(wallet?.availableBalanceCents ?? 0, currency)}</AppText>
              <AppText style={[styles.balanceLabel, { color: theme.semantic.credits.text }]}>available</AppText>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Choose demo amount</AppText>
          <View style={styles.amountGrid}>{demoAmounts.map((amount) => <Pressable key={amount} accessibilityRole="button" onPress={() => setAmountText((amount / 100).toFixed(2))} style={({ pressed }) => [styles.amountOption, { borderColor: theme.color.border, backgroundColor: theme.color.subtleSurface }, selectedAmount === amount && { borderColor: theme.semantic.credits.border, backgroundColor: theme.semantic.credits.softBg }, pressed && styles.pressed]}><AppText style={[styles.amountOptionValue, selectedAmount === amount && { color: theme.semantic.credits.text }]}>{formatMoney(amount, currency)}</AppText><AppText style={[styles.amountOptionLabel, { color: selectedAmount === amount ? theme.semantic.credits.text : theme.color.muted }]}>demo</AppText></Pressable>)}</View>
          <TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="Custom amount" placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
          {selectedAmount > 100000 ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>Demo top-up limit is {formatMoney(100000, currency)}.</AppText> : null}
          {selectedAmount > 0 && selectedAmount < 100 ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>Minimum demo top-up is {formatMoney(100, currency)}.</AppText> : null}
          <Pressable accessibilityRole="button" disabled={!canAdd || adding} onPress={() => { void addDemoMoney(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.credits.bg }, (!canAdd || adding) && styles.disabled, pressed && canAdd && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{adding ? 'Adding...' : 'Continue with Stripe demo'}</AppText>
          </Pressable>
          <AppText style={[styles.disclaimer, { color: theme.color.muted }]}>This is test wallet money for product simulation. It is not a deposit and cannot be withdrawn as real money.</AppText>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>Recent demo top-ups</AppText>
          {topUps.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>No demo top-up history yet.</AppText> : topUps.map((entry) => <View key={entry.id} style={[styles.topUpRow, { borderTopColor: theme.color.border }]}><View style={styles.topUpCopy}><SemanticBadge label={entry.type === 'test_credit_grant' ? 'demo top-up' : 'top-up'} tone="credits" size="sm" /><AppText style={styles.topUpTitle}>{entry.description ?? 'Wallet top-up'}</AppText></View><View style={styles.topUpAmount}><AppText style={styles.topUpValue}>{entryAmount(entry)}</AppText><AppText style={[styles.topUpDate, { color: theme.color.muted }]}>{formatDate(entry.createdAt)}</AppText></View></View>)}
        </AppCard>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
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
  balancePill: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, alignItems: 'center' },
  balanceValue: { fontSize: 18, fontWeight: '900' },
  balanceLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amountOption: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 14, gap: 3 },
  amountOptionValue: { fontSize: 22, fontWeight: '900' },
  amountOptionLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  amountInput: { minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, fontSize: 18, fontWeight: '900' },
  validationText: { fontWeight: '800', lineHeight: 19 },
  primaryButton: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  disclaimer: { lineHeight: 19, fontWeight: '700' },
  topUpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 12 },
  topUpCopy: { flex: 1, gap: 6 },
  topUpTitle: { lineHeight: 18, fontWeight: '700' },
  topUpAmount: { alignItems: 'flex-end', gap: 3 },
  topUpValue: { fontSize: 17, fontWeight: '900' },
  topUpDate: { fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
