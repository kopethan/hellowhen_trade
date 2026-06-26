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
  const tabs = getWebTabs(betaFeatures.mainNavPlansMeTrade);

  return (
    <nav className="web-bottom-tabs" aria-label={t('navigation.primary')} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const publicTradeTab = tab.key === 'trades' || tab.key === 'trade';
        const shouldGate = !publicTradeTab && (!auth.hydrated || !auth.isAuthenticated);
        const href = shouldGate ? `/auth?next=${encodeURIComponent(tab.href)}` : tab.href;
        return (
          <Link key={tab.key} href={href} className={active ? 'web-tab web-tab--active' : 'web-tab'}>
            <WebIcon name={tab.icon} size={23} decorative className="web-tab__icon" />
            <span>{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
