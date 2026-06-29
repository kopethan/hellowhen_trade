'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isUtilityRoute, isWebThreadRoute } from '../lib/webRoutes';
import { betaFeatures } from '../lib/betaFeatures';
import { WebBottomTabs } from './WebBottomTabs';
import { WebTopHeader } from './WebTopHeader';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { useWebAuth } from '../providers/WebAuthProvider';

export function WebMobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { t } = useWebTranslation();
  const auth = useWebAuth();
  const adminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const shouldUsePublicShellForAdminNotFound = adminRoute && auth.hydrated && auth.user?.role !== 'admin';
  const utility = isUtilityRoute(pathname) && !shouldUsePublicShellForAdminNotFound;
  const threadRoute = !utility && isWebThreadRoute(pathname);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hideTopHeader, setHideTopHeader] = useState(false);
  const shellClassName = [
    'web-app-shell',
    betaFeatures.mainNavPlansMeTrade ? 'web-app-shell--normal-dock' : '',
    threadRoute ? 'web-app-shell--thread-route' : '',
  ].filter(Boolean).join(' ');
  const scrollAreaClassName = threadRoute ? 'web-scroll-area web-scroll-area--thread-route' : 'web-scroll-area';

  useEffect(() => {
    if (utility || threadRoute) {
      setHideTopHeader(false);
      return;
    }

    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    let previousScrollTop = scrollArea.scrollTop;

    const updateChromeVisibility = () => {
      const nextScrollTop = scrollArea.scrollTop;
      const delta = nextScrollTop - previousScrollTop;

      setShowScrollTop(nextScrollTop > 420);

      if (window.matchMedia('(min-width: 760px)').matches || nextScrollTop < 24) {
        setHideTopHeader(false);
      } else if (delta > 8 && nextScrollTop > 84) {
        setHideTopHeader(true);
      } else if (delta < -12) {
        setHideTopHeader(false);
      }

      previousScrollTop = nextScrollTop;
    };

    setHideTopHeader(false);
    updateChromeVisibility();
    scrollArea.addEventListener('scroll', updateChromeVisibility, { passive: true });
    return () => scrollArea.removeEventListener('scroll', updateChromeVisibility);
  }, [pathname, threadRoute, utility]);

  function scrollToTop() {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (utility) {
    const utilityClassName = pathname === '/onboarding-guide' ? 'utility-shell utility-shell--full' : 'utility-shell';
    return <main className={utilityClassName}>{children}</main>;
  }

  return (
    <main className="web-app-viewport">
      <section className={shellClassName} data-nav-mode={betaFeatures.mainNavPlansMeTrade ? 'plans-me-trade' : 'classic'} aria-label={t('common.messages.webAppLabel')}>
        {threadRoute ? null : <WebTopHeader hiddenOnMobile={hideTopHeader} />}
        <div ref={scrollAreaRef} className={scrollAreaClassName}>
          {auth.user?.trustTier === 'restricted' ? (
            <section className="account-restricted-banner" role="status">
              <strong>{t('common.messages.accountRestrictedTitle')}</strong>
              <p>{t('common.messages.accountRestrictedBody')}</p>
              <Link className="button secondary" href="/support">{t('common.messages.contactSupport')}</Link>
            </section>
          ) : null}
          {children}
        </div>
        {threadRoute ? null : (
          <button
            type="button"
            className={showScrollTop ? 'web-scroll-top-button is-visible' : 'web-scroll-top-button'}
            onClick={scrollToTop}
            aria-label={t('common.actions.backToTop')}
          >
            ↑
          </button>
        )}
        <WebBottomTabs />
      </section>
    </main>
  );
}
