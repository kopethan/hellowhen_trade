'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { webTabs } from '../lib/webRoutes';
import { useWebAuth } from '../providers/WebAuthProvider';
import { WebIcon } from './WebIcon';

export function WebBottomTabs() {
  const pathname = usePathname() || '/trades';
  const auth = useWebAuth();

  return (
    <nav className="web-bottom-tabs" aria-label="Primary navigation">
      {webTabs.map((tab) => {
        const active = tab.match(pathname);
        const shouldGate = tab.key !== 'trades' && (!auth.hydrated || !auth.isAuthenticated);
        const href = shouldGate ? `/auth?next=${encodeURIComponent(tab.href)}` : tab.href;
        return (
          <Link key={tab.key} href={href} className={active ? 'web-tab web-tab--active' : 'web-tab'}>
            <WebIcon name={tab.icon} size={23} decorative className="web-tab__icon" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
