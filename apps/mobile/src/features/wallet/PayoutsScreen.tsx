import React, { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoneySafetyStatusDto, PayoutRequestDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { formatLocalizedMoney, formatLocalizedShortDate } from '@hellowhen/i18n';
import type { SupportedLanguage } from '@hellowhen/i18n';
import type { ThemeTokens } from '@hellowhen/theme';
import { AppCard } from '../../components/AppCard';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { InfoNotice, SemanticBadge, StatusBadge } from '../../components/SemanticUI';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Payouts'>;
type PayoutsResponse = { wallet: WalletDto; payouts: PayoutRequestDto[]; summary: PayoutSummaryDto };

const presetAmounts = [500, 1000, 2500];
const defaultPayoutPlatformFeeRateBps = 1000;

function normalizePayoutFeeRateBps(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultPayoutPlatformFeeRateBps;
  return Math.min(Math.max(Math.trunc(value), 0), 5000);
}

function calculatePayoutFeeCents(grossAmountCents: number, platformFeeRateBps = defaultPayoutPlatformFeeRateBps) {
  const gross = Math.max(0, Math.trunc(grossAmountCents || 0));
  const rate = normalizePayoutFeeRateBps(platformFeeRateBps);
  if (gross <= 0 || rate <= 0) return 0;
  return Math.min(gross, Math.round((gross * rate) / 10000));
}

function formatPayoutFeeRate(platformFeeRateBps = defaultPayoutPlatformFeeRateBps) {
  const rate = normalizePayoutFeeRateBps(platformFeeRateBps);
  return `${Number((rate / 100).toFixed(2))}%`;
}

function getPayoutGrossCents(payout: PayoutRequestDto) {
  return payout.grossAmountCents && payout.grossAmountCents > 0 ? payout.grossAmountCents : payout.amountCents;
}

function getPayoutFeeCents(payout: PayoutRequestDto, fallbackRateBps = defaultPayoutPlatformFeeRateBps) {
  if (typeof payout.platformFeeCents === 'number' && (payout.platformFeeCents > 0 || (payout.netAmountCents ?? 0) > 0)) return payout.platformFeeCents;
  return calculatePayoutFeeCents(getPayoutGrossCents(payout), payout.platformFeeRateBps ?? fallbackRateBps);
}

function getPayoutNetCents(payout: PayoutRequestDto, fallbackRateBps = defaultPayoutPlatformFeeRateBps) {
  if (payout.netAmountCents && payout.netAmountCents > 0) return payout.netAmountCents;
  return Math.max(0, getPayoutGrossCents(payout) - getPayoutFeeCents(payout, fallbackRateBps));
}

function parseMoneyToCents(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  return (Number.parseInt(whole || '0', 10) * 100) + Number.parseInt(fraction.padEnd(2, '0').slice(0, 2) || '0', 10);
}

function money(value: number, currency: string, language: SupportedLanguage) {
  return formatLocalizedMoney(value, currency, language);
}

export function PayoutsScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t, language } = useTranslation();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequestDto[]>([]);
  const [moneySafety, setMoneySafety] = useState<MoneySafetyStatusDto | null>(null);
  const [amountText, setAmountText] = useState('');
  const [freshPassword, setFreshPassword] = useState('');
  const [freshCode, setFreshCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'connect' | 'payout' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; title: string; body: string } | null>(null);

  const freshRequiredMessage = t('account.payouts.freshRequired');
  const isFreshAuthError = useCallback((error: unknown) => error instanceof Error && (error.message === freshRequiredMessage || error.message === 'Confirm your password or authenticator code first.'), [freshRequiredMessage]);

  const load = useCallback(async () => {
    if (!betaFeatures.payoutsVisible) { setWallet(null); setSummary(null); setPayouts([]); setMoneySafety(null); return; }
    setLoading(true);
    setNotice(null);
    try {
      const result = await api.wallet.payouts() as PayoutsResponse;
      setWallet(result.wallet);
      setSummary(result.summary);
      setPayouts(result.payouts ?? []);
      setMoneySafety(result.summary?.moneySafety ?? null);
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: t('account.payouts.title'), body: isFreshAuthError(caughtError) ? freshRequiredMessage : getFriendlyApiErrorMessage(caughtError) });
      setWallet(null); setSummary(null); setPayouts([]);
    } finally { setLoading(false); }
  }, [freshRequiredMessage, isFreshAuthError, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!betaFeatures.payoutsVisible) {
    return (
      <AppFixedHeaderScreen header={<AppHeader title={t('account.payouts.title')} onBack={() => navigation.goBack()} />}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <InfoNotice tone="info" title={t('account.payouts.title')} body={t('account.payouts.signedOutBody')} />
        </ScrollView>
      </AppFixedHeaderScreen>
    );
  }

  const currency = summary?.currency ?? wallet?.currency ?? 'eur';
  const available = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const pending = summary?.pendingPayoutRequestsCents ?? 0;
  const paid = summary?.paidOutNetCents ?? summary?.paidOutCents ?? 0;
  const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);
  const rate = formatPayoutFeeRate(platformFeeRateBps);
  const selectedAmount = parseMoneyToCents(amountText);
  const selectedFee = calculatePayoutFeeCents(selectedAmount, platformFeeRateBps);
  const selectedNet = Math.max(0, selectedAmount - selectedFee);
  const availableFee = summary?.estimatedPlatformFeeCents ?? calculatePayoutFeeCents(available, platformFeeRateBps);
  const availableNet = summary?.estimatedNetPayoutCents ?? Math.max(0, available - availableFee);
  const payoutConnected = summary?.payoutAccount?.status === 'connected';
  const stripeConnectConfigured = Boolean(summary?.stripeConnectConfigured);
  const usingStripeConnect = summary?.payoutAccount?.provider === 'stripe_connect_test';
  const stripeConnectAccount = summary?.payoutAccount?.provider === 'stripe_connect_test' ? summary.payoutAccount : null;
  const limits = summary?.limits as WalletLimitsDto | undefined;
  const minimumPayoutCents = limits?.minimumPayoutCents ?? 1000;
  const weeklyRemainingCents = limits ? Math.max(0, limits.weeklyPayoutCapCents - limits.weeklyRequestedPayoutGrossCents) : null;
  const limitBlocked = Boolean(limits && (!limits.payoutsEnabled || selectedAmount < minimumPayoutCents || (weeklyRemainingCents !== null && selectedAmount > weeklyRemainingCents)));
  const safetyBlocked = Boolean(moneySafety && (moneySafety.launchMode === 'disabled' || !moneySafety.privateBetaAllowed || (moneySafety.policyAcknowledgementRequired && !moneySafety.policyAcknowledged)));
  const canRequest = payoutConnected && selectedAmount > 0 && selectedAmount <= available && selectedNet > 0 && !limitBlocked && !safetyBlocked;

  async function acknowledgeSafety() {
    setActionLoading('payout'); setNotice(null);
    try {
      const result = await api.wallet.acknowledgeMoneySafety({ accepted: true }) as { moneySafety: MoneySafetyStatusDto };
      setMoneySafety(result.moneySafety ?? null);
      setNotice({ tone: 'success', title: t('account.addMoney.safetyAccepted'), body: t('account.addMoney.policyAcknowledged') });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: t('account.addMoney.safetyReview'), body: getFriendlyApiErrorMessage(caughtError) });
    } finally { setActionLoading(null); }
  }

  async function confirmFreshAuth() {
    if (!freshPassword.trim() && !freshCode.trim()) throw new Error(freshRequiredMessage);
    await auth.reauthenticate({ password: freshPassword.trim() || undefined, code: freshCode.trim() || undefined });
  }

  async function connectDemoAccount() {
    setActionLoading('connect'); setNotice(null);
    try {
      await confirmFreshAuth();
      if (summary?.stripeConnectConfigured) {
        const result = await api.wallet.createStripeConnectAccountLink() as { url?: string };
        if (!result.url) throw new Error(t('account.payouts.stripeMissingLink'));
        setFreshPassword(''); setFreshCode('');
        setNotice({ tone: 'success', title: t('account.payouts.setupStripe'), body: t('account.payouts.stripeBody') });
        await Linking.openURL(result.url);
      } else {
        const result = await api.wallet.connectDemoPayoutAccount() as PayoutsResponse;
        setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []); setMoneySafety(result.summary?.moneySafety ?? null);
        setFreshPassword(''); setFreshCode('');
        setNotice({ tone: 'success', title: t('account.payouts.demoConnected'), body: t('account.payouts.demoConnectedMessage') });
      }
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: t('account.payouts.setup'), body: isFreshAuthError(caughtError) ? freshRequiredMessage : getFriendlyApiErrorMessage(caughtError) });
    } finally { setActionLoading(null); }
  }

  async function syncStripeConnect() {
    setActionLoading('connect'); setNotice(null);
    try {
      const result = await api.wallet.syncStripeConnect() as PayoutsResponse;
      setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []); setMoneySafety(result.summary?.moneySafety ?? null);
      setNotice({ tone: 'success', title: t('account.payouts.syncStatus'), body: t('account.payouts.stripeSynced') });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: t('account.payouts.syncStatus'), body: getFriendlyApiErrorMessage(caughtError) });
    } finally { setActionLoading(null); }
  }

  async function requestDemoPayout() {
    if (!canRequest) return;
    setActionLoading('payout'); setNotice(null);
    try {
      await confirmFreshAuth();
      const result = await api.wallet.requestDemoPayout({ amountCents: selectedAmount, currency }) as PayoutsResponse;
      setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []); setMoneySafety(result.summary?.moneySafety ?? null); setAmountText(''); setFreshPassword(''); setFreshCode('');
      const kind = summary?.payoutAccount?.provider === 'stripe_connect_test' ? t('account.payouts.stripePayoutKind') : t('account.payouts.demoPayoutKind');
      setNotice({ tone: 'success', title: kind, body: t('account.payouts.payoutRequested', { kind, net: money(selectedNet, currency, language), fee: money(selectedFee, currency, language) }) });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: t('account.payouts.requestDemoPayout'), body: isFreshAuthError(caughtError) ? freshRequiredMessage : getFriendlyApiErrorMessage(caughtError, t('common.actions.tryAgain')) });
    } finally { setActionLoading(null); }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title={t('account.payouts.title')} onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.headerCopy}>
          <SemanticBadge label={stripeConnectConfigured ? 'Stripe Connect test' : 'Stripe demo'} tone="success" />
          <AppText style={styles.title}>{t('account.payouts.title')}</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>{t('account.payouts.availableEarningsBody', { rate })}</AppText>
        </View>

        {notice ? <InfoNotice tone={notice.tone} title={notice.title} body={notice.body} /> : null}

        {moneySafety ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>{t('account.payouts.safetyTitle')}</AppText>
                <AppText style={[styles.cardText, { color: theme.color.muted }]}>{moneySafety.message}</AppText>
              </View>
              <SemanticBadge label={moneySafety.policyAcknowledged ? t('common.states.accepted') : t('common.states.review')} tone={moneySafety.policyAcknowledged ? 'success' : 'warning'} size="sm" />
            </View>
            <AppText style={[styles.validationText, { color: theme.color.muted }]}>{t('account.payouts.productionMoney')}: {moneySafety.realMoneyEnabled ? t('common.states.yes') : t('common.states.no')} · {t('account.payouts.stripeTransfers')}: {moneySafety.stripeTransfersEnabled ? t('common.states.yes') : t('common.states.no')} · {t('account.payouts.manualReview')}: {moneySafety.requiresManualPayoutReview ? t('common.states.yes') : t('common.states.no')}.</AppText>
            {!moneySafety.policyAcknowledged ? (
              <Pressable accessibilityRole="button" disabled={actionLoading !== null} onPress={() => { void acknowledgeSafety(); }} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={styles.secondaryButtonText}>{t('account.addMoney.acceptPolicies')}</AppText>
              </Pressable>
            ) : <AppText style={[styles.validationText, { color: theme.color.muted }]}>{t('account.addMoney.policyAccepted', { version: moneySafety.policyVersion })}</AppText>}
          </AppCard>
        ) : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.wallet.earnings')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.payouts.availableEarningsBody', { rate })}</AppText>
            </View>
            <SemanticBadge label={currency.toUpperCase()} tone="credits" />
          </View>
          <View style={styles.metricGrid}>
            <Metric theme={theme} label={t('account.wallet.available')} value={available} currency={currency} tone="success" />
            <Metric theme={theme} label={t('account.wallet.platformFee')} value={availableFee} currency={currency} tone="danger" />
            <Metric theme={theme} label={t('account.wallet.estimatedPayout')} value={availableNet} currency={currency} tone="success" />
            <Metric theme={theme} label={t('account.wallet.payoutRequests')} value={pending} currency={currency} tone="time" />
            <Metric theme={theme} label={t('account.payouts.paidOut')} value={paid} currency={currency} tone="info" />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.payouts.freshVerification')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.payouts.freshBody')}</AppText>
            </View>
            <SemanticBadge label={t('account.payouts.freshWindow')} tone="time" />
          </View>
          <TextInput value={freshPassword} onChangeText={setFreshPassword} secureTextEntry placeholder={t('account.payouts.password')} placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
          <TextInput value={freshCode} onChangeText={setFreshCode} keyboardType="number-pad" placeholder={t('account.payouts.authenticatorCode')} placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.payouts.setup')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{payoutConnected ? (usingStripeConnect ? t('account.payouts.stripeReady') : t('account.payouts.demoConnected')) : (stripeConnectConfigured ? t('account.payouts.stripeBody') : t('account.payouts.demoBody'))}</AppText>
            </View>
            <StatusBadge status={payoutConnected ? 'completed' : 'pending'} size="sm" />
          </View>
          {stripeConnectAccount ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>{t('account.payouts.payouts')} {stripeConnectAccount.payoutsEnabled ? t('account.payouts.enabled') : t('account.payouts.notEnabled')} · {t('account.payouts.charges')} {stripeConnectAccount.chargesEnabled ? t('account.payouts.enabled') : t('account.payouts.notEnabled')}</AppText> : null}
          {stripeConnectAccount?.currentlyDue?.length ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.payouts.dueNow', { items: stripeConnectAccount.currentlyDue.join(', ') })}</AppText> : null}
          <Pressable accessibilityRole="button" disabled={actionLoading === 'connect' || safetyBlocked} onPress={() => { void connectDemoAccount(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: payoutConnected ? theme.color.subtleSurface : theme.semantic.proposal.bg }, actionLoading === 'connect' && styles.disabled, pressed && styles.pressed]}>
            <AppText style={[styles.primaryButtonText, payoutConnected && { color: theme.color.muted }]}>{stripeConnectConfigured ? (payoutConnected ? t('account.payouts.openOnboardingAgain') : actionLoading === 'connect' ? t('common.states.working') : t('account.payouts.startStripeTest')) : (payoutConnected ? t('account.payouts.alreadyConnected') : actionLoading === 'connect' ? t('common.states.working') : t('account.payouts.connectDemo'))}</AppText>
          </Pressable>
          {usingStripeConnect ? <Pressable accessibilityRole="button" disabled={actionLoading === 'connect'} onPress={() => { void syncStripeConnect(); }} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.secondaryButtonText}>{t('account.payouts.syncStatus')}</AppText></Pressable> : null}
        </AppCard>

        {limits ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>{t('account.payouts.launchLimits')}</AppText>
                <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.payouts.launchLimitsBody')}</AppText>
              </View>
              <SemanticBadge label={t('account.wallet.safety')} tone="time" />
            </View>
            <View style={styles.metricGrid}>
              <Metric theme={theme} label={t('account.payouts.minimumPayout')} value={limits.minimumPayoutCents} currency={currency} tone="info" />
              <Metric theme={theme} label={t('account.payouts.weeklyPayoutCap')} value={limits.weeklyPayoutCapCents} currency={currency} tone="time" />
              <Metric theme={theme} label={t('account.payouts.weeklyRemaining')} value={Math.max(0, limits.weeklyPayoutCapCents - limits.weeklyRequestedPayoutGrossCents)} currency={currency} tone="success" />
              <Metric theme={theme} label={t('account.wallet.perMoneyTrade')} value={limits.perTradeMoneyCapCents} currency={currency} tone="info" />
            </View>
          </AppCard>
        ) : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>{t('account.payouts.payoutFee')}</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.payouts.feeBody')}</AppText>
            </View>
            <SemanticBadge label={t('account.payouts.feeBadge', { rate })} tone="credits" />
          </View>
          <PayoutBreakdown grossAmountCents={available} currency={currency} platformFeeRateBps={platformFeeRateBps} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{stripeConnectConfigured ? t('account.payouts.requestTestPayout') : t('account.payouts.requestDemoPayout')}</AppText>
          <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.payouts.withdrawLabel')}: {money(available, currency, language)}</AppText>
          <View style={styles.presetRow}>{presetAmounts.map((amount) => <Pressable key={amount} accessibilityRole="button" onPress={() => setAmountText((amount / 100).toFixed(2))} style={({ pressed }) => [styles.presetButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.presetText}>{money(amount, currency, language)}</AppText></Pressable>)}</View>
          <TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder={t('account.addMoney.amount')} placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
          <PayoutBreakdown grossAmountCents={selectedAmount} currency={currency} platformFeeRateBps={platformFeeRateBps} />
          <AppText style={[styles.validationText, { color: theme.color.muted }]}>{t('account.payouts.payoutAgreement', { rate, amount: money(selectedNet, currency, language) })}</AppText>
          {selectedAmount > available ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.payouts.aboveAvailable')}</AppText> : null}
          {!payoutConnected ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>{stripeConnectConfigured ? t('account.payouts.connectFirstStripe') : t('account.payouts.connectFirstDemo')}</AppText> : null}
          {limits && !limits.payoutsEnabled ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.payouts.disabledForTier')}</AppText> : null}
          {limits && selectedAmount > 0 && selectedAmount < minimumPayoutCents ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.payouts.minimumIs', { amount: money(minimumPayoutCents, currency, language) })}</AppText> : null}
          {safetyBlocked ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.payouts.safetyBlocked')}</AppText> : null}
          {weeklyRemainingCents !== null && selectedAmount > weeklyRemainingCents ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>{t('account.payouts.aboveWeekly')}</AppText> : null}
          <Pressable accessibilityRole="button" disabled={!canRequest || actionLoading === 'payout'} onPress={() => { void requestDemoPayout(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.success.bg }, (!canRequest || actionLoading === 'payout') && styles.disabled, pressed && canRequest && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{actionLoading === 'payout' ? t('account.payouts.requesting') : (stripeConnectConfigured ? t('account.payouts.requestTestPayout') : t('account.payouts.requestDemoPayout'))}</AppText>
          </Pressable>
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{t('account.payouts.history')}</AppText>
          {payouts.length === 0 ? <AppText style={[styles.cardText, { color: theme.color.muted }]}>{t('account.payouts.noPayouts')}</AppText> : payouts.map((payout) => <PayoutRow key={payout.id} payout={payout} theme={theme} />)}
        </AppCard>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

function Metric({ theme, label, value, currency, tone }: { theme: ThemeTokens; label: string; value: number; currency: string; tone: 'success' | 'time' | 'info' | 'danger' }) {
  const { language } = useTranslation();
  return <View style={[styles.metricBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.metricValue}>{money(value, currency, language)}</AppText></View>;
}

function PayoutBreakdown({ grossAmountCents, currency, platformFeeRateBps }: { grossAmountCents: number; currency: string; platformFeeRateBps: number }) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const rate = formatPayoutFeeRate(platformFeeRateBps);
  const feeCents = calculatePayoutFeeCents(grossAmountCents, platformFeeRateBps);
  const netCents = Math.max(0, grossAmountCents - feeCents);
  return (
    <View style={[styles.breakdownBox, { borderColor: theme.color.border, backgroundColor: theme.color.subtleSurface }]}>
      <BreakdownRow label={t('account.payouts.gross')} value={money(grossAmountCents, currency, language)} />
      <BreakdownRow label={t('account.payouts.platformFeeWithRate', { rate })} value={`-${money(feeCents, currency, language)}`} danger />
      <BreakdownRow label={t('account.payouts.estimatedPayout')} value={money(netCents, currency, language)} total />
    </View>
  );
}

function BreakdownRow({ label, value, danger, total }: { label: string; value: string; danger?: boolean; total?: boolean }) {
  const theme = useThemeTokens();
  return <View style={[styles.breakdownRow, { borderTopColor: theme.color.border }, total && { backgroundColor: theme.color.surface }]}><AppText style={[styles.breakdownLabel, { color: total ? theme.color.text : theme.color.muted }]}>{label}</AppText><AppText style={[styles.breakdownValue, danger && { color: theme.semantic.danger.text }, total && styles.breakdownValueTotal]}>{value}</AppText></View>;
}

function PayoutRow({ payout, theme }: { payout: PayoutRequestDto; theme: ThemeTokens }) {
  const { t, language } = useTranslation();
  const grossCents = getPayoutGrossCents(payout);
  const feeCents = getPayoutFeeCents(payout);
  const netCents = getPayoutNetCents(payout);
  return <View style={[styles.payoutRow, { borderTopColor: theme.color.border }]}><View style={styles.payoutCopy}><StatusBadge status={payout.status} size="sm" /><AppText style={styles.payoutTitle}>{money(netCents, payout.currency, language)}</AppText><AppText style={[styles.payoutNote, { color: theme.color.muted }]}>{t('account.payouts.grossFee', { gross: money(grossCents, payout.currency, language), fee: money(feeCents, payout.currency, language) })}</AppText>{payout.notes ? <AppText style={[styles.payoutNote, { color: theme.color.muted }]}>{payout.notes}</AppText> : null}</View><AppText style={[styles.dateText, { color: theme.color.muted }]}>{formatLocalizedShortDate(payout.paidAt ?? payout.requestedAt, language, '')}</AppText></View>;
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
  secondaryButton: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { fontWeight: '900' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  presetText: { fontWeight: '900' },
  amountInput: { minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, fontSize: 18, fontWeight: '900' },
  validationText: { fontWeight: '800', lineHeight: 19 },
  breakdownBox: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingHorizontal: 13, paddingVertical: 11 },
  breakdownLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
  breakdownValue: { fontWeight: '900' },
  breakdownValueTotal: { fontSize: 18 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 12 },
  payoutCopy: { flex: 1, gap: 6 },
  payoutTitle: { fontSize: 18, fontWeight: '900' },
  payoutNote: { lineHeight: 18, fontWeight: '600' },
  dateText: { fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
