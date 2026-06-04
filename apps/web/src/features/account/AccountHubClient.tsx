'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PayoutSummaryDto, WalletDto } from '@hellowhen/contracts';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { assetUrl, fallbackCurrency, formatMoney, formatPayoutFeeRate, normalizePayoutFeeRateBps, normalizePayouts, normalizeWallet } from './accountPresentation';

type AccountHubItem = {
  href: string;
  titleKey: string;
  bodyKey: string;
  icon?: WebIconName;
  publicAccess?: boolean;
};

export function AccountHubClient() {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [summary, setSummary] = useState<PayoutSummaryDto | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const accountItems = useMemo<AccountHubItem[]>(() => [
    { href: '/account/profile', titleKey: 'account.items.profile.title', bodyKey: 'account.items.profile.body', icon: 'profile' },
    { href: '/account/notifications', titleKey: 'account.items.notifications.title', bodyKey: 'account.items.notifications.body', icon: 'bell' },
    ...(betaFeatures.proSubscriptionFeatures.proAccountsVisible ? [{ href: '/account/plans', titleKey: 'account.items.plans.title', bodyKey: 'account.items.plans.body', icon: 'profile' as WebIconName }] : []),
    ...(betaFeatures.businessAccountsVisible ? [{ href: '/account/business', titleKey: 'account.items.business.title', bodyKey: 'account.items.business.body' }] : []),
    ...(betaFeatures.walletVisible ? [{ href: '/account/wallet', titleKey: 'account.items.wallet.title', bodyKey: 'account.items.wallet.body' }] : []),
    ...(betaFeatures.payoutsVisible ? [{ href: '/account/payouts', titleKey: 'account.items.payouts.title', bodyKey: 'account.items.payouts.body' }] : []),
    { href: '/account/settings', titleKey: 'account.items.settings.title', bodyKey: 'account.items.settings.body', icon: 'settings' },
    { href: '/legal', titleKey: 'account.items.legal.title', bodyKey: 'account.items.legal.body', icon: 'warning', publicAccess: true },
    { href: '/account/support', titleKey: 'account.items.support.title', bodyKey: 'account.items.support.body', icon: 'help' },
    { href: '/account/delete', titleKey: 'account.items.delete.title', bodyKey: 'account.items.delete.body', icon: 'warning' },
  ], []);

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

  useEffect(() => {
    let mounted = true;
    async function loadNotificationPreview() {
      if (!auth.hydrated || !auth.isAuthenticated) {
        if (mounted) setNotificationUnreadCount(0);
        return;
      }
      try {
        const response = await api.notifications.unreadCount();
        if (mounted) setNotificationUnreadCount(response.unreadCount ?? 0);
      } catch {
        if (mounted) setNotificationUnreadCount(0);
      }
    }
    void loadNotificationPreview();
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
            <span className="semantic-badge instruction">{t('common.states.signedIn')}</span>
            <h2>{auth.user?.profile?.displayName ?? auth.user?.email}</h2>
            <p>{auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : t('account.addHandleOnProfile')}</p>
          </div>
        </section>
      ) : auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
          <h3>{t('account.signedOut.title')}</h3>
          <p>{t('account.signedOut.body')}</p>
          <Link href="/auth?next=/account" className="button primary">{t('common.actions.loginOrRegister')}</Link>
        </section>
      ) : null}

      {auth.isAuthenticated && (betaFeatures.walletVisible || betaFeatures.payoutsVisible) ? (
        <section className="wallet-preview-strip">
          <div>
            <span>{t('account.walletMoney')}</span>
            <strong>{formatMoney(wallet?.availableBalanceCents ?? 0, currency)}</strong>
          </div>
          <div>
            <span>{t('account.availableEarnings')}</span>
            <strong>{formatMoney(wallet?.pendingPayoutCents ?? summary?.availableForPayoutCents ?? 0, currency)}</strong>
            <small>{t('account.payoutFee', { rate: formatPayoutFeeRate(platformFeeRateBps) })}</small>
          </div>
        </section>
      ) : null}

      <div className="mobile-list">
        {accountItems.map((item) => {
          const href = auth.hydrated && !auth.isAuthenticated && !item.publicAccess ? `/auth?next=${encodeURIComponent(item.href)}` : item.href;
          return (
            <Link key={item.href} href={href} className="mobile-link-card">
              {item.icon ? <WebIcon name={item.icon} size={22} decorative className="mobile-link-card__icon" /> : null}
              <span className="mobile-link-card__body">
                <strong>{t(item.titleKey)}</strong>
                <br />
                {t(item.bodyKey)}
              </span>
              {item.href === '/account/notifications' && notificationUnreadCount > 0 ? (
                <span className="semantic-badge proposal mobile-link-card__meta-badge">{notificationUnreadCount}</span>
              ) : null}
              <WebIcon name="arrow-right" size={17} decorative className="mobile-link-card__arrow" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
