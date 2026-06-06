export type RootTabKey = 'trades' | 'needs' | 'offers' | 'account';

export type WebTab = {
  key: RootTabKey;
  labelKey: string;
  href: string;
  icon: 'trade' | 'need' | 'offer' | 'profile';
  match: (pathname: string) => boolean;
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
    match: (pathname) => pathname.startsWith('/account') || pathname.startsWith('/legal'),
  },
];

export const utilityRoutePrefixes = ['/auth', '/admin', '/reset-password', '/credits', '/onboarding-guide'];

export function isUtilityRoute(pathname: string) {
  return utilityRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const routeTitles: Array<{ match: (pathname: string) => boolean; titleKey: string; root?: boolean; backHref?: string }> = [
  { match: (pathname) => pathname === '/' || pathname === '/trades', titleKey: 'navigation.routes.trades', root: true },
  { match: (pathname) => pathname === '/needs', titleKey: 'navigation.routes.needs', root: true },
  { match: (pathname) => pathname === '/offers', titleKey: 'navigation.routes.offers', root: true },
  { match: (pathname) => pathname === '/account', titleKey: 'navigation.routes.account', root: true },
  { match: (pathname) => pathname === '/plans', titleKey: 'navigation.routes.plans', root: true },
  { match: (pathname) => pathname === '/trades/create', titleKey: 'navigation.routes.createTrade', backHref: '/trades' },
  { match: (pathname) => pathname === '/plans/new', titleKey: 'navigation.routes.createPlan', backHref: '/plans' },
  { match: (pathname) => /^\/plans\/[^/]+\/edit$/.test(pathname), titleKey: 'navigation.routes.editPlan', backHref: '/plans' },
  { match: (pathname) => /^\/plans\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.plan', backHref: '/plans' },
  { match: (pathname) => /^\/users\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.profile', backHref: '/trades' },
  { match: (pathname) => /^\/trades\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.trade', backHref: '/trades' },
  { match: (pathname) => pathname === '/needs/new', titleKey: 'navigation.routes.createNeed', backHref: '/needs' },
  { match: (pathname) => /^\/needs\/[^/]+\/edit$/.test(pathname), titleKey: 'navigation.routes.editNeed', backHref: '/needs' },
  { match: (pathname) => /^\/needs\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.need', backHref: '/needs' },
  { match: (pathname) => pathname === '/offers/new', titleKey: 'navigation.routes.createOffer', backHref: '/offers' },
  { match: (pathname) => /^\/offers\/[^/]+\/edit$/.test(pathname), titleKey: 'navigation.routes.editOffer', backHref: '/offers' },
  { match: (pathname) => /^\/offers\/[^/]+$/.test(pathname), titleKey: 'navigation.routes.offer', backHref: '/offers' },
  { match: (pathname) => pathname === '/account/profile', titleKey: 'navigation.routes.profile', backHref: '/account' },
  { match: (pathname) => pathname === '/account/settings', titleKey: 'navigation.routes.settings', backHref: '/account' },
  { match: (pathname) => pathname === '/onboarding-guide', titleKey: 'navigation.routes.onboardingGuide', backHref: '/account' },
  { match: (pathname) => pathname === '/account/wallet', titleKey: 'navigation.routes.account', backHref: '/account' },
  { match: (pathname) => pathname === '/account/wallet/add', titleKey: 'navigation.routes.account', backHref: '/account' },
  { match: (pathname) => pathname === '/account/payouts', titleKey: 'navigation.routes.account', backHref: '/account' },
  { match: (pathname) => pathname === '/account/support', titleKey: 'navigation.routes.support', backHref: '/account' },
  { match: (pathname) => pathname === '/legal', titleKey: 'navigation.routes.legal', backHref: '/account' },
  { match: (pathname) => pathname === '/legal/terms', titleKey: 'navigation.routes.terms', backHref: '/legal' },
  { match: (pathname) => pathname === '/legal/privacy', titleKey: 'navigation.routes.privacy', backHref: '/legal' },
  { match: (pathname) => pathname === '/legal/safety', titleKey: 'navigation.routes.safety', backHref: '/legal' },
  { match: (pathname) => pathname === '/legal/refund-dispute', titleKey: 'navigation.routes.refundDispute', backHref: '/legal' },
];

export function getRouteHeader(pathname: string) {
  return routeTitles.find((route) => route.match(pathname)) ?? { titleKey: 'navigation.routes.hellowhen', root: true };
}
