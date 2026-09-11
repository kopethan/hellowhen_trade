import { normalAppNavItems, type NormalAppNavItemId } from '@hellowhen/shared';

export type RootTabKey = 'trades' | 'needs' | 'offers' | 'account' | 'plans' | 'explore' | 'trade';

export type WebTab = {
  key: RootTabKey;
  labelKey: string;
  href: string;
  icon: 'calendar' | 'compass' | 'plan' | 'trade' | 'need' | 'offer' | 'profile' | 'search';
  match: (pathname: string) => boolean;
};

export type WebHeaderOwner = 'shell' | 'page';

export type WebRouteHeader = {
  match: (pathname: string) => boolean;
  titleKey: string;
  root?: boolean;
  backHref?: string;
  owner?: WebHeaderOwner;
};

export const webTabs: WebTab[] = [
  {
    key: 'trades',
    labelKey: 'navigation.tabs.trades',
    href: '/trades',
    icon: 'trade',
    match: (pathname) => pathname === '/' || pathname.startsWith('/trades') || pathname.startsWith('/users'),
  },
  {
    key: 'needs',
    labelKey: 'navigation.tabs.needs',
    href: '/needs',
    icon: 'need',
    match: (pathname) => pathname.startsWith('/needs'),
  },
  {
    key: 'offers',
    labelKey: 'navigation.tabs.offers',
    href: '/offers',
    icon: 'offer',
    match: (pathname) => pathname.startsWith('/offers'),
  },
  {
    key: 'account',
    labelKey: 'navigation.tabs.account',
    href: '/account',
    icon: 'profile',
    match: (pathname) => pathname === '/me' || pathname.startsWith('/account') || pathname.startsWith('/legal'),
  },
];

const normalNavMatchById: Record<NormalAppNavItemId, WebTab['match']> = {
  plans: (pathname) => pathname.startsWith('/plans') || pathname.startsWith('/places'),
  explore: (pathname) => pathname === '/explore' || pathname.startsWith('/explore/'),
  trade: (pathname) => pathname === '/' || pathname.startsWith('/trades') || pathname.startsWith('/users') || pathname.startsWith('/u/') || pathname.startsWith('/needs') || pathname.startsWith('/offers'),
};

export const normalWebTabs: WebTab[] = normalAppNavItems.map((item) => ({
  key: item.id,
  labelKey: item.labelKey,
  href: item.webHref,
  icon: item.icon,
  match: normalNavMatchById[item.id],
}));

export function getWebTabs(usePlansMeTradeNav = false) {
  return usePlansMeTradeNav ? normalWebTabs : webTabs;
}

export const utilityRoutePrefixes = ['/auth', '/admin', '/reset-password', '/credits', '/onboarding-guide', '/guide'];

export function isWebThreadRoute(pathname: string) {
  return /^\/trades\/[^/]+\/discussion$/.test(pathname)
    || /^\/trades\/[^/]+\/proposals(?:\/[^/]+)?$/.test(pathname)
    || /^\/plans\/[^/]+\/discussion$/.test(pathname);
}

