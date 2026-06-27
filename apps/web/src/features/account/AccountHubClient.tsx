'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { assetUrl } from './accountPresentation';



type AccountHubItem = {
  href: string;
  titleKey: string;
  bodyKey: string;
  icon?: WebIconName;
  publicAccess?: boolean;
  featured?: boolean;
  badgeKey?: string;
  actionKey?: string;
  count?: number;
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
  const { t } = useWebTranslation();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [accountCounts, setAccountCounts] = useState<AccountHubCounts>({});

  const quickActionItems = useMemo<AccountHubItem[]>(() => [
    { href: '/trades/create', titleKey: 'account.quickActions.createTrade', bodyKey: 'account.quickActions.createTradeBody', icon: 'trade', featured: true },
    ...(betaFeatures.plansVisible ? [
      { href: '/plans/new', titleKey: 'account.quickActions.createPlan', bodyKey: 'account.quickActions.createPlanBody', icon: 'calendar' as WebIconName, featured: true },
      { href: '/places/new', titleKey: 'account.quickActions.addPlace', bodyKey: 'account.quickActions.addPlaceBody', icon: 'add' as WebIconName, featured: true },
    ] : [
      { href: '/needs/new', titleKey: 'trade.wizard.actions.createNeed.title', bodyKey: 'trade.wizard.actions.createNeed.body', icon: 'need' as WebIconName, featured: true },
      { href: '/offers/new', titleKey: 'trade.wizard.actions.createOffer.title', bodyKey: 'trade.wizard.actions.createOffer.body', icon: 'offer' as WebIconName, featured: true },
    ]),
  ], []);

  const activityItems = useMemo<AccountHubItem[]>(() => [
    { href: '/trades', titleKey: 'trade.wizard.actions.myTrades.title', bodyKey: 'trade.wizard.actions.myTrades.body', icon: 'activity', count: accountCounts.trades },
    { href: '/needs', titleKey: 'trade.wizard.actions.myNeeds.title', bodyKey: 'trade.wizard.actions.myNeeds.body', icon: 'need', count: accountCounts.needs },
    { href: '/offers', titleKey: 'trade.wizard.actions.myOffers.title', bodyKey: 'trade.wizard.actions.myOffers.body', icon: 'offer', count: accountCounts.offers },
  ], [accountCounts.needs, accountCounts.offers, accountCounts.trades]);

  const planWorkspaceItems = useMemo<AccountHubItem[]>(() => betaFeatures.plansVisible ? [
    { href: '/plans', titleKey: 'account.items.plansFeature.title', bodyKey: 'account.items.plansFeature.body', icon: 'calendar', featured: true, badgeKey: 'account.items.plansFeature.badge', actionKey: 'account.items.plansFeature.action' },
    { href: '/plans?view=mine', titleKey: 'account.items.myPlansFeature.title', bodyKey: 'account.items.myPlansFeature.body', icon: 'activity', count: accountCounts.myPlans },
    { href: '/plans?view=joined', titleKey: 'account.items.joinedPlansFeature.title', bodyKey: 'account.items.joinedPlansFeature.body', icon: 'proposal-accepted', count: accountCounts.joinedPlans },
    { href: '/plans/new', titleKey: 'account.items.createPlanFeature.title', bodyKey: 'account.items.createPlanFeature.body', icon: 'add' },
    { href: '/places/new', titleKey: 'account.items.createPlaceFeature.title', bodyKey: 'account.items.createPlaceFeature.body', icon: 'add' },
  ] : [], [accountCounts.joinedPlans, accountCounts.myPlans]);

  const accountItems = useMemo<AccountHubItem[]>(() => [
    { href: '/account/profile', titleKey: 'account.items.profile.title', bodyKey: 'account.items.profile.body', icon: 'profile' },
    ...(betaFeatures.savedLibraryEnabled ? [{ href: '/account/saved', titleKey: 'account.items.saved.title', bodyKey: 'account.items.saved.body', icon: 'save' as WebIconName }] : []),
    ...(betaFeatures.agendaEnabled ? [{ href: '/account/agenda', titleKey: 'account.items.agenda.title', bodyKey: 'account.items.agenda.body', icon: 'calendar' as WebIconName }] : []),
    { href: '/account/membership', titleKey: 'account.items.membership.title', bodyKey: 'account.items.membership.body', icon: 'profile' },
    { href: '/account/notifications', titleKey: 'account.items.notifications.title', bodyKey: 'account.items.notifications.body', icon: 'bell' },
    {
      href: '/onboarding-guide?replay=1&next=/account',
      titleKey: 'account.items.guide.title',
      bodyKey: 'account.items.guide.body',
      icon: 'help',
      publicAccess: true,
      featured: true,
      badgeKey: 'account.items.guide.badge',
      actionKey: 'account.items.guide.action',
    },
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

  useEffect(() => {
    let mounted = true;
    async function loadAccountCounts() {
      if (!auth.hydrated || !auth.isAuthenticated) {
        if (mounted) setAccountCounts({});
        return;
      }
      const [trades, needs, offers, myPlans, joinedPlans, places] = await Promise.all([
        api.trades.mine({ scope: 'created' }).then((response) => countCollection(response, 'trades')).catch(() => undefined),
        api.needs.mine().then((response) => countCollection(response, 'needs')).catch(() => undefined),
        api.offers.mine().then((response) => countCollection(response, 'offers')).catch(() => undefined),
        betaFeatures.plansVisible ? api.plans.mine().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
        betaFeatures.plansVisible ? api.plans.joined().then((response) => countCollection(response, 'plans')).catch(() => undefined) : Promise.resolve(undefined),
        betaFeatures.plansVisible ? api.places.mine({ take: 100 }).then((response) => countCollection(response, 'places')).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      if (mounted) setAccountCounts({ trades, needs, offers, myPlans, joinedPlans, places });
    }
    void loadAccountCounts();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);


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

      <section className="account-hub-section" aria-label={t('account.quickActions.title')}>
        <div className="account-hub-section__header">
          <span className="semantic-badge trade">{t('account.quickActions.title')}</span>
          <p>{t('account.quickActions.body')}</p>
        </div>
        <div className="account-quick-action-grid">
          {quickActionItems.map((item) => <AccountHubLinkCard key={item.href} item={item} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} quick />)}
        </div>
      </section>

      <section className="account-hub-section" aria-label={t('account.sections.activity')}>
        <div className="account-hub-section__header">
          <h3>{t('account.sections.activity')}</h3>
        </div>
        <div className="mobile-list">
          {activityItems.map((item) => <AccountHubLinkCard key={item.href} item={item} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} />)}
        </div>
      </section>

      {planWorkspaceItems.length > 0 ? (
        <section className="account-hub-section" aria-label={t('account.sections.plans')}>
          <div className="account-hub-section__header">
            <span className="semantic-badge instruction">{t('account.items.plansFeature.badge')}</span>
            <h3>{t('account.sections.plans')}</h3>
          </div>
          <div className="mobile-list">
            {planWorkspaceItems.map((item) => <AccountHubLinkCard key={item.href} item={item} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} />)}
          </div>
        </section>
      ) : null}

      <div className="mobile-list">
        {accountItems.map((item) => <AccountHubLinkCard key={item.href} item={item.href === '/account/notifications' ? { ...item, count: notificationUnreadCount > 0 ? notificationUnreadCount : undefined } : item} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} />)}
      </div>
    </div>
  );
}


