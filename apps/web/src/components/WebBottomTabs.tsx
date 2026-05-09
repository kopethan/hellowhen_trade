'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { webTabs } from '../lib/webRoutes';
import { WebIcon } from './WebIcon';

export function WebBottomTabs() {
  const pathname = usePathname() || '/trades';

  return (
    <nav className="web-bottom-tabs" aria-label="Primary navigation">
      {webTabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link key={tab.key} href={tab.href} className={active ? 'web-tab web-tab--active' : 'web-tab'}>
            <WebIcon name={tab.icon} size={23} decorative className="web-tab__icon" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
