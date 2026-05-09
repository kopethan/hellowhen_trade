'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PayoutRequestDto, PayoutSummaryDto, WalletDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { fallbackCurrency, formatDateTime, formatMoney, normalizePayouts, parseMoneyInputToCents, payoutStatusLabel } from './accountPresentation';

export function PayoutsClient() {
  const auth = useWebAuth();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequestDto[]>([]);
  const [amount, setAmount] = useState('');
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
      setAmount(data.summary?.availableForPayoutCents ? String((data.summary.availableForPayoutCents / 100).toFixed(2)) : '');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPayouts(); }, [auth.hydrated, auth.isAuthenticated]);

  async function connectDemoAccount() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await api.wallet.connectDemoPayoutAccount();
      const data = normalizePayouts(response);
      setWallet(data.wallet);
      setPayouts(data.payouts);
      setSummary(data.summary);
      setMessage('Demo payout account connected. No real bank account was added.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
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
      const amountCents = parseMoneyInputToCents(amount);
      if (amountCents < 100) throw new Error('Enter at least 1.00.');
      const response = await api.wallet.requestDemoPayout({ amountCents, currency });
      const data = normalizePayouts(response);
      setWallet(data.wallet);
      setPayouts(data.payouts);
      setSummary(data.summary);
      setMessage('Demo payout completed. No real bank transfer was sent.');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === 'Enter at least 1.00.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
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
  const connected = summary?.payoutAccount.status === 'connected';
  const available = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;

  return (
    <div className="wallet-page">
      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}

      <section className="wallet-hero-card">
        <div>
          <span className="semantic-badge success">Available earnings</span>
          <h2>{formatMoney(available, currency)}</h2>
          <p>Demo payouts use eligible earnings only. No real bank transfer is sent.</p>
        </div>
      </section>

      <section className="mobile-card wallet-form-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Payout setup</p>
            <h3>{connected ? 'Demo payout account connected' : 'Connect demo payout account'}</h3>
          </div>
          <span className={`semantic-badge ${connected ? 'success' : 'instruction'}`}>{connected ? 'Connected' : 'Required'}</span>
        </div>
        <p>This only creates a test marker in your wallet activity. It does not collect bank details.</p>
        <button type="button" className="secondary" onClick={() => { void connectDemoAccount(); }} disabled={saving || connected}>{connected ? 'Already connected' : 'Connect demo payout account'}</button>
      </section>

      <section className="mobile-card wallet-form-card">
        <div className="form-stack">
          <label className="field-label">
            Payout amount
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
        </div>
        <button type="button" onClick={() => { void requestPayout(); }} disabled={saving || !connected || available <= 0}>{saving ? 'Requesting...' : 'Request demo payout'}</button>
        {!connected ? <p className="meta">Connect the demo payout account first.</p> : null}
        {available <= 0 ? <p className="meta">No payout-eligible earnings yet.</p> : null}
      </section>

      <section className="mobile-card wallet-ledger-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Recent payouts</h3>
          </div>
          <span className="semantic-badge money">{formatMoney(summary?.paidOutCents ?? 0, currency)} paid</span>
        </div>
        {payouts.length ? (
          <div className="wallet-ledger-list">
            {payouts.map((payout) => (
              <div className="wallet-ledger-row" key={payout.id}>
                <span>
                  <strong>{payoutStatusLabel(payout.status)}</strong>
                  <small>{payout.notes || formatDateTime(payout.requestedAt)}</small>
                </span>
                <em>{formatMoney(payout.amountCents, payout.currency)}</em>
              </div>
            ))}
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
