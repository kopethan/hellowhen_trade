export type RootTabKey = 'trades' | 'needs' | 'offers' | 'account';

export type WebTab = {
  key: RootTabKey;
  label: string;
  href: string;
  icon: string;
  match: (pathname: string) => boolean;
};

export const webTabs: WebTab[] = [
  {
    key: 'trades',
    label: 'Trades',
    href: '/trades',
    icon: '↔',
    match: (pathname) => pathname === '/' || pathname.startsWith('/trades'),
  },
  {
    key: 'needs',
    label: 'Needs',
    href: '/needs',
    icon: '↓',
    match: (pathname) => pathname.startsWith('/needs'),
  },
  {
    key: 'offers',
    label: 'Offers',
    href: '/offers',
    icon: '↑',
    match: (pathname) => pathname.startsWith('/offers'),
  },
  {
    key: 'account',
    label: 'Account',
    href: '/account',
    icon: '•',
    match: (pathname) => pathname.startsWith('/account'),
  },
];

export const utilityRoutePrefixes = ['/auth', '/admin', '/reset-password', '/credits'];

export function isUtilityRoute(pathname: string) {
  if (pathname === '/') return true;
  return utilityRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const routeTitles: Array<{ match: (pathname: string) => boolean; title: string; root?: boolean; backHref?: string }> = [
  { match: (pathname) => pathname === '/trades', title: 'Trades', root: true },
  { match: (pathname) => pathname === '/needs', title: 'Needs', root: true },
  { match: (pathname) => pathname === '/offers', title: 'Offers', root: true },
  { match: (pathname) => pathname === '/account', title: 'Account', root: true },
  { match: (pathname) => pathname === '/trades/create', title: 'Create trade', backHref: '/trades' },
  { match: (pathname) => /^\/trades\/[^/]+$/.test(pathname), title: 'Trade', backHref: '/trades' },
  { match: (pathname) => pathname === '/needs/new', title: 'Create need', backHref: '/needs' },
  { match: (pathname) => /^\/needs\/[^/]+\/edit$/.test(pathname), title: 'Edit need', backHref: '/needs' },
  { match: (pathname) => /^\/needs\/[^/]+$/.test(pathname), title: 'Need', backHref: '/needs' },
  { match: (pathname) => pathname === '/offers/new', title: 'Create offer', backHref: '/offers' },
  { match: (pathname) => /^\/offers\/[^/]+\/edit$/.test(pathname), title: 'Edit offer', backHref: '/offers' },
  { match: (pathname) => /^\/offers\/[^/]+$/.test(pathname), title: 'Offer', backHref: '/offers' },
  { match: (pathname) => pathname === '/account/profile', title: 'Profile', backHref: '/account' },
  { match: (pathname) => pathname === '/account/settings', title: 'Settings', backHref: '/account' },
  { match: (pathname) => pathname === '/account/wallet', title: 'Wallet', backHref: '/account' },
  { match: (pathname) => pathname === '/account/wallet/add', title: 'Add money', backHref: '/account/wallet' },
  { match: (pathname) => pathname === '/account/payouts', title: 'Payouts', backHref: '/account' },
  { match: (pathname) => pathname === '/account/support', title: 'Support', backHref: '/account' },
];

export function getRouteHeader(pathname: string) {
  return routeTitles.find((route) => route.match(pathname)) ?? { title: 'Hellowhen', root: true };
}
