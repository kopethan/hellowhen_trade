'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRouteHeader, webTabs } from '../lib/webRoutes';

function WebDesktopNav({ pathname }: { pathname: string }) {
  return (
    <nav className="web-desktop-nav" aria-label="Primary navigation">
      {webTabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link key={tab.key} href={tab.href} className={active ? 'web-desktop-nav__link is-active' : 'web-desktop-nav__link'}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function WebTopHeader() {
  const pathname = usePathname() || '/trades';
  const header = getRouteHeader(pathname);

  if (header.root) {
    return (
      <header className="web-top-header web-top-header--root">
        <div>
          <p className="web-kicker">Hellowhen Trade</p>
          <h1>{header.title}</h1>
        </div>
        <WebDesktopNav pathname={pathname} />
      </header>
    );
  }

  return (
    <header className="web-top-header web-top-header--nested">
      <div className="web-nested-title-row">
        <Link href={header.backHref ?? '/trades'} className="web-back-button" aria-label="Go back">
          ‹
        </Link>
        <h1>{header.title}</h1>
      </div>
      <WebDesktopNav pathname={pathname} />
    </header>
  );
}
