'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { WebAuthPanel } from '../../components/WebAuthPanel';
import { WebIcon } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { assetUrl } from './accountPresentation';

type AccountHubItem = {
  href: string;
  titleKey: string;
  descriptionKey?: string;
  count?: number;
  danger?: boolean;
};

type AccountHubCounts = {
  trades?: number;
  needs?: number;
  offers?: number;
  myPlans?: number;
  joinedPlans?: number;
  places?: number;
};

function countCollection(response: unknown, key: string) {
  if (!response || typeof response !== 'object') return undefined;
  const value = (response as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : undefined;
}

export function AccountHubClient() {
  const auth = useWebAuth();
  const router = useRouter();
  const { t } = useWebTranslation();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [counts, setCounts] = useState<AccountHubCounts>({});

  const displayName = auth.user?.profile?.displayName || auth.user?.profile?.handle || auth.user?.email || t('navigation.tabs.account');
  const handle = auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : t('account.addHandle');

  useEffect(() => {
    let current = true;
    async function load() {
      if (!auth.hydrated || !auth.isAuthenticated || !auth.user?.id) {
        if (current) {
          setNotificationUnreadCount(0);
          setCounts({});
        }
        return;
      }
      const [notifications, trades, needs, offers, myPlans, joinedPlans, places] = await Promise.all([
        api.notifications.unreadCount().then((response) => response.unreadCount ?? 0).catch(() => 0),
        api.trades.mine({ scope: 'created' }).then((response) => countCollection(response, 'trades')).catch(() => undefined),
        api.needs.mine().then((response) => countCollection(response, 'needs')).catch(() => undefined),
        api.offers.mine().then((response) => countCollection(response, 'offers')).catch(() => undefined),
        betaFeatures.plansVisible ? api.plans.mine().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
        betaFeatures.plansVisible ? api.plans.joined().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
        betaFeatures.plansVisible ? api.places.mine({ take: 100 }).then((response) => countCollection(response, 'places')).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      if (!current) return;
      setNotificationUnreadCount(notifications);
      setCounts({ trades, needs, offers, myPlans, joinedPlans, places });
    }
    void load();
    return () => { current = false; };
  }, [auth.hydrated, auth.isAuthenticated, auth.user?.id]);

  const planItems = useMemo<AccountHubItem[]>(() => betaFeatures.plansVisible ? [
    { href: '/plans?view=mine', titleKey: 'account.items.myPlansFeature.title', count: counts.myPlans },
    { href: '/plans?view=joined', titleKey: 'account.items.joinedPlansFeature.title', count: counts.joinedPlans },
    { href: '/places', titleKey: 'account.hub.myPlaces', count: counts.places },
  ] : [], [counts.joinedPlans, counts.myPlans, counts.places]);

  const tradeItems = useMemo<AccountHubItem[]>(() => [
    { href: '/trades?activity=mine', titleKey: 'trade.wizard.actions.myTrades.title', count: counts.trades },
    { href: '/trades?activity=involved', titleKey: 'trade.wizard.actions.proposals.title' },
    { href: '/needs', titleKey: 'trade.wizard.actions.myNeeds.title', count: counts.needs },
    { href: '/offers', titleKey: 'trade.wizard.actions.myOffers.title', count: counts.offers },
  ], [counts.needs, counts.offers, counts.trades]);

  const toolItems = useMemo<AccountHubItem[]>(() => [
    ...(betaFeatures.savedLibraryEnabled ? [{ href: '/account/saved', titleKey: 'account.items.saved.title' }] : []),
    ...(betaFeatures.agendaEnabled ? [{ href: '/account/agenda', titleKey: 'account.items.agenda.title' }] : []),
    { href: '/account/notifications', titleKey: 'account.items.notifications.title', count: notificationUnreadCount || undefined },
    { href: '/guide', titleKey: 'account.items.guide.title' },
  ], [notificationUnreadCount]);

  const settingItems = useMemo<AccountHubItem[]>(() => [
    { href: '/account/settings', titleKey: 'account.items.settings.title', descriptionKey: 'account.hub.settingsSummary' },
    { href: '/legal/safety', titleKey: 'account.items.safety.title' },
    { href: '/account/support', titleKey: 'account.items.support.title' },
    { href: '/legal', titleKey: 'account.items.legal.title' },
    { href: '/account/delete', titleKey: 'account.items.delete.title', danger: true },
  ], []);

  const futureItems = useMemo<AccountHubItem[]>(() => [
    ...(betaFeatures.plusSubscriptionFeatures.plusPublic ? [{ href: '/account/membership', titleKey: 'account.items.membership.title' }] : []),
    ...(betaFeatures.businessAccountsVisible ? [{ href: '/account/business', titleKey: 'account.items.business.title' }] : []),
    ...(betaFeatures.walletVisible ? [{ href: '/account/wallet', titleKey: 'account.items.wallet.title' }] : []),
    ...(betaFeatures.payoutsVisible ? [{ href: '/account/payouts', titleKey: 'account.items.payouts.title' }] : []),
  ], []);

  if (!auth.hydrated) {
    return <div className="account-hub-v2 account-hub-v2--loading"><p>{t('auth.session.checkingBody')}</p></div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="account-hub-v2 account-hub-v2--signed-out">
        <section className="account-hub-v2__signed-out-copy">
          <h2>{t('account.signedOut.title')}</h2>
          <p>{t('account.signedOut.body')}</p>
        </section>
        <WebAuthPanel redirectTo="/account" />
        <Link href="/legal" className="account-hub-v2__legal-link">{t('account.items.legal.title')} <WebIcon name="arrow-right" size={15} decorative /></Link>
      </div>
    );
  }

  return (
    <div className="account-hub-v2">
      <p className="account-hub-v2__intro">{t('account.headerBody')}</p>

      <AccountHubSection title={t('account.hub.profile')}>
        <Link href="/account/profile" className="account-profile-row">
          <span className="account-avatar account-avatar--large" aria-hidden="true">
            {auth.user?.profile?.avatarUrl ? <img src={assetUrl(auth.user.profile.avatarUrl)} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          </span>
          <span className="account-profile-row__copy">
            <strong>{displayName}</strong>
            <small>{handle}</small>
            <small>{t('account.context.personal')} · {t('account.hub.publicProfile')}</small>
          </span>
          <WebIcon name="arrow-right" size={17} decorative />
        </Link>
      </AccountHubSection>

      {planItems.length ? <AccountHubSection title={t('account.sections.plans')} items={planItems} /> : null}
      <AccountHubSection title={t('navigation.tabs.trade')} items={tradeItems} />
      <AccountHubSection title={t('account.sections.tools')} items={toolItems} />
      <AccountHubSection title={t('account.sections.settings')} items={settingItems} />
      {futureItems.length ? <AccountHubSection title={t('account.sections.future')} items={futureItems} /> : null}

      <button
        type="button"
        className="account-hub-v2__logout"
        onClick={() => { void auth.logout().finally(() => router.push('/auth')); }}
      >
        {t('common.actions.logout')}
      </button>
    </div>
  );
}

function AccountHubSection({ title, items, children }: { title: string; items?: AccountHubItem[]; children?: ReactNode }) {
  return (
    <section className="account-hub-v2__section" aria-label={title}>
      <h2>{title}</h2>
      <div className="account-hub-v2__list">
        {children}
        {items?.map((item) => <AccountHubRow key={`${item.href}-${item.titleKey}`} item={item} />)}
      </div>
    </section>
  );
}

function AccountHubRow({ item }: { item: AccountHubItem }) {
  const { t } = useWebTranslation();
  return (
    <Link href={item.href} className={item.danger ? 'account-hub-v2__row is-danger' : 'account-hub-v2__row'}>
      <span className="account-hub-v2__row-copy">
        <strong>{t(item.titleKey)}</strong>
        {item.descriptionKey ? <small>{t(item.descriptionKey)}</small> : null}
      </span>
      <span className="account-hub-v2__row-end">
        {typeof item.count === 'number' ? <span className="account-hub-v2__count">{Math.min(item.count, 99)}</span> : null}
        <WebIcon name="arrow-right" size={17} decorative />
      </span>
    </Link>
  );
}
