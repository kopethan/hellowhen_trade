'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MoneySafetyStatusDto, PayoutRequestDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { calculatePayoutFeeCents, fallbackCurrency, formatDateTime, formatMoney, formatLimitCount, formatPayoutFeeRate, getPayoutFeeCents, getPayoutGrossCents, getPayoutNetCents, normalizePayoutFeeRateBps, normalizePayouts, parseMoneyInputToCents, payoutStatusLabel } from './accountPresentation';

function PayoutFeeBreakdown({ grossAmountCents, currency, platformFeeRateBps }: { grossAmountCents: number; currency: string; platformFeeRateBps: number }) {
  const feeCents = calculatePayoutFeeCents(grossAmountCents, platformFeeRateBps);
  const netCents = Math.max(0, grossAmountCents - feeCents);
  return (
    <div className="payout-fee-box">
      <div className="payout-fee-row">
        <span>Payout-eligible earnings</span>
        <strong>{formatMoney(grossAmountCents, currency)}</strong>
      </div>
      <div className="payout-fee-row danger">
        <span>Platform fee, {formatPayoutFeeRate(platformFeeRateBps)}</span>
        <strong>-{formatMoney(feeCents, currency)}</strong>
      </div>
      <div className="payout-fee-row total">
        <span>Estimated payout</span>
        <strong>{formatMoney(netCents, currency)}</strong>
      </div>
    </div>
  );
}

function PayoutHistoryRow({ payout, platformFeeRateBps }: { payout: PayoutRequestDto; platformFeeRateBps: number }) {
  const grossCents = getPayoutGrossCents(payout);
  const feeCents = getPayoutFeeCents(payout, platformFeeRateBps);
  const netCents = getPayoutNetCents(payout, platformFeeRateBps);
  return (
    <div className="wallet-ledger-row" key={payout.id}>
      <span>
        <strong>{payoutStatusLabel(payout.status)}</strong>
        <small>{payout.notes || formatDateTime(payout.requestedAt)}</small>
        <small>Gross {formatMoney(grossCents, payout.currency)} · fee {formatMoney(feeCents, payout.currency)}</small>
      </span>
      <em>{formatMoney(netCents, payout.currency)}</em>
    </div>
  );
}

