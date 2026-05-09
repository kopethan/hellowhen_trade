'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRouteHeader } from '../lib/webRoutes';

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
      </header>
    );
  }

  return (
    <header className="web-top-header web-top-header--nested">
      <Link href={header.backHref ?? '/trades'} className="web-back-button" aria-label="Go back">
        ‹
      </Link>
      <h1>{header.title}</h1>
    </header>
  );
}
