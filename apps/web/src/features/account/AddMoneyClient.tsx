'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MoneySafetyStatusDto, WalletDto, WalletLimitsDto } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { currencyOptions, isSupportedCurrency, type SupportedCurrency } from '../../lib/webMoneyPreferences';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { fallbackCurrency, formatMoney, moneyLaunchModeLabel, moneySafetyMessage, normalizeLimits, normalizeWallet, parseMoneyInputToCents } from './accountPresentation';

const quickAmounts = ['5', '10', '25', '50'];

type TopUpResponse = { wallet?: WalletDto; message?: string } | WalletDto;

export function AddMoneyClient() {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
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
      setMessage(t('account.addMoney.policyAcknowledged'));
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
      if (amountCents < 100) throw new Error(t('account.addMoney.minAmount'));
      const response = await api.wallet.demoTopUp({ amountCents, currency });
      setWallet(normalizeWallet(response as TopUpResponse));
      const safetyResponse = await api.wallet.moneySafety() as { moneySafety?: MoneySafetyStatusDto };
      setMoneySafety(safetyResponse.moneySafety ?? moneySafety);
      setMessage(t('account.addMoney.added'));
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === t('account.addMoney.minAmount') ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  if (!auth.hydrated) {
    return <section className="mobile-card mobile-card--soft"><p>{t('account.addMoney.loading')}</p></section>;
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
        <h3>{t('account.addMoney.signedOutTitle')}</h3>
        <p>{t('account.addMoney.signedOutBody')}</p>
        <Link href="/auth" className="button primary full">{t('common.actions.loginOrRegister')}</Link>
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
          <span className="semantic-badge money">{t('account.addMoney.simulationOnly')}</span>
          <h2>{formatMoney(previewCents, currency, language)}</h2>
          <p>{t('account.addMoney.simulationBody')}</p>
        </div>
      </section>

      {moneySafety ? (
        <section className="mobile-card wallet-form-card">
          <div className="trade-section-heading">
            <div>
              <p className="eyebrow">{t('account.addMoney.safetyTitle')}</p>
              <h3>{moneyLaunchModeLabel(moneySafety.launchMode, t)}</h3>
            </div>
            <span className={`semantic-badge ${moneySafety.policyAcknowledged ? 'success' : 'warning'}`}>{moneySafety.policyAcknowledged ? t('account.addMoney.safetyAccepted') : t('account.addMoney.safetyReview')}</span>
          </div>
          <p>{moneySafetyMessage(moneySafety, t)}</p>
          {!moneySafety.policyAcknowledged ? <button type="button" className="secondary" onClick={() => { void acknowledgeSafety(); }} disabled={saving}>{t('account.addMoney.acceptPolicies')}</button> : <p className="meta">{t('account.addMoney.policyAccepted', { version: moneySafety.policyVersion })}</p>}
        </section>
      ) : null}

      <section className="mobile-card wallet-form-card">
        <div className="form-stack">
          <label className="field-label">
            {t('account.addMoney.amount')}
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="10.00" />
          </label>
          <div className="quick-amount-grid">
            {quickAmounts.map((quickAmount) => (
              <button key={quickAmount} type="button" className="secondary" onClick={() => setAmount(quickAmount)}>
                {formatMoney(Number(quickAmount) * 100, currency, language)}
              </button>
            ))}
          </div>
          <label className="field-label">
            {t('account.addMoney.currency')}
            <select
              value={currency}
              onChange={(event) => {
                if (isSupportedCurrency(event.target.value)) setCurrency(event.target.value);
              }}
            >
              {currencyOptions.map((option) => <option key={option.code} value={option.code}>{option.label} · {t(`common.locale.currencies.${option.code}`)}</option>)}
            </select>
          </label>
        </div>
        {message ? <p className="notice-box success">{message}</p> : null}
        {error ? <p className="notice-box danger">{error}</p> : null}
        {limits ? <p className="notice-box instruction">{t('account.addMoney.launchWalletCap', { cap: formatMoney(walletCapCents, currency, language), remaining: formatMoney(remainingCapCents, currency, language) })}</p> : null}
        {blockedBySafety ? <p className="notice-box danger">{t('account.addMoney.blockedSafety')}</p> : null}
        {blockedByLimits ? <p className="notice-box danger">{t('account.addMoney.blockedLimit')}</p> : null}
        {wallet ? <p className="notice-box money">{t('account.addMoney.newBalance', { amount: formatMoney(wallet.availableBalanceCents, wallet.currency, language) })}</p> : null}
        <button type="button" onClick={() => { void submitTopUp(); }} disabled={saving || blockedBySafety || blockedByLimits}>{saving ? t('account.addMoney.adding') : t('account.addMoney.addDemoMoney')}</button>
      </section>
    </div>
  );
}
