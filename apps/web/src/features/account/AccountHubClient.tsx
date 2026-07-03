'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { WebIcon, type WebIconName } from '../../components/WebIcon';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { assetUrl } from './accountPresentation';

type AccountHubTone = 'danger' | 'info' | 'need' | 'offer' | 'plan' | 'proposal' | 'trade';

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
  tone?: AccountHubTone;
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
  const [accountCounts, setAccountCounts] = useState<AccountHubCounts>({});

  const displayName = auth.user?.profile?.displayName ?? auth.user?.email ?? t('navigation.tabs.me');
  const handle = auth.user?.profile?.handle ? `@${auth.user.profile.handle}` : null;

  const quickActionItems = useMemo<AccountHubItem[]>(() => [
    { href: '/trades/create', titleKey: 'account.quickActions.createTrade', bodyKey: 'account.quickActions.createTradeBody', icon: 'trade', featured: true, tone: 'trade' },
    ...(betaFeatures.plansVisible ? [
      { href: '/plans/new', titleKey: 'account.quickActions.createPlan', bodyKey: 'account.quickActions.createPlanBody', icon: 'plan' as WebIconName, featured: true, tone: 'plan' as AccountHubTone },
      { href: '/places/new', titleKey: 'account.quickActions.addPlace', bodyKey: 'account.quickActions.addPlaceBody', icon: 'location-on' as WebIconName, featured: true, tone: 'plan' as AccountHubTone },
    ] : [
      { href: '/needs/new', titleKey: 'trade.wizard.actions.createNeed.title', bodyKey: 'trade.wizard.actions.createNeed.body', icon: 'need' as WebIconName, featured: true, tone: 'need' as AccountHubTone },
      { href: '/offers/new', titleKey: 'trade.wizard.actions.createOffer.title', bodyKey: 'trade.wizard.actions.createOffer.body', icon: 'offer' as WebIconName, featured: true, tone: 'offer' as AccountHubTone },
    ]),
  ], []);

  const activityItems = useMemo<AccountHubItem[]>(() => [
    { href: '/trades', titleKey: 'trade.wizard.actions.myTrades.title', bodyKey: 'trade.wizard.actions.myTrades.body', icon: 'activity', count: accountCounts.trades, tone: 'trade' },
    { href: '/trades', titleKey: 'trade.wizard.actions.proposals.title', bodyKey: 'trade.wizard.actions.proposals.body', icon: 'proposal-accepted', tone: 'proposal' },
    { href: '/needs', titleKey: 'trade.wizard.actions.myNeeds.title', bodyKey: 'trade.wizard.actions.myNeeds.body', icon: 'need', count: accountCounts.needs, tone: 'need' },
    { href: '/offers', titleKey: 'trade.wizard.actions.myOffers.title', bodyKey: 'trade.wizard.actions.myOffers.body', icon: 'offer', count: accountCounts.offers, tone: 'offer' },
  ], [accountCounts.needs, accountCounts.offers, accountCounts.trades]);

  const planWorkspaceItems = useMemo<AccountHubItem[]>(() => betaFeatures.plansVisible ? [
    { href: '/plans?view=mine', titleKey: 'account.items.myPlansFeature.title', bodyKey: 'account.items.myPlansFeature.body', icon: 'plan', count: accountCounts.myPlans, tone: 'plan' },
    { href: '/plans?view=joined', titleKey: 'account.items.joinedPlansFeature.title', bodyKey: 'account.items.joinedPlansFeature.body', icon: 'proposal-accepted', count: accountCounts.joinedPlans, tone: 'info' },
    { href: '/plans', titleKey: 'account.items.plansFeature.title', bodyKey: 'account.items.plansFeature.body', icon: 'search', featured: true, badgeKey: 'account.items.plansFeature.badge', actionKey: 'account.items.plansFeature.action', tone: 'plan' },
    { href: '/places', titleKey: 'account.items.myPlacesFeature.title', bodyKey: 'account.items.myPlacesFeature.body', icon: 'location-on', count: accountCounts.places, tone: 'plan' },
  ] : [], [accountCounts.joinedPlans, accountCounts.myPlans, accountCounts.places]);

  const toolsItems = useMemo<AccountHubItem[]>(() => [
    ...(betaFeatures.savedLibraryEnabled ? [{ href: '/account/saved', titleKey: 'account.items.saved.title', bodyKey: 'account.items.saved.body', icon: 'save' as WebIconName, tone: 'info' as AccountHubTone }] : []),
    ...(betaFeatures.agendaEnabled ? [{ href: '/account/agenda', titleKey: 'account.items.agenda.title', bodyKey: 'account.items.agenda.body', icon: 'calendar' as WebIconName, tone: 'info' as AccountHubTone }] : []),
    { href: '/account/notifications', titleKey: 'account.items.notifications.title', bodyKey: 'account.items.notifications.body', icon: 'bell', count: notificationUnreadCount > 0 ? notificationUnreadCount : undefined, tone: 'proposal' },
    {
      href: '/guide',
      titleKey: 'account.items.guide.title',
      bodyKey: 'account.items.guide.body',
      icon: 'help',
      publicAccess: true,
      featured: true,
      badgeKey: 'account.items.guide.badge',
      actionKey: 'account.items.guide.action',
      tone: 'info',
    },
  ], [notificationUnreadCount]);

  const settingsItems = useMemo<AccountHubItem[]>(() => [
    { href: '/account/profile', titleKey: 'account.items.profile.title', bodyKey: 'account.items.profile.body', icon: 'profile', tone: 'info' },
    { href: '/account/membership', titleKey: 'account.items.membership.title', bodyKey: 'account.items.membership.body', icon: 'profile', tone: 'info' },
    ...(betaFeatures.businessAccountsVisible ? [{ href: '/account/business', titleKey: 'account.items.business.title', bodyKey: 'account.items.business.body', icon: 'profile' as WebIconName, tone: 'info' as AccountHubTone }] : []),
    ...(betaFeatures.walletVisible ? [{ href: '/account/wallet', titleKey: 'account.items.wallet.title', bodyKey: 'account.items.wallet.body', icon: 'calendar' as WebIconName, tone: 'info' as AccountHubTone }] : []),
    ...(betaFeatures.payoutsVisible ? [{ href: '/account/payouts', titleKey: 'account.items.payouts.title', bodyKey: 'account.items.payouts.body', icon: 'calendar' as WebIconName, tone: 'info' as AccountHubTone }] : []),
    { href: '/account/settings', titleKey: 'account.items.settings.title', bodyKey: 'account.items.settings.body', icon: 'settings', tone: 'info' },
    { href: '/legal', titleKey: 'account.items.legal.title', bodyKey: 'account.items.legal.body', icon: 'warning', publicAccess: true, tone: 'info' },
    { href: '/account/support', titleKey: 'account.items.support.title', bodyKey: 'account.items.support.body', icon: 'help', tone: 'info' },
    { href: '/account/delete', titleKey: 'account.items.delete.title', bodyKey: 'account.items.delete.body', icon: 'warning', tone: 'danger' },
  ], []);

  const statItems = useMemo<AccountHubItem[]>(() => [
    { href: '/trades', titleKey: 'trade.wizard.actions.myTrades.title', bodyKey: 'trade.wizard.actions.myTrades.body', icon: 'trade', count: accountCounts.trades, tone: 'trade' },
    { href: '/needs', titleKey: 'trade.wizard.actions.myNeeds.title', bodyKey: 'trade.wizard.actions.myNeeds.body', icon: 'need', count: accountCounts.needs, tone: 'need' },
    { href: '/offers', titleKey: 'trade.wizard.actions.myOffers.title', bodyKey: 'trade.wizard.actions.myOffers.body', icon: 'offer', count: accountCounts.offers, tone: 'offer' },
    ...(betaFeatures.plansVisible ? [{ href: '/plans?view=mine', titleKey: 'account.items.myPlansFeature.title', bodyKey: 'account.items.myPlansFeature.body', icon: 'plan' as WebIconName, count: accountCounts.myPlans, tone: 'plan' as AccountHubTone }] : []),
  ], [accountCounts.myPlans, accountCounts.needs, accountCounts.offers, accountCounts.trades]);

  const widgetToolItem = betaFeatures.agendaEnabled
    ? { href: '/account/agenda', titleKey: 'account.widgets.library.title', bodyKey: 'account.widgets.library.agendaBody', icon: 'calendar' as WebIconName, tone: 'info' as AccountHubTone, actionKey: 'account.widgets.library.agendaAction' }
    : betaFeatures.savedLibraryEnabled
      ? { href: '/account/saved', titleKey: 'account.widgets.library.title', bodyKey: 'account.widgets.library.savedBody', icon: 'save' as WebIconName, tone: 'info' as AccountHubTone, actionKey: 'account.widgets.library.savedAction' }
      : null;

  const [primaryQuickAction, ...secondaryQuickActions] = quickActionItems;

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
    <div className="me-hub-page">
      <section className={auth.isAuthenticated ? 'me-hub-hero me-hub-hero--signed-in' : 'me-hub-hero'}>
        <div className="me-hub-hero__identity">
          <div className="account-avatar account-avatar--large" aria-hidden="true">
            {auth.user?.profile?.avatarUrl ? <img src={assetUrl(auth.user.profile.avatarUrl)} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="me-hub-hero__copy">
            <span className="semantic-badge instruction">{t('navigation.tabs.me')}</span>
            <h1>{auth.isAuthenticated ? displayName : t('account.signedOut.title')}</h1>
            <p>{auth.isAuthenticated ? (handle ?? auth.user?.email ?? t('account.body')) : t('account.signedOut.body')}</p>
          </div>
        </div>
        {auth.hydrated ? (
          auth.isAuthenticated ? (
            <div className="me-hub-hero__actions">
              <Link href="/account/profile" className="button secondary">{t('account.quickActions.editProfile')}</Link>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void auth.logout().then(() => router.push('/auth'));
                }}
              >
                {t('common.actions.logout')}
              </button>
            </div>
          ) : (
            <div className="me-hub-hero__actions">
              <Link href="/auth?next=/account" className="button primary">{t('common.actions.loginOrRegister')}</Link>
              <Link href="/legal" className="button secondary">{t('account.items.legal.title')}</Link>
            </div>
          )
        ) : (
          <p className="me-hub-hero__loading">{t('auth.session.checkingBody')}</p>
        )}
      </section>

      {auth.isAuthenticated ? (
        <section className="me-hub-overview" aria-label={t('account.sections.activity')}>
          <div className="me-hub-stat-grid">
            {statItems.map((item) => <MeHubStatCard key={item.href + item.titleKey} item={item} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} />)}
          </div>
        </section>
      ) : null}

      <div className={auth.isAuthenticated ? 'me-hub-action-zone' : 'me-hub-action-zone me-hub-action-zone--single'}>
        {auth.isAuthenticated ? (
          <section className="me-hub-widget-strip" aria-label={t('account.widgets.title')}>
            <MeHubWidgetCard
              badge={t('account.widgets.today.badge')}
              title={t('account.widgets.today.title')}
              body={notificationUnreadCount > 0 ? t('account.widgets.today.notificationsBody') : t('account.widgets.today.body')}
              href={notificationUnreadCount > 0 ? '/account/notifications' : '/trades/create'}
              action={notificationUnreadCount > 0 ? t('account.widgets.today.notificationsAction') : t('account.widgets.today.action')}
              icon={notificationUnreadCount > 0 ? 'bell' : 'clock'}
              metric={notificationUnreadCount > 0 ? notificationUnreadCount : undefined}
              tone={notificationUnreadCount > 0 ? 'proposal' : 'trade'}
            />
            <MeHubWidgetCard
              badge={t('account.widgets.attention.badge')}
              title={t('account.widgets.attention.title')}
              body={notificationUnreadCount > 0 ? t('account.widgets.attention.withNotifications') : t('account.widgets.attention.body')}
              href={notificationUnreadCount > 0 ? '/account/notifications' : '/trades'}
              action={t('account.widgets.attention.action')}
              icon="activity"
              metric={notificationUnreadCount > 0 ? notificationUnreadCount : accountCounts.trades}
              tone={notificationUnreadCount > 0 ? 'proposal' : 'trade'}
            />
            {widgetToolItem ? (
              <MeHubWidgetCard
                badge={t('account.widgets.library.badge')}
                title={t(widgetToolItem.titleKey)}
                body={t(widgetToolItem.bodyKey)}
                href={widgetToolItem.href}
                action={widgetToolItem.actionKey ? t(widgetToolItem.actionKey) : t('account.widgets.library.savedAction')}
                icon={widgetToolItem.icon ?? 'save'}
                tone={widgetToolItem.tone}
              />
            ) : null}
          </section>
        ) : null}

        <section className="account-hub-section me-hub-section me-hub-section--quick" aria-label={t('account.quickActions.title')}>
          <div className="account-hub-section__header me-hub-section__header">
            <div>
              <span className="semantic-badge trade">{t('account.quickActions.title')}</span>
              <h2>{t('account.quickActions.title')}</h2>
            </div>
            <p>{t('account.quickActions.body')}</p>
          </div>
          <div className="me-hub-quick-actions">
            {primaryQuickAction ? (
              <AccountHubLinkCard item={primaryQuickAction} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} quick quickVariant="primary" />
            ) : null}
            {secondaryQuickActions.length > 0 ? (
              <div className="account-quick-action-grid me-hub-quick-grid">
                {secondaryQuickActions.map((item) => <AccountHubLinkCard key={item.href} item={item} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} quick quickVariant="compact" />)}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="me-hub-layout">
        <div className="me-hub-layout__primary">
          <MeHubSection title={t('account.sections.activity')} items={activityItems} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} />
        </div>
        <div className="me-hub-layout__secondary">
          {planWorkspaceItems.length > 0 ? <MeHubSection title={t('account.sections.plans')} badge={t('account.items.plansFeature.badge')} items={planWorkspaceItems} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} /> : null}
          <MeHubSection title={t('account.sections.tools')} items={toolsItems} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} />
        </div>
        <div className="me-hub-layout__quiet">
          <MeHubSection title={t('account.sections.settings')} items={settingsItems} authHydrated={auth.hydrated} isAuthenticated={auth.isAuthenticated} t={t} quiet />
        </div>
      </div>
    </div>
  );
}

