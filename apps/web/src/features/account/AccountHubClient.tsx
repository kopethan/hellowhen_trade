'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PayoutSummaryDto, WalletDto } from '@hellowhen/contracts';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { assetUrl, fallbackCurrency, formatMoney, formatPayoutFeeRate, normalizePayoutFeeRateBps, normalizePayouts, normalizeWallet } from './accountPresentation';

type AccountHubItem = {
  href: string;
  title: string;
  body: string;
  badge?: string;
  icon?: WebIconName;
};

const accountItems: AccountHubItem[] = [
  { href: '/account/profile', title: 'Profile', body: 'Display name, handle, bio, profile photo, country, and display currency.', icon: 'profile' },
  ...(betaFeatures.businessAccountsVisible ? [{ href: '/account/business', title: 'Business / brand', body: 'Create future business, agency, brand, or enterprise profiles for KYB-ready onboarding.' }] : []),
  ...(betaFeatures.walletVisible ? [{ href: '/account/wallet', title: 'Wallet', body: 'Optional wallet money, held money, earnings, and recent activity.' }] : []),
  ...(betaFeatures.payoutsVisible ? [{ href: '/account/payouts', title: 'Payouts', body: 'Connect the demo payout account, preview the platform fee, and simulate payout requests.' }] : []),
  { href: '/account/settings', title: 'Settings', body: 'Appearance, dark mode, and notification preferences.', icon: 'settings' },
  { href: '/account/support', title: 'Support', body: 'Create support tickets, attach screenshots, and follow replies.', icon: 'help' },
];

export function AccountHubClient() {
  const auth = useWebAuth();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadPreview() {
      if (!auth.hydrated || !auth.isAuthenticated || !(betaFeatures.walletVisible || betaFeatures.payoutsVisible)) return;
      try {
        const [walletResponse, payoutResponse] = await Promise.all([api.wallet.me(), api.wallet.payouts()]);
        if (!mounted) return;
        setWallet(normalizeWallet(walletResponse));
        setSummary(normalizePayouts(payoutResponse).summary);
      } catch {
        if (mounted) {
          setWallet(null);
          setSummary(null);
        }
      }
    }
    void loadPreview();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);

  const currency = wallet?.currency ?? auth.user?.profile?.preferredCurrency ?? fallbackCurrency;
  const platformFeeRateBps = normalizePayoutFeeRateBps(summary?.platformFeeRateBps);

  return (
    <div className="mobile-page">
      {auth.isAuthenticated ? (
        <section className="account-overview-card">
          <div className="account-avatar" aria-hidden="true">
            {auth.user?.profile?.avatarUrl ? <img src={assetUrl(auth.user.profile.avatarUrl)} alt="" /> : <span>{auth.user?.profile?.displayName?.slice(0, 1).toUpperCase() ?? 'H'}</span>}
          </div>
          <div>
            <span className="semantic-badge instruction">Signed in</span>
            <h2>{auth.user?.profile?.displayName ?? auth.user?.email}</h2>
            <p>{auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : 'Add a handle on your profile.'}</p>
          </div>
        </section>
      ) : auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Signed out</span>
          <h3>Login to open your account</h3>
          <p>Profile, settings, wallet, and support are available after login.</p>
          <Link href="/auth?next=/account" className="button primary">Login or register</Link>
        </section>
      ) : null}

      {auth.isAuthenticated && (betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? (
        <section className="wallet-preview-strip">
          <div>
            <span>Wallet money</span>
            <strong>{formatMoney(wallet?.availableBalanceCents ?? 0, currency)}</strong>
          </div>
          <div>
            <span>Available earnings</span>
            <strong>{formatMoney(wallet?.pendingPayoutCents ?? summary?.availableForPayoutCents ?? 0, currency)}</strong>
            <small>{formatPayoutFeeRate(platformFeeRateBps)} payout fee</small>
          </div>
        </section>
      ) : null}

      <div className="mobile-list">
        {accountItems.map((item) => {
          const href = auth.hydrated && !auth.isAuthenticated ? `/auth?next=${encodeURIComponent(item.href)}` : item.href;
          return (
            <Link key={item.href} href={href} className="mobile-link-card">
              {item.icon ? <WebIcon name={item.icon} size={22} decorative className="mobile-link-card__icon" /> : null}
              <span className="mobile-link-card__body">
                <strong>{item.title}</strong>
                <br />
                {item.body}
              </span>
              <WebIcon name="arrow-right" size={17} decorative className="mobile-link-card__arrow" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
