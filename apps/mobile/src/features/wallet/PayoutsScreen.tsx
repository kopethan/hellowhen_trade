import React, { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoneySafetyStatusDto, PayoutRequestDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { formatMoney } from '@hellowhen/shared';
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
  const auth = useAuth();
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
      setNotice({ tone: 'danger', title: 'Payouts unavailable', body: caughtError instanceof Error && caughtError.message === 'Confirm your password or authenticator code first.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError) });
      setWallet(null); setSummary(null); setPayouts([]);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!betaFeatures.payoutsVisible) {
    return (
      <AppFixedHeaderScreen header={<AppHeader title="Payouts" onBack={() => navigation.goBack()} />}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <InfoNotice tone="info" title="Payouts hidden for beta" body="Payouts and Stripe Connect flows are disabled for the first international beta while Hellowhen focuses on service and goods trades." />
        </ScrollView>
      </AppFixedHeaderScreen>
    );
  }

  const currency = summary?.currency ?? wallet?.currency ?? 'eur';
  const available = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const pending = summary?.pendingPayoutRequestsCents ?? 0;
  const paid = summary?.paidOutNetCents ?? summary?.paidOutCents ?? 0;
  const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);
  const selectedAmount = parseMoneyToCents(amountText);
  const selectedFee = calculatePayoutFeeCents(selectedAmount, platformFeeRateBps);
  const selectedNet = Math.max(0, selectedAmount - selectedFee);
  const availableFee = summary?.estimatedPlatformFeeCents ?? calculatePayoutFeeCents(available, platformFeeRateBps);
  const availableNet = summary?.estimatedNetPayoutCents ?? Math.max(0, available - availableFee);
  const payoutConnected = summary?.payoutAccount.status === 'connected';
  const stripeConnectConfigured = Boolean(summary?.stripeConnectConfigured);
  const usingStripeConnect = summary?.payoutAccount.provider === 'stripe_connect_test';
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
      setNotice({ tone: 'success', title: 'Policies accepted', body: 'Money safety policies were accepted for this launch version.' });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Could not accept policies', body: getFriendlyApiErrorMessage(caughtError) });
    } finally { setActionLoading(null); }
  }

  async function confirmFreshAuth() {
    if (!freshPassword.trim() && !freshCode.trim()) throw new Error('Confirm your password or authenticator code first.');
    await auth.reauthenticate({ password: freshPassword.trim() || undefined, code: freshCode.trim() || undefined });
  }

  async function connectDemoAccount() {
    setActionLoading('connect'); setNotice(null);
    try {
      await confirmFreshAuth();
      if (summary?.stripeConnectConfigured) {
        const result = await api.wallet.createStripeConnectAccountLink() as { url?: string };
        if (!result.url) throw new Error('Stripe did not return an onboarding link.');
        setFreshPassword(''); setFreshCode('');
        setNotice({ tone: 'success', title: 'Opening Stripe Connect', body: 'Complete the Stripe test onboarding in your browser, then return and pull to refresh.' });
        await Linking.openURL(result.url);
      } else {
        const result = await api.wallet.connectDemoPayoutAccount() as PayoutsResponse;
        setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []); setMoneySafety(result.summary?.moneySafety ?? null);
        setFreshPassword(''); setFreshCode('');
        setNotice({ tone: 'success', title: 'Stripe demo connected', body: 'Your demo payout account is ready. No real bank account was linked.' });
      }
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Could not connect payout account', body: caughtError instanceof Error && caughtError.message === 'Confirm your password or authenticator code first.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError) });
    } finally { setActionLoading(null); }
  }

  async function syncStripeConnect() {
    setActionLoading('connect'); setNotice(null);
    try {
      const result = await api.wallet.syncStripeConnect() as PayoutsResponse;
      setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []); setMoneySafety(result.summary?.moneySafety ?? null);
      setNotice({ tone: 'success', title: 'Stripe status synced', body: 'Payout verification status was refreshed from Stripe test mode.' });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Could not sync Stripe status', body: getFriendlyApiErrorMessage(caughtError) });
    } finally { setActionLoading(null); }
  }

  async function requestDemoPayout() {
    if (!canRequest) return;
    setActionLoading('payout'); setNotice(null);
    try {
      await confirmFreshAuth();
      const result = await api.wallet.requestDemoPayout({ amountCents: selectedAmount, currency }) as PayoutsResponse;
      setWallet(result.wallet); setSummary(result.summary); setPayouts(result.payouts ?? []); setMoneySafety(result.summary?.moneySafety ?? null); setAmountText(''); setFreshPassword(''); setFreshCode('');
      setNotice({ tone: 'success', title: summary?.payoutAccount.provider === 'stripe_connect_test' ? 'Stripe Connect test payout requested' : 'Demo payout paid', body: `${formatMoney(selectedNet, currency)} was simulated after the ${formatMoney(selectedFee, currency)} platform fee.` });
    } catch (caughtError) {
      setNotice({ tone: 'danger', title: 'Could not request payout', body: caughtError instanceof Error && caughtError.message === 'Confirm your password or authenticator code first.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError, 'Check your payout balance and try again.') });
    } finally { setActionLoading(null); }
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Payouts" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.headerCopy}>
          <SemanticBadge label={stripeConnectConfigured ? "Stripe Connect test" : "Stripe demo"} tone="success" />
          <AppText style={styles.title}>Payouts</AppText>
          <AppText style={[styles.subtitle, { color: theme.color.muted }]}>See what you earned, the {formatPayoutFeeRate(platformFeeRateBps)} platform fee, and test payout setup before live money launch.</AppText>
        </View>

        {notice ? <InfoNotice tone={notice.tone} title={notice.title} body={notice.body} /> : null}

        {moneySafety ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>Money launch safety</AppText>
                <AppText style={[styles.cardText, { color: theme.color.muted }]}>{moneySafety.message}</AppText>
              </View>
              <SemanticBadge label={moneySafety.policyAcknowledged ? 'accepted' : 'review'} tone={moneySafety.policyAcknowledged ? 'success' : 'warning'} size="sm" />
            </View>
            <AppText style={[styles.validationText, { color: theme.color.muted }]}>Production money: {moneySafety.realMoneyEnabled ? 'on' : 'off'} · Stripe transfers: {moneySafety.stripeTransfersEnabled ? 'on' : 'off'} · Manual review: {moneySafety.requiresManualPayoutReview ? 'on' : 'off'}.</AppText>
            {!moneySafety.policyAcknowledged ? (
              <Pressable accessibilityRole="button" disabled={actionLoading !== null} onPress={() => { void acknowledgeSafety(); }} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border }, pressed && styles.pressed]}>
                <AppText style={styles.secondaryButtonText}>Accept wallet, payout, refund, and dispute policies</AppText>
              </Pressable>
            ) : <AppText style={[styles.validationText, { color: theme.color.muted }]}>Policy version {moneySafety.policyVersion} accepted.</AppText>}
          </AppCard>
        ) : null}

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
            <Metric theme={theme} label="Platform fee" value={availableFee} currency={currency} tone="danger" />
            <Metric theme={theme} label="Estimated payout" value={availableNet} currency={currency} tone="success" />
            <Metric theme={theme} label="Pending payouts" value={pending} currency={currency} tone="time" />
            <Metric theme={theme} label="Paid out" value={paid} currency={currency} tone="info" />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Fresh verification</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>Confirm your password or authenticator code before payout setup or payout requests. The safety window is short.</AppText>
            </View>
            <SemanticBadge label="10 min" tone="time" />
          </View>
          <TextInput value={freshPassword} onChangeText={setFreshPassword} secureTextEntry placeholder="Password" placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
          <TextInput value={freshCode} onChangeText={setFreshCode} keyboardType="number-pad" placeholder="Authenticator or recovery code" placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
        </AppCard>

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Stripe payout setup</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>{payoutConnected ? (usingStripeConnect ? 'Stripe Connect test account is ready.' : 'Demo payout account connected.') : (stripeConnectConfigured ? 'Complete Stripe Connect test onboarding before requesting payouts.' : 'Connect a simulated payout account before requesting payouts.')}</AppText>
            </View>
            <StatusBadge status={payoutConnected ? 'completed' : 'pending'} size="sm" />
          </View>
          {usingStripeConnect ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>Payouts {summary?.payoutAccount.payoutsEnabled ? 'enabled' : 'not enabled'} · Charges {summary?.payoutAccount.chargesEnabled ? 'enabled' : 'not enabled'}</AppText> : null}
          {usingStripeConnect && summary?.payoutAccount.currentlyDue?.length ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>Due now: {summary.payoutAccount.currentlyDue.join(', ')}</AppText> : null}
          <Pressable accessibilityRole="button" disabled={actionLoading === 'connect' || safetyBlocked} onPress={() => { void connectDemoAccount(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: payoutConnected ? theme.color.subtleSurface : theme.semantic.proposal.bg }, actionLoading === 'connect' && styles.disabled, pressed && styles.pressed]}>
            <AppText style={[styles.primaryButtonText, payoutConnected && { color: theme.color.muted }]}>{stripeConnectConfigured ? (payoutConnected ? 'Open onboarding again' : actionLoading === 'connect' ? 'Opening...' : 'Set up Stripe Connect test') : (payoutConnected ? 'Demo account connected' : actionLoading === 'connect' ? 'Connecting...' : 'Set up Stripe demo payout')}</AppText>
          </Pressable>
          {usingStripeConnect ? <Pressable accessibilityRole="button" disabled={actionLoading === 'connect'} onPress={() => { void syncStripeConnect(); }} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.secondaryButtonText}>Sync Stripe status</AppText></Pressable> : null}
        </AppCard>

        {limits ? (
          <AppCard>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionCopy}>
                <AppText style={styles.sectionTitle}>Launch limits</AppText>
                <AppText style={[styles.cardText, { color: theme.color.muted }]}>Current tier: {limits.effectiveTrustTier.replace(/_/g, ' ')}. Limits stay low during launch and can increase after verification.</AppText>
              </View>
              <SemanticBadge label="Safety" tone="time" />
            </View>
            <View style={styles.metricGrid}>
              <Metric theme={theme} label="Minimum payout" value={limits.minimumPayoutCents} currency={currency} tone="info" />
              <Metric theme={theme} label="Weekly cap" value={limits.weeklyPayoutCapCents} currency={currency} tone="time" />
              <Metric theme={theme} label="Weekly remaining" value={Math.max(0, limits.weeklyPayoutCapCents - limits.weeklyRequestedPayoutGrossCents)} currency={currency} tone="success" />
              <Metric theme={theme} label="Money trade cap" value={limits.perTradeMoneyCapCents} currency={currency} tone="info" />
            </View>
          </AppCard>
        ) : null}

        <AppCard>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <AppText style={styles.sectionTitle}>Payout fee</AppText>
              <AppText style={[styles.cardText, { color: theme.color.muted }]}>Hellowhen keeps a transparent {formatPayoutFeeRate(platformFeeRateBps)} platform fee from payout-eligible earnings. You receive the estimated payout amount.</AppText>
            </View>
            <SemanticBadge label={`${formatPayoutFeeRate(platformFeeRateBps)} fee`} tone="credits" />
          </View>
          <PayoutBreakdown grossAmountCents={available} currency={currency} platformFeeRateBps={platformFeeRateBps} />
        </AppCard>

        <AppCard>
          <AppText style={styles.sectionTitle}>{stripeConnectConfigured ? 'Request test payout' : 'Request demo payout'}</AppText>
          <AppText style={[styles.cardText, { color: theme.color.muted }]}>You can request up to {formatMoney(available, currency)} in payout-eligible earnings. This simulation marks the payout as paid instantly.</AppText>
          <View style={styles.presetRow}>{presetAmounts.map((amount) => <Pressable key={amount} accessibilityRole="button" onPress={() => setAmountText((amount / 100).toFixed(2))} style={({ pressed }) => [styles.presetButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}><AppText style={styles.presetText}>{formatMoney(amount, currency)}</AppText></Pressable>)}</View>
          <TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={theme.color.muted} style={[styles.amountInput, { color: theme.color.text, borderColor: theme.color.border, backgroundColor: theme.color.surface }]} />
          <PayoutBreakdown grossAmountCents={selectedAmount} currency={currency} platformFeeRateBps={platformFeeRateBps} />
          <AppText style={[styles.validationText, { color: theme.color.muted }]}>By requesting payout, you agree that Hellowhen keeps a {formatPayoutFeeRate(platformFeeRateBps)} platform fee from payout-eligible earnings. Estimated payout: {formatMoney(selectedNet, currency)}.</AppText>
          {selectedAmount > available ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>Amount is above your available payout balance.</AppText> : null}
          {!payoutConnected ? <AppText style={[styles.validationText, { color: theme.color.muted }]}>{stripeConnectConfigured ? 'Complete Stripe Connect test onboarding first.' : 'Connect the Stripe demo payout account first.'}</AppText> : null}
          {limits && !limits.payoutsEnabled ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>Payouts are disabled for your current trust tier.</AppText> : null}
          {limits && selectedAmount > 0 && selectedAmount < minimumPayoutCents ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>Minimum payout is {formatMoney(minimumPayoutCents, currency)}.</AppText> : null}
          {safetyBlocked ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>Accept the current money safety policies before requesting payout.</AppText> : null}
          {weeklyRemainingCents !== null && selectedAmount > weeklyRemainingCents ? <AppText style={[styles.validationText, { color: theme.semantic.danger.text }]}>This amount is above your remaining weekly payout limit.</AppText> : null}
          <Pressable accessibilityRole="button" disabled={!canRequest || actionLoading === 'payout'} onPress={() => { void requestDemoPayout(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.semantic.success.bg }, (!canRequest || actionLoading === 'payout') && styles.disabled, pressed && canRequest && styles.pressed]}>
            <AppText style={styles.primaryButtonText}>{actionLoading === 'payout' ? 'Sending...' : (stripeConnectConfigured ? 'Request test payout' : 'Request demo payout')}</AppText>
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

function Metric({ theme, label, value, currency, tone }: { theme: ThemeTokens; label: string; value: number; currency: string; tone: 'success' | 'time' | 'info' | 'danger' }) {
  return <View style={[styles.metricBox, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}><SemanticBadge label={label} tone={tone} size="sm" /><AppText style={styles.metricValue}>{formatMoney(value, currency)}</AppText></View>;
}

function PayoutBreakdown({ grossAmountCents, currency, platformFeeRateBps }: { grossAmountCents: number; currency: string; platformFeeRateBps: number }) {
  const theme = useThemeTokens();
  const feeCents = calculatePayoutFeeCents(grossAmountCents, platformFeeRateBps);
  const netCents = Math.max(0, grossAmountCents - feeCents);
  return (
    <View style={[styles.breakdownBox, { borderColor: theme.color.border, backgroundColor: theme.color.subtleSurface }]}>
      <BreakdownRow label="Payout-eligible earnings" value={formatMoney(grossAmountCents, currency)} />
      <BreakdownRow label={`Platform fee, ${formatPayoutFeeRate(platformFeeRateBps)}`} value={`-${formatMoney(feeCents, currency)}`} danger />
      <BreakdownRow label="Estimated payout" value={formatMoney(netCents, currency)} total />
    </View>
  );
}

function BreakdownRow({ label, value, danger, total }: { label: string; value: string; danger?: boolean; total?: boolean }) {
  const theme = useThemeTokens();
  return <View style={[styles.breakdownRow, { borderTopColor: theme.color.border }, total && { backgroundColor: theme.color.surface }]}><AppText style={[styles.breakdownLabel, { color: total ? theme.color.text : theme.color.muted }]}>{label}</AppText><AppText style={[styles.breakdownValue, danger && { color: theme.semantic.danger.text }, total && styles.breakdownValueTotal]}>{value}</AppText></View>;
}

function PayoutRow({ payout, theme }: { payout: PayoutRequestDto; theme: ThemeTokens }) {
  const grossCents = getPayoutGrossCents(payout);
  const feeCents = getPayoutFeeCents(payout);
  const netCents = getPayoutNetCents(payout);
  return <View style={[styles.payoutRow, { borderTopColor: theme.color.border }]}><View style={styles.payoutCopy}><StatusBadge status={payout.status} size="sm" /><AppText style={styles.payoutTitle}>{formatMoney(netCents, payout.currency)}</AppText><AppText style={[styles.payoutNote, { color: theme.color.muted }]}>Gross {formatMoney(grossCents, payout.currency)} · fee {formatMoney(feeCents, payout.currency)}</AppText>{payout.notes ? <AppText style={[styles.payoutNote, { color: theme.color.muted }]}>{payout.notes}</AppText> : null}</View><AppText style={[styles.dateText, { color: theme.color.muted }]}>{formatDate(payout.paidAt ?? payout.requestedAt)}</AppText></View>;
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
