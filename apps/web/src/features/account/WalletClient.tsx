'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { LedgerEntryDto, MoneyProviderWalletBalanceDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { calculatePayoutFeeCents, fallbackCurrency, formatDateTime, formatMoney, formatLimitCount, formatPayoutFeeRate, ledgerLabel, moneyDeltaClassName, normalizeLedger, normalizePayoutFeeRateBps, normalizePayouts, normalizeWallet } from './accountPresentation';

type WalletMetric = {
  label: string;
  value: string;
  body: string;
  tone: string;
};

function WalletMetricCard({ metric }: { metric: WalletMetric }) {
  return (
    <section className="wallet-metric-card">
      <span className={`semantic-badge ${metric.tone}`}>{metric.label}</span>
      <strong>{metric.value}</strong>
      <p>{metric.body}</p>
    </section>
  );
}


function ProviderBalanceRow({ balance }: { balance: MoneyProviderWalletBalanceDto }) {
  return (
    <div className="wallet-ledger-row">
      <span>
        <strong>{balance.currency.toUpperCase()}</strong>
        <small>Provider snapshot · {balance.lastSyncedAt ? formatDateTime(balance.lastSyncedAt) : 'not synced'}</small>
      </span>
      <em className="wallet-ledger-row__amount">{formatMoney(balance.availableCents, balance.currency)}</em>
    </div>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntryDto }) {
  const cents = entry.amountCents ?? 0;
  const signed = cents > 0 ? `+${formatMoney(cents, entry.currency)}` : formatMoney(cents, entry.currency);
  return (
    <div className="wallet-ledger-row">
      <span>
        <strong>{ledgerLabel(entry.type)}</strong>
        <small>{entry.description || formatDateTime(entry.createdAt)}</small>
      </span>
      <em className={`wallet-ledger-row__amount ${moneyDeltaClassName(cents)}`}>{signed}</em>
    </div>
  );
}