export function PayoutsClient() {
  const auth = useWebAuth();
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
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.wallet.payouts();
      const data = normalizePayouts(response);
      setWallet(data.wallet);
      setPayouts(data.payouts);
      setSummary(data.summary);
      setLimits(data.summary?.limits ?? null);
      setMoneySafety(data.summary?.moneySafety ?? null);
      setAmount(data.summary?.availableForPayoutCents ? String((data.summary.availableForPayoutCents / 100).toFixed(2)) : '');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === 'Confirm your password or authenticator code first.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
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
        setWallet(data.wallet);
        setPayouts(data.payouts);
        setSummary(data.summary);
        setLimits(data.summary?.limits ?? null);
        setMoneySafety(data.summary?.moneySafety ?? null);
        setMessage(params.get('stripe_connect') === 'return' ? 'Stripe Connect test onboarding status synced.' : 'Stripe Connect onboarding link refreshed.');
        window.history.replaceState(null, '', window.location.pathname);
      } catch (caughtError) {
        setError(getFriendlyApiErrorMessage(caughtError));
      }
    })();
  }, [auth.hydrated, auth.isAuthenticated]);

  async function acknowledgeSafety() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await api.wallet.acknowledgeMoneySafety({ accepted: true }) as { moneySafety?: MoneySafetyStatusDto };
      setMoneySafety(response.moneySafety ?? null);
      setMessage('Money safety policies acknowledged for this launch version.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function confirmFreshAuth() {
    if (!freshPassword.trim() && !freshCode.trim()) throw new Error('Confirm your password or authenticator code first.');
    await auth.reauthenticate({ password: freshPassword.trim() || undefined, code: freshCode.trim() || undefined });
  }

  async function connectStripeAccount() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await confirmFreshAuth();
      const response = await api.wallet.createStripeConnectAccountLink() as { url?: string };
      if (!response.url) throw new Error('Stripe did not return an onboarding link.');
      setFreshPassword('');
      setFreshCode('');
      window.location.assign(response.url);
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === 'Confirm your password or authenticator code first.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
      setSaving(false);
    }
  }

  async function syncStripeConnect() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await api.wallet.syncStripeConnect();
      const data = normalizePayouts(response);
      setWallet(data.wallet);
      setPayouts(data.payouts);
      setSummary(data.summary);
      setLimits(data.summary?.limits ?? null);
      setMoneySafety(data.summary?.moneySafety ?? null);
      setMessage('Stripe Connect test status synced.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function connectDemoAccount() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await confirmFreshAuth();
      const response = await api.wallet.connectDemoPayoutAccount();
      const data = normalizePayouts(response);
      setWallet(data.wallet);
      setPayouts(data.payouts);
      setSummary(data.summary);
      setLimits(data.summary?.limits ?? null);
      setMoneySafety(data.summary?.moneySafety ?? null);
      setFreshPassword('');
      setFreshCode('');
      setMessage('Demo payout account connected. No real bank account was added.');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === 'Confirm your password or authenticator code first.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function requestPayout() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const currency = summary?.currency ?? wallet?.currency ?? auth.user?.profile?.preferredCurrency ?? fallbackCurrency;
      const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);
      const amountCents = parseMoneyInputToCents(amount);
      if (amountCents < 100) throw new Error('Enter at least 1.00.');
      const feeCents = calculatePayoutFeeCents(amountCents, platformFeeRateBps);
      const netCents = Math.max(0, amountCents - feeCents);
      await confirmFreshAuth();
      const response = await api.wallet.requestDemoPayout({ amountCents, currency });
      const data = normalizePayouts(response);
      setWallet(data.wallet);
      setPayouts(data.payouts);
      setSummary(data.summary);
      setLimits(data.summary?.limits ?? null);
      setMoneySafety(data.summary?.moneySafety ?? null);
      setAmount(data.summary?.availableForPayoutCents ? String((data.summary.availableForPayoutCents / 100).toFixed(2)) : '');
      setFreshPassword('');
      setFreshCode('');
      setMessage(`${summary?.payoutAccount.provider === 'stripe_connect_test' ? 'Stripe Connect test payout requested' : 'Demo payout completed'}. Estimated payout ${formatMoney(netCents, currency)} after ${formatMoney(feeCents, currency)} platform fee.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === 'Enter at least 1.00.' ? caughtError.message : caughtError instanceof Error && caughtError.message === 'Confirm your password or authenticator code first.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  if (!auth.hydrated || loading) return <section className="mobile-card mobile-card--soft"><p>Loading payouts...</p></section>;

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">Signed out</span>
        <h3>Sign in to view payouts</h3>
        <p>Payout simulation is private and only uses your own eligible trade earnings.</p>
        <Link href="/auth" className="button primary full">Login or register</Link>
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

      <section className="wallet-hero-card">
        <div>
          <span className="semantic-badge success">Available earnings</span>
          <h2>{formatMoney(available, currency)}</h2>
          <p>Demo payouts use eligible earnings only. Hellowhen keeps a {formatPayoutFeeRate(platformFeeRateBps)} platform fee from payout-eligible earnings.</p>
        </div>
      </section>

      {moneySafety ? (
        <section className="mobile-card wallet-form-card">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Money launch safety</p>
              <h3>{moneySafety.launchMode.replace(/_/g, ' ')}</h3>
            </div>
            <span className={`semantic-badge ${moneySafety.policyAcknowledged ? 'success' : 'warning'}`}>{moneySafety.policyAcknowledged ? 'Accepted' : 'Review'}</span>
          </div>
          <p>{moneySafety.message}</p>
          <div className="wallet-limit-grid">
            <span><strong>{moneySafety.realMoneyEnabled ? 'On' : 'Off'}</strong><small>production money</small></span>
            <span><strong>{moneySafety.stripeTransfersEnabled ? 'On' : 'Off'}</strong><small>Stripe transfers</small></span>
            <span><strong>{moneySafety.requiresManualPayoutReview ? 'On' : 'Off'}</strong><small>manual review</small></span>
            <span><strong>{moneySafety.policyVersion}</strong><small>policy version</small></span>
          </div>
          {!moneySafety.policyAcknowledged ? <button type="button" className="secondary" onClick={() => { void acknowledgeSafety(); }} disabled={saving}>Accept wallet, payout, refund, and dispute policies</button> : <p className="meta">Accepted {formatDateTime(moneySafety.acknowledgedAt)}.</p>}
        </section>
      ) : null}

      {limits ? (
        <section className="mobile-card wallet-form-card">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Launch limits</p>
              <h3>{limits.effectiveTrustTier.replace(/_/g, ' ')}</h3>
            </div>
            <span className="semantic-badge instruction">Safety</span>
          </div>
          <div className="wallet-limit-grid">
            <span><strong>{formatMoney(limits.minimumPayoutCents, currency)}</strong><small>minimum payout</small></span>
            <span><strong>{formatMoney(limits.weeklyPayoutCapCents, currency)}</strong><small>weekly payout cap</small></span>
            <span><strong>{formatMoney(Math.max(0, limits.weeklyPayoutCapCents - limits.weeklyRequestedPayoutGrossCents), currency)}</strong><small>weekly remaining</small></span>
            <span><strong>{formatLimitCount(limits.activeMoneyTradeCount, limits.moneyActiveTradeLimit)}</strong><small>active money trades</small></span>
          </div>
          <p>Payout limits are intentionally low during launch. Verification can raise them later.</p>
        </section>
      ) : null}

      <section className="mobile-card wallet-form-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Payout fee</p>
            <h3>Fee preview</h3>
          </div>
          <span className="semantic-badge money">{formatPayoutFeeRate(platformFeeRateBps)} fee</span>
        </div>
        <p>The platform fee is deducted from payout-eligible earnings when you request a payout. Service-for-service trades remain free.</p>
        <PayoutFeeBreakdown grossAmountCents={available} currency={currency} platformFeeRateBps={platformFeeRateBps} />
      </section>

      <section className="mobile-card wallet-form-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Fresh verification</p>
            <h3>Confirm sensitive payout actions</h3>
          </div>
          <span className="semantic-badge instruction">10 min</span>
        </div>
        <p>Before connecting payout settings or requesting a payout, confirm your password or authenticator code. This is required again after a short safety window.</p>
        <div className="form-stack">
          <label className="field-label">
            Password
            <input value={freshPassword} onChange={(event) => setFreshPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Password" />
          </label>
          <label className="field-label">
            Authenticator or recovery code
            <input value={freshCode} onChange={(event) => setFreshCode(event.target.value)} inputMode="numeric" placeholder="Optional code" />
          </label>
        </div>
      </section>

      <section className="mobile-card wallet-form-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Payout setup</p>
            <h3>{connected ? (usingStripeConnect ? 'Stripe Connect test account ready' : 'Demo payout account connected') : (stripeConnectConfigured ? 'Set up Stripe Connect test' : 'Connect demo payout account')}</h3>
          </div>
          <span className={`semantic-badge ${connected ? 'success' : 'instruction'}`}>{connected ? 'Connected' : 'Required'}</span>
        </div>
        {usingStripeConnect ? (
          <div className="connect-status-list">
            <p>Stripe account: <strong>{payoutAccount.stripeAccountId}</strong></p>
            <p>Charges: <strong>{payoutAccount.chargesEnabled ? 'enabled' : 'not enabled'}</strong> · Payouts: <strong>{payoutAccount.payoutsEnabled ? 'enabled' : 'not enabled'}</strong></p>
            {payoutAccount.currentlyDue?.length ? <p className="meta danger">Due now: {payoutAccount.currentlyDue.join(', ')}</p> : null}
            {payoutAccount.disabledReason ? <p className="meta danger">Disabled: {payoutAccount.disabledReason}</p> : null}
          </div>
        ) : stripeConnectConfigured ? (
          <p>Use Stripe-hosted Connect onboarding in test mode. This can collect simulated payout verification and sync payout readiness back into Hellowhen.</p>
        ) : (
          <p>Stripe Connect is not configured locally, so this creates a test marker in wallet activity instead of collecting bank details.</p>
        )}
        <div className="wallet-action-row">
          {stripeConnectConfigured ? <button type="button" className="secondary" onClick={() => { void connectStripeAccount(); }} disabled={saving || moneySafetyBlocked}>{connected ? 'Open onboarding again' : 'Start Stripe Connect test'}</button> : <button type="button" className="secondary" onClick={() => { void connectDemoAccount(); }} disabled={saving || moneySafetyBlocked || connected}>{connected ? 'Already connected' : 'Connect demo payout account'}</button>}
          {usingStripeConnect ? <button type="button" className="ghost-button" onClick={() => { void syncStripeConnect(); }} disabled={saving}>Sync status</button> : null}
        </div>
      </section>

      <section className="mobile-card wallet-form-card">
        <div className="form-stack">
          <label className="field-label">
            Payout-eligible earnings to withdraw
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
        </div>
        <PayoutFeeBreakdown grossAmountCents={selectedGrossCents} currency={currency} platformFeeRateBps={platformFeeRateBps} />
        <p className="meta">By requesting payout, you agree that Hellowhen keeps a {formatPayoutFeeRate(platformFeeRateBps)} platform fee from payout-eligible earnings. Estimated payout: {formatMoney(selectedNetCents, currency)}.</p>
        <button type="button" onClick={() => { void requestPayout(); }} disabled={payoutButtonDisabled}>{saving ? 'Requesting...' : (stripeConnectConfigured ? 'Request test payout' : 'Request demo payout')}</button>
        {moneySafetyBlocked ? <p className="meta danger">Accept the current money safety policies before requesting payout.</p> : null}
        {!connected ? <p className="meta">{stripeConnectConfigured ? 'Complete Stripe Connect test onboarding first.' : 'Connect the demo payout account first.'}</p> : null}
        {available <= 0 ? <p className="meta">No payout-eligible earnings yet.</p> : null}
        {selectedGrossCents > available ? <p className="meta danger">Amount is above your available payout balance.</p> : null}
        {limits && !limits.payoutsEnabled ? <p className="meta danger">Payouts are disabled for your current trust tier.</p> : null}
        {limits && selectedGrossCents > 0 && selectedGrossCents < minimumPayoutCents ? <p className="meta danger">Minimum payout is {formatMoney(minimumPayoutCents, currency)}.</p> : null}
        {weeklyRemainingCents !== null && selectedGrossCents > weeklyRemainingCents ? <p className="meta danger">This amount is above your remaining weekly payout limit.</p> : null}
      </section>

      <section className="mobile-card wallet-ledger-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Recent payouts</h3>
          </div>
          <span className="semantic-badge money">{formatMoney(summary?.paidOutNetCents ?? summary?.paidOutCents ?? 0, currency)} paid</span>
        </div>
        {payouts.length ? (
          <div className="wallet-ledger-list">
            {payouts.map((payout) => <PayoutHistoryRow key={payout.id} payout={payout} platformFeeRateBps={platformFeeRateBps} />)}
          </div>
        ) : (
          <div className="proposal-empty-state">
            <strong>No payouts yet</strong>
            <span>Completed demo payouts will appear here.</span>
          </div>
        )}
      </section>
    </div>
  );
}
