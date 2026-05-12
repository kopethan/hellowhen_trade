import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LedgerEntryDto, MoneySafetyStatusDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { formatLocalizedMoney, formatLocalizedShortDate } from '@hellowhen/i18n';
import type { SupportedLanguage } from '@hellowhen/i18n';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'BuyCredits'>;
type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null; message?: string };

const demoAmounts = [500, 1000, 2500, 5000];

function parseMoneyToCents(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  return (Number.parseInt(whole || '0', 10) * 100) + Number.parseInt(fraction.padEnd(2, '0').slice(0, 2) || '0', 10);
}

function money(value: number, currency: string, language: SupportedLanguage) {
  return formatLocalizedMoney(value, currency, language);
}

function entryAmount(entry: LedgerEntryDto, language: SupportedLanguage) {
  const currency = entry.currency ?? 'eur';
  if (entry.amountCents) return `${entry.amountCents > 0 ? '+' : ''}${money(entry.amountCents, currency, language)}`;
  return money(0, currency, language);
}

export function BuyCreditsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const [wallet, setWallet] = useState<WalletResponse['wallet']>(null);
  const [limits, setLimits] = useState<WalletLimitsDto | null>(null);
  const [moneySafety, setMoneySafety] = useState<MoneySafetyStatusDto | null>(null);
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; title: string; body: string } | null>(null);

  const load = useCallback(async () => {
    if (!betaFeatures.walletVisible) { setWallet(null); setLimits(null); setMoneySafety(null); return; }
    setLoading(true); setNotice(null);
    try {
      const [result, limitResult, safetyResult] = await Promise.all([api.wallet.me() as Promise<WalletResponse>, api.wallet.limits() as Promise<{ limits: WalletLimitsDto }>, api.wallet.moneySafety() as Promise<{ moneySafety: MoneySafetyStatusDto }>]);
      setWallet(result.wallet ?? null);
      setLimits(limitResult.limits ?? null);
      setMoneySafety(safetyResult.moneySafety ?? null);
    } catch (caughtError) {
      setWallet(null); setNotice({ tone: 'danger', title: t('account.walletUnavailable'), body: getFriendlyApiErrorMessage(caughtError) });
    } finally { setLoading(false); }
  }, [t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!betaFeatures.walletVisible) {
    return (
      <AppFixedHeaderScreen header={<AppHeader title={t('account.addMoney.title')} onBack={() => navigation.goBack()} />}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <InfoNotice tone="info" title={t('account.addMoney.hiddenTitle')} body={t('account.addMoney.hiddenBody')} />
        </ScrollView>
      </AppFixedHeaderScreen>
    );
  }

  const currency = wallet?.currency ?? 'eur';
  const selectedAmount = parseMoneyToCents(amountText);
  const topUps = (wallet?.entries ?? []).filter((entry) => entry.type === 'test_credit_grant' || entry.type === 'credit_purchase').slice(0, 8);
  const currentExposureCents = limits?.walletExposureCents ?? wallet?.availableBalanceCents ?? 0;
  const walletCapCents = limits?.walletBalanceCapCents ?? 100000;
  const remainingCapCents = Math.max(0, walletCapCents - currentExposureCents);
  const limitBlocked = Boolean(limits && (!limits.walletTopUpsEnabled || selectedAmount > remainingCapCents));
  const safetyBlocked = Boolean(moneySafety && (moneySafety.launchMode === 'disabled' || !moneySafety.privateBetaAllowed || (moneySafety.policyAcknowledgementRequired && !moneySafety.policyAcknowledged)));
  const canAdd = selectedAmount >= 100 && selectedAmount <= 100000 && !limitBlocked && !safetyBlocked;

  async function acknowledgeSafety() {
    setAdding(true); setNotice(null);
    try {
      const result = await api.wallet.acknowledgeMoneySafety({ accepted: true }) as { moneySafety: MoneySafetyStatusDto };
      setMoneySafety(result.moneySafety ?? null);
      setNotice({ tone: 'success', title: t('account.addMoney.safetyAccepted'), body: t('account.addMoney.policyAcknowledged') });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: t('account.addMoney.safetyReview'), body: getFriendlyApiErrorMessage(caughtError, t('common.actions.tryAgain')) });
    } finally { setAdding(false); }
  }

  async function addDemoMoney() {
    if (!canAdd) return;
    setAdding(true); setNotice(null);
    try {
      const result = await api.wallet.demoTopUp({ amountCents: selectedAmount, currency }) as WalletResponse;
      setWallet(result.wallet ?? null);
      setAmountText('');
      setNotice({ tone: 'success', title: t('account.addMoney.demoMoneyAddedTitle'), body: t('account.addMoney.demoMoneyAddedBody', { amount: money(selectedAmount, currency, language) }) });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: t('account.addMoney.couldNotAdd'), body: getFriendlyApiErrorMessage(caughtError, t('common.actions.tryAgain')) });
    } finally { setAdding(false); }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('account.addMoney.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.headerCopy}>
          <SemanticBadge label="Stripe demo" tone="credits" />
          <AppText style={styles.title}>{t('account.addMoney.addDemoMoney')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.addMoney.simulationBody')}</AppText>
        </View>

        {notice ? <InfoNotice tone={notice.tone} title={notice.title} body={notice.body} /> : null}

        {moneySafety ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>{t('account.addMoney.safetyTitle')}</AppText>
                <AppText style={[styles.cardText, { color: theme.color.muted }]}>{moneySafety.message}</AppText>
              </View>
              <SemanticBadge label={moneySafety.policyAcknowledged ? t('common.states.accepted') : t('common.states.review')} tone={moneySafety.policyAcknowledged ? 'success' : 'warning'} size="sm" />
            </View>
            {!moneySafety.policyAcknowledged ? (
              <Pressable accessibilityRole="button" disabled={adding} onPress={() => { void acknowledgeSafety(); }} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={styles.secondaryButtonText}>{t('account.addMoney.acceptPolicies')}</AppText>
              </Pressable>
            ) : <AppText style={[styles.disclaimer, { color: theme.color.muted }]}>{t('account.addMoney.policyAccepted', { version: moneySafety.policyVersion })}</AppText>}
          </AppCard>
        ) : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.addMoney.walletBalance')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.addMoney.balanceBody')}</AppText>
            </View>
            <View style={[styles.balancePill, { backgroundColor: theme.semantic.credits.softBg, borderColor: theme.semantic.credits.border }]}>
              <AppText style={[styles.balanceValue, { color: theme.semantic.credits.text }]}>{money(wallet?.availableBalanceCents ?? 0, currency, language)}</AppText>
              <AppText style={[styles.balanceLabel, { color: theme.semantic.credits.text }]}>{t('account.addMoney.available')}</AppText>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.addMoney.chooseDemoAmount')}</AppText>
          <View style={styles.amountGrid}>{demoAmounts.map((amount) => <Pressable key={amount} accessibilityRole="button" onPress={() => setAmountText((amount / 100).toFixed(2))} style={({ pressed }) => [styles.amountOption, { borderColor: theme.color.border, backgroundColor: theme.color.subtleSurface }, selectedAmount === amount && { borderColor: theme.semantic.credits.border, backgroundColor: theme.semantic.credits.softBg }, pressed && styles.pressed]}><AppText style={[styles.amountOptionValue, selectedAmount === amount && { color: theme.semantic.credits.text }]}>{money(amount, currency, language)}</AppText><AppText style={[styles.amountOptionLabel, { color: selectedAmount === amount ? theme.semantic.credits.text : theme.color.muted }]}>{t('account.addMoney.demo')}</AppText></Pressable>)}</View>
          <TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder={t('account.addMoney.customAmount')} placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
          {limits ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>{t('account.addMoney.launchWalletCap', { cap: money(walletCapCents, currency, language), remaining: money(remainingCapCents, currency, language) })}</AppText> : null}
          {safetyBlocked ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.addMoney.blockedSafety')}</AppText> : null}
          {limitBlocked ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.addMoney.blockedLimit')}</AppText> : null}
          {selectedAmount > 100000 ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.addMoney.topUpLimit', { amount: money(100000, currency, language) })}</AppText> : null}
          {selectedAmount > 0 && selectedAmount < 100 ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>{t('account.addMoney.minimumTopUp', { amount: money(100, currency, language) })}</AppText> : null}
          <Pressable accessibilityRole="button" disabled={!canAdd || adding} onPress={() => { void addDemoMoney(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.credits.bg }, (!canAdd || adding) && styles.disabled, pressed && canAdd && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{adding ? t('account.addMoney.adding') : t('account.addMoney.continueStripeDemo')}</AppText>
          </Pressable>
          <AppText style={[styles.disclaimer, { color: theme.color.muted }]}>{t('account.addMoney.simulationDisclaimer')}</AppText>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.addMoney.recentTopUps')}</AppText>
          {topUps.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.addMoney.noTopUpHistory')}</AppText> : topUps.map((entry) => <View key={entry.id} style={[styles.topUpRow, { borderTopColor: theme.color.border }]}><View style={styles.topUpCopy}><SemanticBadge label={entry.type === 'test_credit_grant' ? t('account.addMoney.demo') : t('account.addMoney.topUp')} tone="credits" size="sm" /><AppText style={styles.topUpTitle}>{entry.description ?? t('account.addMoney.walletTopUp')}</AppText></View><View style={styles.topUpAmount}><AppText style={styles.topUpValue}>{entryAmount(entry, language)}</AppText><AppText style={[styles.topUpDate, { color: theme.color.muted }]}>{formatLocalizedShortDate(entry.createdAt, language, '')}</AppText></View></View>)}
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
  secondaryButton: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  secondaryButtonText: { fontWeight: '900', textAlign: 'center' },
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
