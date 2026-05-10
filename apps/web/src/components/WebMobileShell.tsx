'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isUtilityRoute } from '../lib/webRoutes';
import { WebBottomTabs } from './WebBottomTabs';
import { WebTopHeader } from './WebTopHeader';

export function WebMobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const utility = isUtilityRoute(pathname);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (utility) return;
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const updateScrollTopVisibility = () => {
      setShowScrollTop(scrollArea.scrollTop > 420);
    };

    updateScrollTopVisibility();
    scrollArea.addEventListener('scroll', updateScrollTopVisibility, { passive: true });
    return () => scrollArea.removeEventListener('scroll', updateScrollTopVisibility);
  }, [pathname, utility]);

  function scrollToTop() {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (utility) {
    return <main className="utility-shell">{children}</main>;
  }

  return (
    <main className="web-app-viewport">
      <section className="web-app-shell" aria-label="Hellowhen Trade web app">
        <WebTopHeader />
        <div ref={scrollAreaRef} className="web-scroll-area">{children}</div>
        <button
          type="button"
          className={showScrollTop ? 'web-scroll-top-button is-visible' : 'web-scroll-top-button'}
          onClick={scrollToTop}
          aria-label="Back to top"
        >
          ↑
        </button>
        <WebBottomTabs />
      </section>
    </main>
  );
}
