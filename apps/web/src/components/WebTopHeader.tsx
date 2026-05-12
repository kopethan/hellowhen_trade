'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRouteHeader, webTabs } from '../lib/webRoutes';
import { betaFeatures } from '../lib/betaFeatures';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';

function WebBetaHeaderBadge() {
  if (betaFeatures.moneyFeaturesVisible) return null;

  return <span className="web-header-beta-badge">BETA</span>;
}

function WebDesktopNav({ pathname, authenticated }: { pathname: string; authenticated: boolean }) {
  const { t } = useWebTranslation();
  return (
    <nav className="web-desktop-nav" aria-label={t('navigation.primary')}>
      {webTabs.map((tab) => {
        const active = tab.match(pathname);
        const href = !authenticated && tab.key !== 'trades' ? `/auth?next=${encodeURIComponent(tab.href)}` : tab.href;
        return (
          <Link key={tab.key} href={href} className={active ? 'web-desktop-nav__link is-active' : 'web-desktop-nav__link'}>
            <WebIcon name={tab.icon} size={17} decorative />
            <span>{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function WebTopHeader() {
  const pathname = usePathname() || '/trades';
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const header = getRouteHeader(pathname);
  const authenticated = auth.hydrated && auth.isAuthenticated;

  if (header.root) {
    return (
      <header className="web-top-header web-top-header--root">
        <WebBetaHeaderBadge />
        <div>
          <p className="web-kicker">{t('navigation.brand')}</p>
          <h1>{t(header.titleKey)}</h1>
        </div>
        <WebDesktopNav pathname={pathname} authenticated={authenticated} />
      </header>
    );
  }

  return (
    <header className="web-top-header web-top-header--nested">
      <WebBetaHeaderBadge />
      <div className="web-nested-title-row">
        <Link href={header.backHref ?? '/trades'} className="web-back-button" aria-label={t('navigation.goBack')}>
          <WebIcon name="back" size={21} decorative />
        </Link>
        <h1>{t(header.titleKey)}</h1>
      </div>
      <WebDesktopNav pathname={pathname} authenticated={authenticated} />
    </header>
  );
}
