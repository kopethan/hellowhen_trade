'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRouteHeader, getWebTabs, type WebTab } from '../lib/webRoutes';
import { betaFeatures } from '../lib/betaFeatures';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';

function WebBetaHeaderBadge() {
  const { t } = useWebTranslation();
  if (betaFeatures.moneyFeaturesVisible) return null;

  return <span className="web-header-beta-badge">{t('common.states.beta')}</span>;
}

function WebDesktopNav({ pathname, authenticated, tabs }: { pathname: string; authenticated: boolean; tabs: WebTab[] }) {
  const { t } = useWebTranslation();
  return (
    <nav className="web-desktop-nav" aria-label={t('navigation.primary')}>
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const publicTab = tab.key === 'trades' || tab.key === 'trade' || tab.key === 'plans' || (betaFeatures.mainNavPlansMeTrade && tab.key === 'me');
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
  const pathname = usePathname() || '/trades';
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const usePlansMeTradeNav = betaFeatures.mainNavPlansMeTrade;
  const tabs = getWebTabs(usePlansMeTradeNav);
  const header = getRouteHeader(pathname, { plansMeTradeNav: usePlansMeTradeNav });
  const authenticated = auth.hydrated && auth.isAuthenticated;

  const hiddenClassName = hiddenOnMobile ? ' web-top-header--mobile-hidden' : '';
  const headerClassName = usePlansMeTradeNav ? ' web-top-header--local-only' : '';

  if (header.root) {
    return (
      <header className={`web-top-header web-top-header--root${headerClassName}${hiddenClassName}`}>
        <WebBetaHeaderBadge />
        <div>
          <p className="web-kicker">{t('navigation.brand')}</p>
          <h1>{t(header.titleKey)}</h1>
        </div>
        {!usePlansMeTradeNav ? <WebDesktopNav pathname={pathname} authenticated={authenticated} tabs={tabs} /> : null}
      </header>
    );
  }

  return (
    <header className={`web-top-header web-top-header--nested${headerClassName}${hiddenClassName}`}>
      <WebBetaHeaderBadge />
      <div className="web-nested-title-row">
        <Link href={header.backHref ?? '/trades'} className="web-back-button" aria-label={t('navigation.goBack')}>
          <WebIcon name="back" size={21} decorative />
        </Link>
        <h1>{t(header.titleKey)}</h1>
      </div>
      {!usePlansMeTradeNav ? <WebDesktopNav pathname={pathname} authenticated={authenticated} tabs={tabs} /> : null}
    </header>
  );
}
