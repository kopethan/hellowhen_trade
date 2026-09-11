'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getWebTabs } from '../lib/webRoutes';
import { betaFeatures } from '../lib/betaFeatures';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';

export function WebBottomTabs() {
  const pathname = usePathname() || '/trades';
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const useNormalAppNav = betaFeatures.mainNavPlansMeTrade;
  const tabs = getWebTabs(useNormalAppNav);
  const className = useNormalAppNav ? 'web-bottom-tabs web-bottom-tabs--normal' : 'web-bottom-tabs';
  const navMode = useNormalAppNav ? 'plans-explore-trade' : 'classic';

  return (
    <nav className={className} data-nav-mode={navMode} aria-label={t('navigation.primary')} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const publicTab = tab.key === 'trades' || tab.key === 'trade' || tab.key === 'plans' || tab.key === 'explore';
        const shouldGate = !publicTab && (!auth.hydrated || !auth.isAuthenticated);
        const href = shouldGate ? `/auth?next=${encodeURIComponent(tab.href)}` : tab.href;
        return (
          <Link
            key={tab.key}
            href={href}
            className={active ? 'web-tab web-tab--active' : 'web-tab'}
            aria-current={active ? 'page' : undefined}
            data-tab-key={tab.key}
            title={t(tab.labelKey)}
          >
            <WebIcon name={tab.icon} size={23} decorative className="web-tab__icon" />
            <span>{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
