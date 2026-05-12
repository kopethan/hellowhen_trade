'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { LedgerEntryDto, MoneyProviderWalletBalanceDto, PayoutSummaryDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { calculatePayoutFeeCents, fallbackCurrency, formatDateTime, formatLimitCount, formatMoney, formatPayoutFeeRate, ledgerLabel, moneyDeltaClassName, normalizeLedger, normalizePayoutFeeRateBps, normalizePayouts, normalizeWallet, trustTierLabel } from './accountPresentation';

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

function ProviderBalanceRow({ balance, language, t }: { balance: MoneyProviderWalletBalanceDto; language: 'en' | 'fr'; t: (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string }) {
  return (
    <div className="wallet-ledger-row">
      <span>
        <strong>{balance.currency.toUpperCase()}</strong>
        <small>{t('account.wallet.providerSnapshotMeta')} · {balance.lastSyncedAt ? formatDateTime(balance.lastSyncedAt, language) : t('common.states.notSynced')}</small>
      </span>
      <em className="wallet-ledger-row__amount">{formatMoney(balance.availableCents, balance.currency, language)}</em>
    </div>
  );
}

function LedgerRow({ entry, language, t }: { entry: LedgerEntryDto; language: 'en' | 'fr'; t: (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string }) {
  const cents = entry.amountCents ?? 0;
  const signed = cents > 0 ? `+${formatMoney(cents, entry.currency, language)}` : formatMoney(cents, entry.currency, language);
  return (
    <div className="wallet-ledger-row">
      <span>
        <strong>{ledgerLabel(entry.type, t)}</strong>
        <small>{entry.description || formatDateTime(entry.createdAt, language)}</small>
      </span>
      <em className={`wallet-ledger-row__amount ${moneyDeltaClassName(cents)}`}>{signed}</em>
    </div>
  );
}

export function WalletClient() {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
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
  const feeRate = formatPayoutFeeRate(platformFeeRateBps);
  const availablePayoutGrossCents = summary?.availableForPayoutCents ?? wallet?.pendingPayoutCents ?? 0;
  const estimatedPayoutFeeCents = summary?.estimatedPlatformFeeCents ?? calculatePayoutFeeCents(availablePayoutGrossCents, platformFeeRateBps);
  const estimatedPayoutNetCents = summary?.estimatedNetPayoutCents ?? Math.max(0, availablePayoutGrossCents - estimatedPayoutFeeCents);
  const providerBalances = summary?.providerWalletBalances ?? [];
  const metrics = useMemo<WalletMetric[]>(() => [
    {
      label: t('account.walletMoney'),
      value: formatMoney(wallet?.availableBalanceCents ?? 0, currency, language),
      body: t('account.wallet.availableBody'),
      tone: 'money',
    },
    {
      label: t('account.wallet.held'),
      value: formatMoney(wallet?.heldBalanceCents ?? 0, currency, language),
      body: t('account.wallet.heldBody'),
      tone: 'instruction',
    },
    {
      label: t('account.availableEarnings'),
      value: formatMoney(availablePayoutGrossCents, currency, language),
      body: t('account.wallet.earningsBody', { rate: feeRate }),
      tone: 'success',
    },
    {
      label: t('account.wallet.payoutRequests'),
      value: formatMoney(summary?.pendingPayoutRequestsNetCents ?? summary?.pendingPayoutRequestsCents ?? 0, currency, language),
      body: t('account.wallet.payoutRequestsBody'),
      tone: 'proposal',
    },
    {
      label: t('account.wallet.platformFee'),
      value: formatMoney(estimatedPayoutFeeCents, currency, language),
      body: t('account.wallet.platformFeeBody', { rate: feeRate }),
      tone: 'danger',
    },
    {
      label: t('account.wallet.estimatedPayout'),
      value: formatMoney(estimatedPayoutNetCents, currency, language),
      body: t('account.wallet.estimatedPayoutBody'),
      tone: 'success',
    },
  ], [availablePayoutGrossCents, currency, estimatedPayoutFeeCents, estimatedPayoutNetCents, feeRate, language, summary?.pendingPayoutRequestsCents, summary?.pendingPayoutRequestsNetCents, t, wallet?.availableBalanceCents, wallet?.heldBalanceCents]);

  if (!auth.hydrated || loading) {
    return <section className="mobile-card mobile-card--soft"><p>{t('account.wallet.loading')}</p></section>;
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
        <h3>{t('account.wallet.signedOutTitle')}</h3>
        <p>{t('account.wallet.signedOutBody')}</p>
        <Link href="/auth" className="button primary full">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  return (
    <div className="wallet-page">
      {error ? <p className="notice-box danger">{error}</p> : null}

      <section className="wallet-hero-card">
        <div>
          <span className="semantic-badge money">{t('account.wallet.optionalWallet')}</span>
          <h2>{formatMoney(wallet?.availableBalanceCents ?? 0, currency, language)}</h2>
          <p>{t('account.wallet.optionalWalletBody')}</p>
        </div>
        <div className="wallet-hero-card__actions">
          <Link href="/account/wallet/add" className="button primary">{t('account.wallet.addMoney')}</Link>
          <Link href="/account/payouts" className="button secondary">{t('account.payouts.title')}</Link>
        </div>
      </section>

      <section className="wallet-metric-grid">
        {metrics.map((metric) => <WalletMetricCard key={metric.label} metric={metric} />)}
      </section>

      {limits ? (
        <section className="mobile-card mobile-card--soft">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">{t('account.wallet.launchLimits')}</p>
              <h3>{trustTierLabel(limits.effectiveTrustTier, t)}</h3>
            </div>
            <span className="semantic-badge instruction">{t('account.wallet.safety')}</span>
          </div>
          <div className="wallet-limit-grid">
            <span><strong>{formatLimitCount(limits.activeServiceTradeCount, limits.serviceActiveTradeLimit)}</strong><small>{t('account.wallet.activeServiceTrades')}</small></span>
            <span><strong>{formatLimitCount(limits.activeMoneyTradeCount, limits.moneyActiveTradeLimit)}</strong><small>{t('account.wallet.activeMoneyTrades')}</small></span>
            <span><strong>{formatMoney(limits.perTradeMoneyCapCents, currency, language)}</strong><small>{t('account.wallet.perMoneyTrade')}</small></span>
            <span><strong>{formatMoney(limits.walletBalanceCapCents, currency, language)}</strong><small>{t('account.wallet.walletCap')}</small></span>
          </div>
          <p>{t('account.wallet.launchLimitsBody')}</p>
        </section>
      ) : null}

      {providerBalances.length ? (
        <section className="mobile-card wallet-ledger-card">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">{t('account.wallet.providerSnapshot')}</p>
              <h3>{t('account.wallet.providerSnapshotTitle')}</h3>
            </div>
            <span className="semantic-badge instruction">{t('account.wallet.readOnly')}</span>
          </div>
          <p>{t('account.wallet.providerSnapshotBody')}</p>
          <div className="wallet-ledger-list">
            {providerBalances.map((balance) => <ProviderBalanceRow key={`${balance.providerAccountId ?? 'provider'}-${balance.currency}`} balance={balance} language={language} t={t} />)}
          </div>
        </section>
      ) : null}

      <section className="mobile-card mobile-card--soft">
        <h3>{t('account.wallet.moneyRules')}</h3>
        <p>{t('account.wallet.moneyRulesBody', { rate: feeRate })}</p>
      </section>

      <section className="mobile-card wallet-ledger-card">
        <div className="trade-section-heading">
          <div>
            <p className="eyebrow">{t('account.wallet.recentActivity')}</p>
            <h3>{t('account.wallet.walletActivity')}</h3>
          </div>
          <span className="semantic-badge instruction">{t('account.wallet.demoSafe')}</span>
        </div>
        {entries.length ? (
          <div className="wallet-ledger-list">
            {entries.slice(0, 12).map((entry) => <LedgerRow key={entry.id} entry={entry} language={language} t={t} />)}
          </div>
        ) : (
          <div className="proposal-empty-state">
            <strong>{t('account.wallet.noActivityTitle')}</strong>
            <span>{t('account.wallet.noActivityBody')}</span>
          </div>
        )}
      </section>
    </div>
  );
}
