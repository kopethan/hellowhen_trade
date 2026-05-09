'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MoneySafetyStatusDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { currencyOptions, isSupportedCurrency, type SupportedCurrency } from '../../lib/webMoneyPreferences';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { fallbackCurrency, formatMoney, normalizeLimits, normalizeWallet, parseMoneyInputToCents } from './accountPresentation';

const quickAmounts = ['5', '10', '25', '50'];

type TopUpResponse = { wallet?: WalletDto; message?: string } | WalletDto;

export function AddMoneyClient() {
  const auth = useWebAuth();
  const defaultCurrency = auth.user?.profile?.preferredCurrency ?? fallbackCurrency;
  const [amount, setAmount] = useState('10');
  const [currency, setCurrency] = useState<SupportedCurrency>(isSupportedCurrency(defaultCurrency) ? defaultCurrency : 'eur');
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [limits, setLimits] = useState<WalletLimitsDto | null>(null);
  const [moneySafety, setMoneySafety] = useState<MoneySafetyStatusDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadLimits() {
      if (!auth.hydrated || !auth.isAuthenticated) return;
      try {
        const [limitResponse, safetyResponse] = await Promise.all([api.wallet.limits(), api.wallet.moneySafety()]);
        if (mounted) {
          setLimits(normalizeLimits(limitResponse));
          setMoneySafety((safetyResponse as { moneySafety?: MoneySafetyStatusDto }).moneySafety ?? null);
        }
      } catch {
        if (mounted) setLimits(null);
      }
    }
    void loadLimits();
    return () => { mounted = false; };
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

  async function submitTopUp() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const amountCents = parseMoneyInputToCents(amount);
      if (amountCents < 100) throw new Error('Enter at least 1.00.');
      const response = await api.wallet.demoTopUp({ amountCents, currency });
      setWallet(normalizeWallet(response as TopUpResponse));
      const safetyResponse = await api.wallet.moneySafety() as { moneySafety?: MoneySafetyStatusDto };
      setMoneySafety(safetyResponse.moneySafety ?? moneySafety);
      setMessage('Demo wallet money added. No real card was charged.');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === 'Enter at least 1.00.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  if (!auth.hydrated) {
    return <section className="mobile-card mobile-card--soft"><p>Loading your session...</p></section>;
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">Signed out</span>
        <h3>Sign in to use the demo top-up</h3>
        <p>Wallet money is private to your account and can later be selected inside Need/Offer trade sides.</p>
        <Link href="/auth" className="button primary full">Login or register</Link>
      </section>
    );
  }

  const previewCents = parseMoneyInputToCents(amount);
  const currentExposureCents = limits?.walletExposureCents ?? wallet?.availableBalanceCents ?? 0;
  const walletCapCents = limits?.walletBalanceCapCents ?? 100000;
  const remainingCapCents = Math.max(0, walletCapCents - currentExposureCents);
  const blockedByLimits = Boolean(limits && (!limits.walletTopUpsEnabled || previewCents > remainingCapCents));
  const blockedBySafety = Boolean(moneySafety && (moneySafety.launchMode === 'disabled' || !moneySafety.privateBetaAllowed || (moneySafety.policyAcknowledgementRequired && !moneySafety.policyAcknowledged)));

  return (
    <div className="wallet-page">
      <section className="wallet-hero-card">
        <div>
          <span className="semantic-badge money">Simulation only</span>
          <h2>{formatMoney(previewCents, currency)}</h2>
          <p>This adds demo wallet money for testing the web flow. No real Stripe integration or card charge is used here.</p>
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
          {!moneySafety.policyAcknowledged ? <button type="button" className="secondary" onClick={() => { void acknowledgeSafety(); }} disabled={saving}>Accept wallet, payout, refund, and dispute policies</button> : <p className="meta">Policy version {moneySafety.policyVersion} accepted.</p>}
        </section>
      ) : null}

      <section className="mobile-card wallet-form-card">
        <div className="form-stack">
          <label className="field-label">
            Amount
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="10.00" />
          </label>
          <div className="quick-amount-grid">
            {quickAmounts.map((quickAmount) => (
              <button key={quickAmount} type="button" className="secondary" onClick={() => setAmount(quickAmount)}>
                {formatMoney(Number(quickAmount) * 100, currency)}
              </button>
            ))}
          </div>
          <label className="field-label">
            Currency
            <select
              value={currency}
              onChange={(event) => {
                if (isSupportedCurrency(event.target.value)) setCurrency(event.target.value);
              }}
            >
              {currencyOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {message ? <p className="notice-box success">{message}</p> : null}
        {error ? <p className="notice-box danger">{error}</p> : null}
        {limits ? <p className="notice-box instruction">Launch wallet cap: {formatMoney(walletCapCents, currency)} · remaining: {formatMoney(remainingCapCents, currency)}</p> : null}
        {blockedBySafety ? <p className="notice-box danger">Accept the current money safety policies before adding demo money.</p> : null}
        {blockedByLimits ? <p className="notice-box danger">This top-up is above your current launch limit. Verify your account or contact support to request a higher limit.</p> : null}
        {wallet ? <p className="notice-box money">New wallet balance: {formatMoney(wallet.availableBalanceCents, wallet.currency)}</p> : null}
        <button type="button" onClick={() => { void submitTopUp(); }} disabled={saving || blockedBySafety || blockedByLimits}>{saving ? 'Adding...' : 'Add demo money'}</button>
      </section>
    </div>
  );
}
