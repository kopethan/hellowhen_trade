'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isUtilityRoute } from '../lib/webRoutes';
import { WebBottomTabs } from './WebBottomTabs';
import { WebTopHeader } from './WebTopHeader';

export function WebMobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const utility = isUtilityRoute(pathname);

  if (utility) {
    return <main className="utility-shell">{children}</main>;
  }

  return (
    <main className="web-app-viewport">
      <section className="web-app-shell" aria-label="Hellowhen Trade web app">
        <WebTopHeader />
        <div className="web-scroll-area">{children}</div>
        <WebBottomTabs />
      </section>
    </main>
  );
}
