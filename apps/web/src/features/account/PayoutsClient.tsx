'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MoneySafetyStatusDto, PayoutRequestDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { calculatePayoutFeeCents, fallbackCurrency, formatDateTime, formatLimitCount, formatMoney, formatPayoutFeeRate, getPayoutFeeCents, getPayoutGrossCents, getPayoutNetCents, moneyLaunchModeLabel, moneySafetyMessage, normalizePayoutFeeRateBps, normalizePayouts, parseMoneyInputToCents, payoutStatusLabel, trustTierLabel } from './accountPresentation';

type T = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function PayoutFeeBreakdown({ grossAmountCents, currency, platformFeeRateBps, language, t }: { grossAmountCents: number; currency: string; platformFeeRateBps: number; language: 'en' | 'fr'; t: T }) {
  const feeCents = calculatePayoutFeeCents(grossAmountCents, platformFeeRateBps);
  const netCents = Math.max(0, grossAmountCents - feeCents);
  const rate = formatPayoutFeeRate(platformFeeRateBps);
  return (
    <div className="payout-fee-box">
      <div className="payout-fee-row">
        <span>{t('account.payouts.gross')}</span>
        <strong>{formatMoney(grossAmountCents, currency, language)}</strong>
      </div>
      <div className="payout-fee-row danger">
        <span>{t('account.payouts.platformFeeWithRate', { rate })}</span>
        <strong>-{formatMoney(feeCents, currency, language)}</strong>
      </div>
      <div className="payout-fee-row total">
        <span>{t('account.payouts.estimatedPayout')}</span>
        <strong>{formatMoney(netCents, currency, language)}</strong>
      </div>
    </div>
  );
}

function PayoutHistoryRow({ payout, platformFeeRateBps, language, t }: { payout: PayoutRequestDto; platformFeeRateBps: number; language: 'en' | 'fr'; t: T }) {
  const grossCents = getPayoutGrossCents(payout);
  const feeCents = getPayoutFeeCents(payout, platformFeeRateBps);
  const netCents = getPayoutNetCents(payout, platformFeeRateBps);
  return (
    <div className="wallet-ledger-row" key={payout.id}>
      <span>
        <strong>{payoutStatusLabel(payout.status, t)}</strong>
        <small>{payout.notes || formatDateTime(payout.requestedAt, language)}</small>
        <small>{t('account.payouts.grossFee', { gross: formatMoney(grossCents, payout.currency, language), fee: formatMoney(feeCents, payout.currency, language) })}</small>
      </span>
      <em>{formatMoney(netCents, payout.currency, language)}</em>
    </div>
  );
}