function MeHubWidgetCard({ badge, title, body, href, action, icon, metric, tone = 'info' }: { badge: string; title: string; body: string; href: string; action: string; icon: WebIconName; metric?: number; tone?: AccountHubTone }) {
  return (
    <Link href={href} className={`me-hub-widget-card me-hub-widget-card--${tone}`}>
      <span className="me-hub-widget-card__topline">
        <span className="semantic-badge instruction">{badge}</span>
        {typeof metric === 'number' ? <span className="me-hub-widget-card__metric">{Math.min(metric, 99)}</span> : null}
      </span>
      <span className="me-hub-widget-card__body">
        <WebIcon name={icon} size={22} decorative className="me-hub-widget-card__icon" />
        <span>
          <strong>{title}</strong>
          <small>{body}</small>
        </span>
      </span>
      <span className="me-hub-widget-card__action">
        {action}
        <WebIcon name="arrow-right" size={15} decorative />
      </span>
    </Link>
  );
}

function MeHubSection({ title, badge, items, authHydrated, isAuthenticated, t, quiet = false }: { title: string; badge?: string; items: AccountHubItem[]; authHydrated: boolean; isAuthenticated: boolean; t: (key: string) => string; quiet?: boolean }) {
  return (
    <section className={`account-hub-section me-hub-section${quiet ? ' me-hub-section--quiet' : ''}`} aria-label={title}>
      <div className="account-hub-section__header me-hub-section__header">
        <div>
          {badge ? <span className="semantic-badge instruction">{badge}</span> : null}
          <h2>{title}</h2>
        </div>
      </div>
      <div className="mobile-list me-hub-list">
        {items.map((item) => <AccountHubLinkCard key={item.href + item.titleKey} item={item} authHydrated={authHydrated} isAuthenticated={isAuthenticated} t={t} />)}
      </div>
    </section>
  );
}

