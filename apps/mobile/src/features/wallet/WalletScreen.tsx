import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LedgerEntryDto, PayoutRequestDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { formatLocalizedMoney, formatLocalizedShortDate } from '@hellowhen/i18n';
import type { SupportedLanguage } from '@hellowhen/i18n';
import type { SemanticColorName, ThemeTokens } from '@hellowhen/theme';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppText } from '../../components/AppText';
import { InfoNotice, MoneyPill, SemanticBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Wallet'>;
type WalletResponse = { wallet: (WalletDto & { entries?: LedgerEntryDto[] }) | null };
type PayoutsResponse = { wallet: WalletDto; payouts: PayoutRequestDto[]; summary: PayoutSummaryDto };

function formatLedgerType(type: string) { if (type === 'test_credit_grant') return 'demo top-up'; if (type === 'credit_purchase') return 'wallet top-up'; if (type === 'payout_requested') return 'payout'; return type.replaceAll('_', ' '); }
function formatMoney(cents: number, currency: string, language: SupportedLanguage) { return formatLocalizedMoney(cents, currency, language); }
function entryAmount(entry: LedgerEntryDto, language: SupportedLanguage) { return entry.amountCents ? `${entry.amountCents > 0 ? '+' : ''}${formatMoney(entry.amountCents, entry.currency ?? 'eur', language)}` : formatMoney(0, entry.currency ?? 'eur', language); }
function ledgerTone(type: string, amountCents: number): SemanticColorName { if (type.includes('hold')) return 'time'; if (type.includes('refund')) return 'warning'; if (type.includes('payout')) return amountCents < 0 ? 'danger' : 'info'; if (type.includes('release') || type.includes('earned')) return 'success'; if (amountCents < 0) return 'danger'; return 'credits'; }
const defaultPayoutPlatformFeeRateBps = 1000;
function normalizePayoutFeeRateBps(value?: number | null) { if (typeof value !== 'number' || !Number.isFinite(value)) return defaultPayoutPlatformFeeRateBps; return Math.min(Math.max(Math.trunc(value), 0), 5000); }
function calculatePayoutFeeCents(grossAmountCents: number, platformFeeRateBps = defaultPayoutPlatformFeeRateBps) { const gross = Math.max(0, Math.trunc(grossAmountCents || 0)); const rate = normalizePayoutFeeRateBps(platformFeeRateBps); if (gross <= 0 || rate <= 0) return 0; return Math.min(gross, Math.round((gross * rate) / 10000)); }
function formatPayoutFeeRate(platformFeeRateBps = defaultPayoutPlatformFeeRateBps) { const rate = normalizePayoutFeeRateBps(platformFeeRateBps); return `${Number((rate / 100).toFixed(2))}%`; }

export function WalletScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<(WalletDto & { entries?: LedgerEntryDto[] }) | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWallet = useCallback(async () => {
    if (!betaFeatures.walletVisible) { setWallet(null); setSummary(null); setError(null); return; }
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

  if (!betaFeatures.walletVisible) {
    return (
      <AppFixedHeaderScreen header={<AppHeader title={t('account.wallet.title')} onBack={() => navigation.goBack()} />}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <InfoNotice tone="info" title={t('account.addMoney.hiddenTitle')} body={t('account.addMoney.hiddenBody')} />
        </ScrollView>
      </AppFixedHeaderScreen>
    );
  }

  const currency = wallet?.currency ?? summary?.currency ?? 'eur';
  const available = wallet?.availableBalanceCents ?? 0;
  const held = wallet?.heldBalanceCents ?? 0;
  const availableForPayout = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);
  const estimatedPlatformFee = summary?.estimatedPlatformFeeCents ?? calculatePayoutFeeCents(availableForPayout, platformFeeRateBps);
  const estimatedNetPayout = summary?.estimatedNetPayoutCents ?? Math.max(0, availableForPayout - estimatedPlatformFee);
  const pendingPayoutRequests = summary?.pendingPayoutRequestsNetCents ?? summary?.pendingPayoutRequestsCents ?? 0;
  const paidOut = summary?.paidOutNetCents ?? summary?.paidOutCents ?? 0;
  const limits = summary?.limits as WalletLimitsDto | undefined;
  const recentEntries = wallet?.entries?.filter((entry) => entry.amountCents !== 0 && entry.type !== 'starting_demo_credits') ?? [];
  const providerBalances = summary?.providerWalletBalances ?? [];

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('account.wallet.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadWallet(); }} />}>
        <View style={styles.header}>
          <SemanticBadge label={t('account.wallet.title')} tone="credits" />
          <AppText style={styles.title}>{t('account.wallet.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.wallet.body')}</AppText>
        </View>

        {error ? <InfoNotice tone="danger" title={t('account.walletUnavailable')} body={error} /> : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.walletMoney')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.wallet.availableBody')}</AppText>
            </View>
            <MoneyPill amountCents={available} currency={currency} label={t('account.wallet.available')} />
          </View>
          <View style={styles.grid}>
            <Metric label={t('account.wallet.available')} value={available} currency={currency} tone="credits" />
            <Metric label={t('account.wallet.held')} value={held} currency={currency} tone="time" />
          </View>
          <View style={styles.inlineActions}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('BuyCredits')} style={({ pressed }) => [styles.inlinePrimary, { backgroundColor: theme.semantic.credits.bg }, pressed && styles.pressed]}><AppText style={styles.inlinePrimaryText}>{t('account.addMoney.addDemoMoney')}</AppText></Pressable>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.wallet.earnings')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.wallet.earningsBody', { rate: formatPayoutFeeRate(platformFeeRateBps) })}</AppText>
            </View>
            <MoneyPill amountCents={availableForPayout} currency={currency} label={t('account.payouts.title')} />
          </View>
          <View style={styles.grid}>
            <Metric label={t('account.availableEarnings')} value={availableForPayout} currency={currency} tone="success" />
            <Metric label={t('account.wallet.platformFee')} value={estimatedPlatformFee} currency={currency} tone="danger" />
            <Metric label={t('account.wallet.estimatedPayout')} value={estimatedNetPayout} currency={currency} tone="success" />
            <Metric label={t('account.wallet.payoutRequests')} value={pendingPayoutRequests} currency={currency} tone="time" />
            <Metric label={t('account.payouts.paidOut')} value={paidOut} currency={currency} tone="info" />
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Payouts')} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{t('account.payouts.title')}</AppText></Pressable>
        </AppCard>


        {providerBalances.length ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>{t('account.wallet.providerSnapshot')}</AppText>
                <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.wallet.providerSnapshotBody')}</AppText>
              </View>
              <SemanticBadge label={t('account.wallet.readOnly')} tone="info" />
            </View>
            <View style={styles.grid}>
              {providerBalances.map((balance) => (
                <Metric key={`${balance.providerAccountId ?? 'provider'}-${balance.currency}`} label={`${balance.currency.toUpperCase()} available`} value={balance.availableCents} currency={balance.currency} tone="info" />
              ))}
            </View>
          </AppCard>
        ) : null}

        {limits ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>{t('account.wallet.launchLimits')}</AppText>
                <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.wallet.launchLimitsBody')}</AppText>
              </View>
              <SemanticBadge label={t('account.wallet.safety')} tone="time" />
            </View>
            <View style={styles.grid}>
              <Metric label={t('account.wallet.walletCap')} value={limits.walletBalanceCapCents} currency={currency} tone="credits" />
              <Metric label={t('account.wallet.perMoneyTrade')} value={limits.perTradeMoneyCapCents} currency={currency} tone="info" />
              <Metric label={t('account.payouts.weeklyPayoutCap')} value={limits.weeklyPayoutCapCents} currency={currency} tone="time" />
              <Metric label={t('account.payouts.minimumPayout')} value={limits.minimumPayoutCents} currency={currency} tone="info" />
            </View>
          </AppCard>
        ) : null}

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.wallet.moneyRules')}</AppText>
          <View style={styles.steps}>
            <Step theme={theme} number="1" text={t('account.wallet.availableBody')} />
            <Step theme={theme} number="2" text={t('account.wallet.heldBody')} />
            <Step theme={theme} number="3" text={t('account.wallet.moneyRulesBody', { rate: formatPayoutFeeRate(platformFeeRateBps) })} />
          </View>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.wallet.walletActivity')}</AppText>
          {recentEntries.length === 0 ? <View style={[styles.emptyBox, { borderColor: theme.color.border }]}><AppText style={styles.emptyTitle}>{t('account.wallet.noActivityTitle')}</AppText><AppText style={[styles.emptyText, { color: theme.color.muted }]}>{t('account.wallet.noActivityBody')}</AppText></View> : recentEntries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
        </AppCard>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function Metric({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: SemanticColorName }) {
  const theme = useThemeTokens();
  const { language } = useTranslation();
  return <View style={[styles.metric, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.metricValue}>{formatMoney(value, currency, language)}</AppText></View>;
}

function Step({ theme, number, text }: { theme: ThemeTokens; number: string; text: string }) { return <View style={styles.stepRow}><View style={[styles.stepNumber, { backgroundColor: theme.semantic.proposal.softBg }]}><AppText style={[styles.stepNumberText, { color: theme.semantic.proposal.text }]}>{number}</AppText></View><AppText style={[styles.stepText, { color: theme.color.muted }]}>{text}</AppText></View>; }

function LedgerRow({ entry }: { entry: LedgerEntryDto }) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const translationKey = `account.ledger.${entry.type}`;
  const translatedType = t(translationKey);
  const typeLabel = translatedType === translationKey ? formatLedgerType(entry.type) : translatedType;
  return <View style={[styles.ledgerRow, { borderTopColor: theme.color.border }]}><View style={styles.ledgerCopy}><View style={styles.ledgerTitleRow}><SemanticBadge label={typeLabel} tone={ledgerTone(entry.type, entry.amountCents || entry.amount)} size="sm" /><AppText style={[styles.ledgerDate, { color: theme.color.muted }]}>{formatLocalizedShortDate(entry.createdAt, language, '')}</AppText></View><AppText style={[styles.ledgerDescription, { color: theme.color.muted }]}>{entry.description ?? entry.balanceType}</AppText></View><AppText style={[styles.ledgerAmount, (entry.amountCents || entry.amount) < 0 && styles.ledgerAmountNegative]}>{entryAmount(entry, language)}</AppText></View>;
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
