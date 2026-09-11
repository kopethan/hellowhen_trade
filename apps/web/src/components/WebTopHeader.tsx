'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getRouteHeader, getWebTabs, type WebTab } from '../lib/webRoutes';
import { betaFeatures } from '../lib/betaFeatures';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';
import { WebAccountHeaderAction } from './WebAccountHeaderAction';


function WebAccountAction() {
  return <WebAccountHeaderAction />;
}

function WebDesktopNav({ pathname, authenticated, tabs }: { pathname: string; authenticated: boolean; tabs: WebTab[] }) {
  const { t } = useWebTranslation();
  return (
    <nav className="web-desktop-nav" aria-label={t('navigation.primary')}>
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const publicTab = tab.key === 'trades' || tab.key === 'trade' || tab.key === 'plans' || tab.key === 'explore';
        const href = !authenticated && !publicTab ? `/auth?next=${encodeURIComponent(tab.href)}` : tab.href;
        return (
          <Link
            key={tab.key}
            href={href}
            className={active ? 'web-desktop-nav__link is-active' : 'web-desktop-nav__link'}
            aria-current={active ? 'page' : undefined}
            title={t(tab.labelKey)}
          >
            <WebIcon name={tab.icon} size={17} decorative />
            <span>{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function WebTopHeader({ hiddenOnMobile = false }: { hiddenOnMobile?: boolean }) {
  const pathname = usePathname() || '/explore';
  const router = useRouter();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const useNormalAppNav = betaFeatures.mainNavPlansMeTrade;
  const tabs = getWebTabs(useNormalAppNav);
  const header = getRouteHeader(pathname, { plansMeTradeNav: useNormalAppNav });
  const headerBackHref = 'backHref' in header ? header.backHref ?? '/explore' : '/explore';
  const pageOwnsHeader = header.owner === 'page';
  const authenticated = auth.hydrated && auth.isAuthenticated;
  const accountRoot = pathname === '/account' || pathname === '/me';
  const accountRoute = pathname === '/me' || pathname.startsWith('/account');

  const hiddenClassName = hiddenOnMobile ? ' web-top-header--mobile-hidden' : '';
  const normalNavClassName = useNormalAppNav ? ' web-top-header--normal-nav' : '';
  const accountAction = useNormalAppNav && !accountRoute ? <WebAccountAction /> : null;

  function goBackFromAccount() {
    if (typeof window !== 'undefined' && document.referrer) {
      try {
        if (new URL(document.referrer).origin === window.location.origin) {
          router.back();
          return;
        }
      } catch {
        // Fall through to the safe in-app destination.
      }
    }
    router.push('/explore');
  }

  if (pageOwnsHeader) {
    return (
      <header className={`web-top-header web-top-header--root web-top-header--global-nav${normalNavClassName}${hiddenClassName}`}>
        <Link href={useNormalAppNav ? '/explore' : '/trades'} className="web-global-brand" aria-label={t('navigation.brand')}>
          <span>{t('navigation.brand')}</span>
        </Link>
        <WebDesktopNav pathname={pathname} authenticated={authenticated} tabs={tabs} />
        {accountAction}
      </header>
    );
  }

  if (header.root && !accountRoot) {
    return (
      <header className={`web-top-header web-top-header--root${normalNavClassName}${hiddenClassName}`}>
        <div className="web-top-header__title">
          <p className="web-kicker">{t('navigation.brand')}</p>
          <h1>{t(header.titleKey)}</h1>
        </div>
        <WebDesktopNav pathname={pathname} authenticated={authenticated} tabs={tabs} />
        {accountAction}
      </header>
    );
  }

  return (
    <header className={`web-top-header web-top-header--nested${normalNavClassName}${hiddenClassName}`}>
      <div className="web-nested-title-row">
        {accountRoot ? (
          <button type="button" className="web-back-button" aria-label={t('navigation.goBack')} onClick={goBackFromAccount}>
            <WebIcon name="back" size={21} decorative />
          </button>
        ) : (
          <Link href={headerBackHref} className="web-back-button" aria-label={t('navigation.goBack')}>
            <WebIcon name="back" size={21} decorative />
          </Link>
        )}
        <h1>{t(header.titleKey)}</h1>
      </div>
      <WebDesktopNav pathname={pathname} authenticated={authenticated} tabs={tabs} />
      {accountAction}
    </header>
  );
}