function AccountHubLinkCard({ item, authHydrated, isAuthenticated, t, quick = false }: { item: AccountHubItem; authHydrated: boolean; isAuthenticated: boolean; t: (key: string) => string; quick?: boolean }) {
  const href = authHydrated && !isAuthenticated && !item.publicAccess ? `/auth?next=${encodeURIComponent(item.href)}` : item.href;
  const className = [item.featured ? 'mobile-link-card mobile-link-card--featured' : 'mobile-link-card', quick ? 'account-quick-action-card' : null].filter(Boolean).join(' ');
  return (
    <Link href={href} className={className}>
      {item.icon ? <WebIcon name={item.icon} size={item.featured ? 24 : 22} decorative className="mobile-link-card__icon" /> : null}
      <span className="mobile-link-card__body">
        <span className="mobile-link-card__title-row">
          <strong>{t(item.titleKey)}</strong>
          {item.badgeKey ? <span className="semantic-badge instruction">{t(item.badgeKey)}</span> : null}
        </span>
        <br />
        {t(item.bodyKey)}
      </span>
      {typeof item.count === 'number' ? (
        <span className="semantic-badge proposal mobile-link-card__meta-badge">{Math.min(item.count, 99)}</span>
      ) : null}
      {item.actionKey ? <span className="mobile-link-card__action-label">{t(item.actionKey)}</span> : null}
      <WebIcon name="arrow-right" size={17} decorative className="mobile-link-card__arrow" />
    </Link>
  );
}