export function isUtilityRoute(pathname: string) {
  return utilityRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const routeTitles: WebRouteHeader[] = [
  // The three primary worlds render their own in-page world headers. The shell still
  // owns the desktop global navigation, but should not duplicate those titles on mobile.
  { match: (pathname) => pathname === '/' || pathname === '/trades', titleKey: 'navigation.routes.trades', root: true, owner: 'page' },
  { match: (pathname) => pathname === '/plans', titleKey: 'navigation.routes.plans', root: true, owner: 'page' },
  { match: (pathname) => pathname === '/explore', titleKey: 'navigation.routes.explore', root: true, owner: 'page' },

  // Root inventory/account destinations still rely on the shell header.
  { match: (pathname) => pathname === '/needs', titleKey: 'navigation.routes.needs', root: true, owner: 'shell' },
  { match: (pathname) => pathname === '/offers', titleKey: 'navigation.routes.offers', root: true, owner: 'shell' },
  { match: (pathname) => pathname === '/account' || pathname === '/me', titleKey: 'navigation.routes.account', root: true, owner: 'shell' },

  // Explore detail pages own their back/title treatment.
  { match: (pathname) => /^\/explore\/needs\/[^/]+$/.test(pathname), titleKey: 'common.exploreDiscovery.needBadge', backHref: '/explore', owner: 'page' },
  { match: (pathname) => /^\/explore\/offers\/[^/]+$/.test(pathname), titleKey: 'common.exploreDiscovery.offerBadge', backHref: '/explore', owner: 'page' },
  { match: (pathname) => /^\/explore\/places\/[^/]+$/.test(pathname), titleKey: 'common.exploreDiscovery.placeBadge', backHref: '/explore', owner: 'page' },

  // Plan surfaces with their own navigation chrome.
  { match: (pathname) => pathname === '/plans/filter', titleKey: 'navigation.routes.plans', backHref: '/plans', owner: 'page' },
  { match: (pathname) => pathname === '/plans/new', titleKey: 'navigation.routes.createPlan', backHref: '/plans', owner: 'page' },
  { match: (pathname) => /^\/plans\/ideas\/[^/]+$/.test(pathname), titleKey: 'plans.ideaDetail.title', backHref: '/plans', owner: 'page' },
  { match: (pathname) => /^\/plans\/[^/]+\/edit$/.test(pathname), titleKey: 'navigation.routes.editPlan', backHref: '/plans', owner: 'page' },
  { match: (pathname) => /^\/plans\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.plan', backHref: '/plans', owner: 'page' },

  // Trade surfaces with their own toolbar/wizard/page intro.
  { match: (pathname) => pathname === '/trades/filter', titleKey: 'navigation.routes.trade', backHref: '/trades', owner: 'page' },
  { match: (pathname) => pathname === '/trades/create', titleKey: 'navigation.routes.createTrade', backHref: '/trades', owner: 'page' },
  { match: (pathname) => pathname === '/trades/create/full', titleKey: 'navigation.routes.createTrade', backHref: '/trades', owner: 'page' },
  { match: (pathname) => /^\/trades\/create\/choose-(?:need|offer)(?:-source)?$/.test(pathname), titleKey: 'navigation.routes.createTrade', backHref: '/trades/create', owner: 'page' },
  { match: (pathname) => /^\/trades\/create\/choose-(?:need|offer)\/new$/.test(pathname), titleKey: 'navigation.routes.createTrade', backHref: '/trades/create', owner: 'page' },
  { match: (pathname) => /^\/trades\/create\/choose-need\/new\/full$/.test(pathname), titleKey: 'navigation.routes.createNeed', backHref: '/trades/create', owner: 'shell' },
  { match: (pathname) => /^\/trades\/create\/choose-offer\/new\/full$/.test(pathname), titleKey: 'navigation.routes.createOffer', backHref: '/trades/create', owner: 'shell' },
  { match: (pathname) => /^\/trades\/ideas\/[^/]+$/.test(pathname), titleKey: 'trade.ideaDetail.header', backHref: '/trades', owner: 'page' },
  { match: (pathname) => /^\/trades\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.trade', backHref: '/trades', owner: 'page' },

  // Proposal side pickers render their own PageIntro/back actions. Full inventory forms
  // do not, so those keep a shell-owned header.
  { match: (pathname) => /^\/trades\/[^/]+\/(?:propose|proposals\/[^/]+)\/choose-(?:need|offer)\/new\/full$/.test(pathname), titleKey: 'navigation.routes.createTrade', backHref: '/trades', owner: 'shell' },
  { match: (pathname) => /^\/trades\/[^/]+\/(?:propose|proposals\/[^/]+)\/choose-(?:need|offer)(?:\/new)?$/.test(pathname), titleKey: 'navigation.routes.trade', backHref: '/trades', owner: 'page' },

  // Inventory wizard vs full-form ownership.
  { match: (pathname) => pathname === '/needs/new', titleKey: 'navigation.routes.createNeed', backHref: '/needs', owner: 'page' },
  { match: (pathname) => pathname === '/needs/new/full', titleKey: 'navigation.routes.createNeed', backHref: '/needs', owner: 'shell' },
  { match: (pathname) => /^\/needs\/[^/]+\/edit$/.test(pathname), titleKey: 'navigation.routes.editNeed', backHref: '/needs', owner: 'shell' },
  { match: (pathname) => /^\/needs\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.need', backHref: '/needs', owner: 'shell' },
  { match: (pathname) => pathname === '/offers/new', titleKey: 'navigation.routes.createOffer', backHref: '/offers', owner: 'page' },
  { match: (pathname) => pathname === '/offers/new/full', titleKey: 'navigation.routes.createOffer', backHref: '/offers', owner: 'shell' },
  { match: (pathname) => /^\/offers\/[^/]+\/edit$/.test(pathname), titleKey: 'navigation.routes.editOffer', backHref: '/offers', owner: 'shell' },
  { match: (pathname) => /^\/offers\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.offer', backHref: '/offers', owner: 'shell' },

  // Places belong to the Plans world. The management page has its own intro/back action;
  // create/edit pages keep the shell back button because their local form has no toolbar.
  { match: (pathname) => pathname === '/places', titleKey: 'account.hub.myPlaces', backHref: '/plans', owner: 'page' },
  { match: (pathname) => pathname === '/places/new', titleKey: 'navigation.routes.createPlace', backHref: '/places', owner: 'shell' },
  { match: (pathname) => /^\/places\/[^/]+\/edit$/.test(pathname), titleKey: 'navigation.routes.editPlace', backHref: '/places', owner: 'shell' },

  // Public profile aliases should not fall back to a generic Hellowhen header.
  { match: (pathname) => /^\/users\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.profile', backHref: '/trades', owner: 'shell' },
  { match: (pathname) => /^\/u\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.profile', backHref: '/trades', owner: 'shell' },
  { match: (pathname) => /^\/b\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.profile', backHref: '/trades', owner: 'shell' },

  // Account children all return to Account unless they are a deeper settings/legal step.
  { match: (pathname) => pathname === '/account/membership', titleKey: 'navigation.routes.membership', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/profile', titleKey: 'navigation.routes.profile', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/settings', titleKey: 'navigation.routes.settings', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/security/password', titleKey: 'settings.security.changePasswordTitle', backHref: '/account/settings', owner: 'shell' },
  { match: (pathname) => pathname === '/account/agenda', titleKey: 'account.agenda.title', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/saved', titleKey: 'account.saved.title', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/notifications', titleKey: 'account.notifications.title', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/business', titleKey: 'account.business.title', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/pro/setup', titleKey: 'account.proOnboarding.title', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/delete', titleKey: 'account.deletion.web.title', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/wallet', titleKey: 'navigation.routes.account', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/wallet/add', titleKey: 'navigation.routes.account', backHref: '/account/wallet', owner: 'shell' },
  { match: (pathname) => pathname === '/account/payouts', titleKey: 'navigation.routes.account', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/account/support', titleKey: 'navigation.routes.support', backHref: '/account', owner: 'shell' },

  // Public support/legal destinations stay shell-owned and have explicit return paths.
  { match: (pathname) => pathname === '/support', titleKey: 'navigation.routes.support', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/legal', titleKey: 'navigation.routes.legal', backHref: '/account', owner: 'shell' },
  { match: (pathname) => pathname === '/legal/terms', titleKey: 'navigation.routes.terms', backHref: '/legal', owner: 'shell' },
  { match: (pathname) => pathname === '/legal/privacy', titleKey: 'navigation.routes.privacy', backHref: '/legal', owner: 'shell' },
  { match: (pathname) => pathname === '/legal/safety', titleKey: 'navigation.routes.safety', backHref: '/legal', owner: 'shell' },
  { match: (pathname) => pathname === '/legal/child-safety', titleKey: 'navigation.routes.safety', backHref: '/legal', owner: 'shell' },
  { match: (pathname) => pathname === '/legal/refund-dispute', titleKey: 'navigation.routes.refundDispute', backHref: '/legal', owner: 'shell' },
];

const fallbackRouteHeader: WebRouteHeader = {
  match: () => true,
  titleKey: 'navigation.routes.hellowhen',
  root: true,
  owner: 'shell',
};

export function getRouteHeader(pathname: string, options?: { plansMeTradeNav?: boolean }): WebRouteHeader {
  const route = routeTitles.find((candidate) => candidate.match(pathname)) ?? fallbackRouteHeader;
  if (!options?.plansMeTradeNav) return route;
  return route;
}

export function pageOwnsWebHeader(pathname: string, options?: { plansMeTradeNav?: boolean }) {
  return getRouteHeader(pathname, options).owner === 'page';
}
