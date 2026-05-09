'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { WalletDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { currencyOptions, isSupportedCurrency, type SupportedCurrency } from '../../lib/webMoneyPreferences';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { fallbackCurrency, formatMoney, normalizeWallet, parseMoneyInputToCents } from './accountPresentation';

const quickAmounts = ['5', '10', '25', '50'];

type TopUpResponse = { wallet?: WalletDto; message?: string } | WalletDto;

export function AddMoneyClient() {
  const auth = useWebAuth();
  const defaultCurrency = auth.user?.profile?.preferredCurrency ?? fallbackCurrency;
  const [amount, setAmount] = useState('10');
  const [currency, setCurrency] = useState<SupportedCurrency>(isSupportedCurrency(defaultCurrency) ? defaultCurrency : 'eur');
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submitTopUp() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const amountCents = parseMoneyInputToCents(amount);
      if (amountCents < 100) throw new Error('Enter at least 1.00.');
      const response = await api.wallet.demoTopUp({ amountCents, currency });
      setWallet(normalizeWallet(response as TopUpResponse));
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

  return (
    <div className="wallet-page">
      <section className="wallet-hero-card">
        <div>
          <span className="semantic-badge money">Simulation only</span>
          <h2>{formatMoney(previewCents, currency)}</h2>
          <p>This adds demo wallet money for testing the web flow. No real Stripe integration or card charge is used here.</p>
        </div>
      </section>

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
        {wallet ? <p className="notice-box money">New wallet balance: {formatMoney(wallet.availableBalanceCents, wallet.currency)}</p> : null}
        <button type="button" onClick={() => { void submitTopUp(); }} disabled={saving}>{saving ? 'Adding...' : 'Add demo money'}</button>
      </section>
    </div>
  );
}