function MeHubStatCard({ item, authHydrated, isAuthenticated, t }: { item: AccountHubItem; authHydrated: boolean; isAuthenticated: boolean; t: (key: string) => string }) {
  const href = authHydrated && !isAuthenticated && !item.publicAccess ? `/auth?next=${encodeURIComponent(item.href)}` : item.href;
  return (
    <Link href={href} className={`me-hub-stat-card me-hub-stat-card--${item.tone ?? 'info'}`}>
      {item.icon ? <WebIcon name={item.icon} size={18} decorative className="me-hub-stat-card__icon" /> : null}
      <span>
        <strong>{typeof item.count === 'number' ? Math.min(item.count, 99) : '—'}</strong>
        <small>{t(item.titleKey)}</small>
        <small className="me-hub-stat-card__hint">{t(item.bodyKey)}</small>
      </span>
    </Link>
  );
}

function AccountHubLinkCard({ item, authHydrated, isAuthenticated, t, quick = false, quickVariant }: { item: AccountHubItem; authHydrated: boolean; isAuthenticated: boolean; t: (key: string) => string; quick?: boolean; quickVariant?: 'primary' | 'compact' }) {
  const href = authHydrated && !isAuthenticated && !item.publicAccess ? `/auth?next=${encodeURIComponent(item.href)}` : item.href;
  const className = [
    item.featured ? 'mobile-link-card mobile-link-card--featured' : 'mobile-link-card',
    quick ? 'account-quick-action-card' : null,
    quickVariant ? `account-quick-action-card--${quickVariant}` : null,
    'me-hub-link-card',
    `me-hub-link-card--${item.tone ?? 'info'}`,
  ].filter(Boolean).join(' ');
  return (
    <Link href={href} className={className}>
      {item.icon ? <WebIcon name={item.icon} size={item.featured ? 24 : 22} decorative className="mobile-link-card__icon" /> : null}
      <span className="mobile-link-card__body">
        <span className="mobile-link-card__title-row">
          <strong>{t(item.titleKey)}</strong>
          {item.badgeKey ? <span className="semantic-badge instruction">{t(item.badgeKey)}</span> : null}
        </span>
        <span className="me-hub-link-card__body-text">{t(item.bodyKey)}</span>
      </span>
      {typeof item.count === 'number' ? (
        <span className="semantic-badge proposal mobile-link-card__meta-badge">{Math.min(item.count, 99)}</span>
      ) : null}
      {item.actionKey ? <span className="mobile-link-card__action-label">{t(item.actionKey)}</span> : null}
      <WebIcon name="arrow-right" size={17} decorative className="mobile-link-card__arrow" />
    </Link>
  );
}