export function WalletClient() {
  const auth = useWebAuth();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [entries, setEntries] = useState<LedgerEntryDto[]>([]);
  const [limits, setLimits] = useState<WalletLimitsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadWallet() {
      if (!auth.hydrated) return;
      if (!auth.isAuthenticated) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [walletResponse, ledgerResponse, payoutResponse] = await Promise.all([
          api.wallet.me(),
          api.wallet.ledger(),
          api.wallet.payouts(),
        ]);
        if (!mounted) return;
        const payoutData = normalizePayouts(payoutResponse);
        setLimits(payoutData.summary?.limits ?? null);
        setWallet(normalizeWallet(walletResponse) ?? payoutData.wallet);
        setEntries(normalizeLedger(ledgerResponse));
        setSummary(payoutData.summary);
      } catch (caughtError) {
        if (!mounted) return;
        setError(getFriendlyApiErrorMessage(caughtError));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadWallet();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);

  const currency = wallet?.currency ?? auth.user?.profile?.preferredCurrency ?? fallbackCurrency;
  const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);
  const availablePayoutGrossCents = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const estimatedPayoutFeeCents = summary?.estimatedPlatformFeeCents ?? calculatePayoutFeeCents(availablePayoutGrossCents, platformFeeRateBps);
  const estimatedPayoutNetCents = summary?.estimatedNetPayoutCents ?? Math.max(0, availablePayoutGrossCents - estimatedPayoutFeeCents);
  const providerBalances = summary?.providerWalletBalances ?? [];
  const metrics = useMemo<WalletMetric[]>(() => [
    {
      label: 'Wallet money',
      value: formatMoney(wallet?.availableBalanceCents ?? 0, currency),
      body: 'Optional money available to select under I offer money when creating a trade.',
      tone: 'money',
    },
    {
      label: 'Held',
      value: formatMoney(wallet?.heldBalanceCents ?? 0, currency),
      body: 'Money reserved for trades that are not complete yet.',
      tone: 'instruction',
    },
    {
      label: 'Available earnings',
      value: formatMoney(availablePayoutGrossCents, currency),
      body: `Trade earnings before the ${formatPayoutFeeRate(platformFeeRateBps)} payout fee.`,
      tone: 'success',
    },
    {
      label: 'Payout requests',
      value: formatMoney(summary?.pendingPayoutRequestsNetCents ?? summary?.pendingPayoutRequestsCents ?? 0, currency),
      body: 'Requested or approved demo payouts after platform fee.',
      tone: 'proposal',
    },
    {
      label: 'Platform fee',
      value: formatMoney(estimatedPayoutFeeCents, currency),
      body: `${formatPayoutFeeRate(platformFeeRateBps)} is kept from payout-eligible earnings when you request payout.`,
      tone: 'danger',
    },
    {
      label: 'Estimated payout',
      value: formatMoney(estimatedPayoutNetCents, currency),
      body: 'Estimated amount you receive after the platform fee.',
      tone: 'success',
    },
  ], [availablePayoutGrossCents, currency, estimatedPayoutFeeCents, estimatedPayoutNetCents, platformFeeRateBps, summary?.pendingPayoutRequestsCents, summary?.pendingPayoutRequestsNetCents, wallet?.availableBalanceCents, wallet?.heldBalanceCents]);

  if (!auth.hydrated || loading) {
    return <section className="mobile-card mobile-card--soft"><p>Loading wallet...</p></section>;
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">Signed out</span>
        <h3>Sign in to view wallet money</h3>
        <p>Wallet money is optional, but your balance and payout simulation are private to your account.</p>
        <Link href="/auth" className="button primary full">Login or register</Link>
      </section>
    );
  }

  return (
    <div className="wallet-page">
      {error ? <p className="notice-box danger">{error}</p> : null}

      <section className="wallet-hero-card">
        <div>
          <span className="semantic-badge money">Optional wallet</span>
          <h2>{formatMoney(wallet?.availableBalanceCents ?? 0, currency)}</h2>
          <p>Money stays optional. Use it only when a trade needs “I need money” or “I offer money”.</p>
        </div>
        <div className="wallet-hero-card__actions">
          <Link href="/account/wallet/add" className="button primary">Add money</Link>
          <Link href="/account/payouts" className="button secondary">Payouts</Link>
        </div>
      </section>

      <section className="wallet-metric-grid">
        {metrics.map((metric) => <WalletMetricCard key={metric.label} metric={metric} />)}
      </section>

      {limits ? (
        <section className="mobile-card mobile-card--soft">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Launch limits</p>
              <h3>{limits.effectiveTrustTier.replace(/_/g, ' ')}</h3>
            </div>
            <span className="semantic-badge instruction">Safety</span>
          </div>
          <div className="wallet-limit-grid">
            <span><strong>{formatLimitCount(limits.activeServiceTradeCount, limits.serviceActiveTradeLimit)}</strong><small>active service trades</small></span>
            <span><strong>{formatLimitCount(limits.activeMoneyTradeCount, limits.moneyActiveTradeLimit)}</strong><small>active money trades</small></span>
            <span><strong>{formatMoney(limits.perTradeMoneyCapCents, currency)}</strong><small>per money trade</small></span>
            <span><strong>{formatMoney(limits.walletBalanceCapCents, currency)}</strong><small>wallet cap</small></span>
          </div>
          <p>Launch limits keep early money flows small. Verify your payout account or contact support when you need higher limits.</p>
        </section>
      ) : null}


      {providerBalances.length ? (
        <section className="mobile-card wallet-ledger-card">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">Provider balance snapshot</p>
              <h3>Airwallex sandbox balances</h3>
            </div>
            <span className="semantic-badge instruction">Read-only</span>
          </div>
          <p>Provider balances are reconciliation snapshots only. Hellowhen's ledger remains the product source of truth.</p>
          <div className="wallet-ledger-list">
            {providerBalances.map((balance) => <ProviderBalanceRow key={`${balance.providerAccountId ?? 'provider'}-${balance.currency}`} balance={balance} />)}
          </div>
        </section>
      ) : null}

      <section className="mobile-card mobile-card--soft">
        <h3>Money rules</h3>
        <p>Money is not a separate trade field. It belongs inside the same product language: I need money or I offer money. When payout-eligible earnings are withdrawn, Hellowhen keeps a transparent {formatPayoutFeeRate(platformFeeRateBps)} platform fee.</p>
      </section>

      <section className="mobile-card wallet-ledger-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h3>Wallet activity</h3>
          </div>
          <span className="semantic-badge instruction">Demo safe</span>
        </div>
        {entries.length ? (
          <div className="wallet-ledger-list">
            {entries.slice(0, 12).map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
          </div>
        ) : (
          <div className="proposal-empty-state">
            <strong>No wallet activity yet</strong>
            <span>Try the demo top-up flow to see wallet activity here.</span>
          </div>
        )}
      </section>
    </div>
  );
}