export function PayoutsClient() {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequestDto[]>([]);
  const [limits, setLimits] = useState<WalletLimitsDto | null>(null);
  const [moneySafety, setMoneySafety] = useState<MoneySafetyStatusDto | null>(null);
  const [amount, setAmount] = useState('');
  const [freshPassword, setFreshPassword] = useState('');
  const [freshCode, setFreshCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadPayouts() {
    if (!auth.hydrated) return;
    if (!auth.isAuthenticated) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const response = await api.wallet.payouts();
      const data = normalizePayouts(response);
      setWallet(data.wallet); setPayouts(data.payouts); setSummary(data.summary); setLimits(data.summary?.limits ?? null); setMoneySafety(data.summary?.moneySafety ?? null);
      setAmount(data.summary?.availableForPayoutCents ? String((data.summary.availableForPayoutCents / 100).toFixed(2)) : '');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === t('account.payouts.freshRequired') ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadPayouts(); }, [auth.hydrated, auth.isAuthenticated]);

  useEffect(() => {
    if (!auth.hydrated || !auth.isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_connect') !== 'return' && params.get('stripe_connect') !== 'refresh') return;
    void (async () => {
      try {
        const response = await api.wallet.syncStripeConnect();
        const data = normalizePayouts(response);
        setWallet(data.wallet); setPayouts(data.payouts); setSummary(data.summary); setLimits(data.summary?.limits ?? null); setMoneySafety(data.summary?.moneySafety ?? null);
        setMessage(params.get('stripe_connect') === 'return' ? t('account.payouts.stripeReturnSynced') : t('account.payouts.stripeRefreshSynced'));
        window.history.replaceState(null, '', window.location.pathname);
      } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    })();
  }, [auth.hydrated, auth.isAuthenticated, t]);

  async function acknowledgeSafety() {
    setSaving(true); setMessage(''); setError('');
    try {
      const response = await api.wallet.acknowledgeMoneySafety({ accepted: true }) as { moneySafety?: MoneySafetyStatusDto };
      setMoneySafety(response.moneySafety ?? null);
      setMessage(t('account.addMoney.policyAcknowledged'));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSaving(false); }
  }

  async function confirmFreshAuth() {
    if (!freshPassword.trim() && !freshCode.trim()) throw new Error(t('account.payouts.freshRequired'));
    await auth.reauthenticate({ password: freshPassword.trim() || undefined, code: freshCode.trim() || undefined });
  }

  async function connectStripeAccount() {
    setSaving(true); setMessage(''); setError('');
    try {
      await confirmFreshAuth();
      const response = await api.wallet.createStripeConnectAccountLink() as { url?: string };
      if (!response.url) throw new Error(t('account.payouts.stripeMissingLink'));
      setFreshPassword(''); setFreshCode(''); window.location.assign(response.url);
    } catch (caughtError) {
      setError(caughtError instanceof Error && (caughtError.message === t('account.payouts.freshRequired') || caughtError.message === t('account.payouts.stripeMissingLink')) ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
      setSaving(false);
    }
  }

  async function syncStripeConnect() {
    setSaving(true); setMessage(''); setError('');
    try {
      const response = await api.wallet.syncStripeConnect();
      const data = normalizePayouts(response);
      setWallet(data.wallet); setPayouts(data.payouts); setSummary(data.summary); setLimits(data.summary?.limits ?? null); setMoneySafety(data.summary?.moneySafety ?? null);
      setMessage(t('account.payouts.stripeSynced'));
    } catch (caughtError) { setError(getFriendlyApiErrorMessage(caughtError)); }
    finally { setSaving(false); }
  }

  async function connectDemoAccount() {
    setSaving(true); setMessage(''); setError('');
    try {
      await confirmFreshAuth();
      const response = await api.wallet.connectDemoPayoutAccount();
      const data = normalizePayouts(response);
      setWallet(data.wallet); setPayouts(data.payouts); setSummary(data.summary); setLimits(data.summary?.limits ?? null); setMoneySafety(data.summary?.moneySafety ?? null);
      setFreshPassword(''); setFreshCode(''); setMessage(t('account.payouts.demoConnectedMessage'));
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === t('account.payouts.freshRequired') ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally { setSaving(false); }
  }

  async function requestPayout() {
    setSaving(true); setMessage(''); setError('');
    try {
      const currency = summary?.currency ?? wallet?.currency ?? auth.user?.profile?.preferredCurrency ?? fallbackCurrency;
      const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);
      const amountCents = parseMoneyInputToCents(amount);
      if (amountCents < 100) throw new Error(t('account.addMoney.minAmount'));
      const feeCents = calculatePayoutFeeCents(amountCents, platformFeeRateBps);
      const netCents = Math.max(0, amountCents - feeCents);
      await confirmFreshAuth();
      const response = await api.wallet.requestDemoPayout({ amountCents, currency });
      const data = normalizePayouts(response);
      setWallet(data.wallet); setPayouts(data.payouts); setSummary(data.summary); setLimits(data.summary?.limits ?? null); setMoneySafety(data.summary?.moneySafety ?? null);
      setAmount(data.summary?.availableForPayoutCents ? String((data.summary.availableForPayoutCents / 100).toFixed(2)) : '');
      setFreshPassword(''); setFreshCode('');
      setMessage(t('account.payouts.payoutRequested', { kind: summary?.payoutAccount?.provider === 'stripe_connect_test' ? t('account.payouts.stripePayoutKind') : t('account.payouts.demoPayoutKind'), net: formatMoney(netCents, currency, language), fee: formatMoney(feeCents, currency, language) }));
    } catch (caughtError) {
      setError(caughtError instanceof Error && (caughtError.message === t('account.addMoney.minAmount') || caughtError.message === t('account.payouts.freshRequired')) ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally { setSaving(false); }
  }

  if (!auth.hydrated || loading) return <section className="mobile-card mobile-card--soft"><p>{t('account.payouts.loading')}</p></section>;

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
        <h3>{t('account.payouts.signedOutTitle')}</h3>
        <p>{t('account.payouts.signedOutBody')}</p>
        <Link href="/auth" className="button primary full">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  const currency = summary?.currency ?? wallet?.currency ?? auth.user?.profile?.preferredCurrency ?? fallbackCurrency;
  const payoutAccount = summary?.payoutAccount;
  const connected = payoutAccount?.status === 'connected';
  const stripeConnectConfigured = Boolean(summary?.stripeConnectConfigured);
  const usingStripeConnect = payoutAccount?.provider === 'stripe_connect_test';
  const available = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);
  const feeRate = formatPayoutFeeRate(platformFeeRateBps);
  const selectedGrossCents = parseMoneyInputToCents(amount);
  const selectedFeeCents = calculatePayoutFeeCents(selectedGrossCents, platformFeeRateBps);
  const selectedNetCents = Math.max(0, selectedGrossCents - selectedFeeCents);
  const minimumPayoutCents = limits?.minimumPayoutCents ?? 1000;
  const weeklyRemainingCents = limits ? Math.max(0, limits.weeklyPayoutCapCents - limits.weeklyRequestedPayoutGrossCents) : null;
  const payoutBlockedByLimits = Boolean(limits && (!limits.payoutsEnabled || selectedGrossCents < minimumPayoutCents || (weeklyRemainingCents !== null && selectedGrossCents > weeklyRemainingCents)));
  const moneySafetyBlocked = Boolean(moneySafety && (moneySafety.launchMode === 'disabled' || !moneySafety.privateBetaAllowed || (moneySafety.policyAcknowledgementRequired && !moneySafety.policyAcknowledged)));
  const payoutButtonDisabled = saving || moneySafetyBlocked || !connected || available <= 0 || selectedGrossCents <= 0 || selectedGrossCents > available || payoutBlockedByLimits;

  return (
    <div className="wallet-page">
      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}

      <section className="wallet-hero-card"><div><span className="semantic-badge success">{t('account.availableEarnings')}</span><h2>{formatMoney(available, currency, language)}</h2><p>{t('account.payouts.availableEarningsBody', { rate: feeRate })}</p></div></section>

      {moneySafety ? <section className="mobile-card wallet-form-card"><div className="trade-section-heading"><div><p className="eyebrow">{t('account.payouts.safetyTitle')}</p><h3>{moneyLaunchModeLabel(moneySafety.launchMode, t)}</h3></div><span className={`semantic-badge ${moneySafety.policyAcknowledged ? 'success' : 'warning'}`}>{moneySafety.policyAcknowledged ? t('common.states.accepted') : t('common.states.review')}</span></div><p>{moneySafetyMessage(moneySafety, t)}</p><div className="wallet-limit-grid"><span><strong>{moneySafety.realMoneyEnabled ? t('common.states.yes') : t('common.states.no')}</strong><small>{t('account.payouts.productionMoney')}</small></span><span><strong>{moneySafety.stripeTransfersEnabled ? t('common.states.yes') : t('common.states.no')}</strong><small>{t('account.payouts.stripeTransfers')}</small></span><span><strong>{moneySafety.requiresManualPayoutReview ? t('common.states.yes') : t('common.states.no')}</strong><small>{t('account.payouts.manualReview')}</small></span><span><strong>{moneySafety.policyVersion}</strong><small>{t('account.payouts.policyVersion')}</small></span></div>{!moneySafety.policyAcknowledged ? <button type="button" className="secondary" onClick={() => { void acknowledgeSafety(); }} disabled={saving}>{t('account.addMoney.acceptPolicies')}</button> : <p className="meta">{t('account.addMoney.policyAcceptedAt', { date: formatDateTime(moneySafety.acknowledgedAt, language) })}</p>}</section> : null}

      {limits ? <section className="mobile-card wallet-form-card"><div className="trade-section-heading"><div><p className="eyebrow">{t('account.payouts.launchLimits')}</p><h3>{trustTierLabel(limits.effectiveTrustTier, t)}</h3></div><span className="semantic-badge instruction">{t('account.wallet.safety')}</span></div><div className="wallet-limit-grid"><span><strong>{formatMoney(limits.minimumPayoutCents, currency, language)}</strong><small>{t('account.payouts.minimumPayout')}</small></span><span><strong>{formatMoney(limits.weeklyPayoutCapCents, currency, language)}</strong><small>{t('account.payouts.weeklyPayoutCap')}</small></span><span><strong>{formatMoney(Math.max(0, limits.weeklyPayoutCapCents - limits.weeklyRequestedPayoutGrossCents), currency, language)}</strong><small>{t('account.payouts.weeklyRemaining')}</small></span><span><strong>{formatLimitCount(limits.activeMoneyTradeCount, limits.moneyActiveTradeLimit)}</strong><small>{t('account.wallet.activeMoneyTrades')}</small></span></div><p>{t('account.payouts.launchLimitsBody')}</p></section> : null}

      <section className="mobile-card wallet-form-card"><div className="trade-section-heading"><div><p className="eyebrow">{t('account.payouts.payoutFee')}</p><h3>{t('account.payouts.feePreview')}</h3></div><span className="semantic-badge money">{t('account.payouts.feeBadge', { rate: feeRate })}</span></div><p>{t('account.payouts.feeBody')}</p><PayoutFeeBreakdown grossAmountCents={available} currency={currency} platformFeeRateBps={platformFeeRateBps} language={language} t={t} /></section>

      <section className="mobile-card wallet-form-card"><div className="trade-section-heading"><div><p className="eyebrow">{t('account.payouts.freshVerification')}</p><h3>{t('account.payouts.confirmSensitive')}</h3></div><span className="semantic-badge instruction">{t('account.payouts.freshWindow')}</span></div><p>{t('account.payouts.freshBody')}</p><div className="form-stack"><label className="field-label">{t('account.payouts.password')}<input value={freshPassword} onChange={(event) => setFreshPassword(event.target.value)} type="password" autoComplete="current-password" placeholder={t('account.payouts.password')} /></label><label className="field-label">{t('account.payouts.authenticatorCode')}<input value={freshCode} onChange={(event) => setFreshCode(event.target.value)} inputMode="numeric" placeholder={t('account.payouts.optionalCode')} /></label></div></section>

      <section className="mobile-card wallet-form-card"><div className="trade-section-heading"><div><p className="eyebrow">{t('account.payouts.setup')}</p><h3>{connected ? (usingStripeConnect ? t('account.payouts.stripeReady') : t('account.payouts.demoConnected')) : (stripeConnectConfigured ? t('account.payouts.setupStripe') : t('account.payouts.connectDemo'))}</h3></div><span className={`semantic-badge ${connected ? 'success' : 'instruction'}`}>{connected ? t('common.states.connected') : t('common.states.required')}</span></div>{usingStripeConnect ? <div className="connect-status-list"><p>{t('account.payouts.stripeAccount')}: <strong>{payoutAccount.stripeAccountId}</strong></p><p>{t('account.payouts.charges')}: <strong>{payoutAccount.chargesEnabled ? t('account.payouts.enabled') : t('account.payouts.notEnabled')}</strong> · {t('account.payouts.payouts')}: <strong>{payoutAccount.payoutsEnabled ? t('account.payouts.enabled') : t('account.payouts.notEnabled')}</strong></p>{payoutAccount.currentlyDue?.length ? <p className="meta danger">{t('account.payouts.dueNow', { items: payoutAccount.currentlyDue.join(', ') })}</p> : null}{payoutAccount.disabledReason ? <p className="meta danger">{t('account.payouts.disabled', { reason: payoutAccount.disabledReason })}</p> : null}</div> : stripeConnectConfigured ? <p>{t('account.payouts.stripeBody')}</p> : <p>{t('account.payouts.demoBody')}</p>}<div className="wallet-action-row">{stripeConnectConfigured ? <button type="button" className="secondary" onClick={() => { void connectStripeAccount(); }} disabled={saving || moneySafetyBlocked}>{connected ? t('account.payouts.openOnboardingAgain') : t('account.payouts.startStripeTest')}</button> : <button type="button" className="secondary" onClick={() => { void connectDemoAccount(); }} disabled={saving || moneySafetyBlocked || connected}>{connected ? t('account.payouts.alreadyConnected') : t('account.payouts.connectDemo')}</button>}{usingStripeConnect ? <button type="button" className="ghost-button" onClick={() => { void syncStripeConnect(); }} disabled={saving}>{t('account.payouts.syncStatus')}</button> : null}</div></section>

      <section className="mobile-card wallet-form-card"><div className="form-stack"><label className="field-label">{t('account.payouts.withdrawLabel')}<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" /></label></div><PayoutFeeBreakdown grossAmountCents={selectedGrossCents} currency={currency} platformFeeRateBps={platformFeeRateBps} language={language} t={t} /><p className="meta">{t('account.payouts.payoutAgreement', { rate: feeRate, amount: formatMoney(selectedNetCents, currency, language) })}</p><button type="button" onClick={() => { void requestPayout(); }} disabled={payoutButtonDisabled}>{saving ? t('account.payouts.requesting') : (stripeConnectConfigured ? t('account.payouts.requestTestPayout') : t('account.payouts.requestDemoPayout'))}</button>{moneySafetyBlocked ? <p className="meta danger">{t('account.payouts.safetyBlocked')}</p> : null}{!connected ? <p className="meta">{stripeConnectConfigured ? t('account.payouts.connectFirstStripe') : t('account.payouts.connectFirstDemo')}</p> : null}{available <= 0 ? <p className="meta">{t('account.payouts.noEligible')}</p> : null}{selectedGrossCents > available ? <p className="meta danger">{t('account.payouts.aboveAvailable')}</p> : null}{limits && !limits.payoutsEnabled ? <p className="meta danger">{t('account.payouts.disabledForTier')}</p> : null}{limits && selectedGrossCents > 0 && selectedGrossCents < minimumPayoutCents ? <p className="meta danger">{t('account.payouts.minimumIs', { amount: formatMoney(minimumPayoutCents, currency, language) })}</p> : null}{weeklyRemainingCents !== null && selectedGrossCents > weeklyRemainingCents ? <p className="meta danger">{t('account.payouts.aboveWeekly')}</p> : null}</section>

      <section className="mobile-card wallet-ledger-card"><div className="trade-section-heading"><div><p className="eyebrow">{t('account.payouts.history')}</p><h3>{t('account.payouts.recent')}</h3></div><span className="semantic-badge money">{t('account.payouts.paid', { amount: formatMoney(summary?.paidOutNetCents ?? summary?.paidOutCents ?? 0, currency, language) })}</span></div>{payouts.length ? <div className="wallet-ledger-list">{payouts.map((payout) => <PayoutHistoryRow key={payout.id} payout={payout} platformFeeRateBps={platformFeeRateBps} language={language} t={t} />)}</div> : <div className="proposal-empty-state"><strong>{t('account.payouts.noPayouts')}</strong><span>{t('account.payouts.noPayoutsBody')}</span></div>}</section>
    </div>
  );
}
