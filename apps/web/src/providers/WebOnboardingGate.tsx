'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { hasCompletedWebOnboardingGuideForVisitor } from '../features/onboarding-guide/onboardingGuideStorage';
import { useWebAuth } from './WebAuthProvider';

const GLOBAL_ONBOARDING_EXCLUDED_PREFIXES = [
  '/onboarding-guide',
  '/auth',
  '/admin',
  '/legal',
  '/support',
  '/account/support',
  '/reset-password',
  '/credits',
  '/api',
];

const PUBLIC_FILE_PATTERN = /\.(?:avif|ico|jpg|jpeg|png|svg|webp|gif|css|js|map|txt|xml|json|woff2?)$/i;

function isGlobalOnboardingExcludedRoute(pathname: string) {
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/favicon.ico') return true;
  if (PUBLIC_FILE_PATTERN.test(pathname)) return true;
  return GLOBAL_ONBOARDING_EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildCurrentPath(pathname: string, search: string) {
  const query = search ? `?${search}` : '';
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  return `${pathname}${query}${hash}`;
}

export function WebOnboardingGate() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const auth = useWebAuth();
  const userId = auth.user?.id;
  const lastRedirectTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (isGlobalOnboardingExcludedRoute(pathname)) return;
    if (hasCompletedWebOnboardingGuideForVisitor(userId, 'global')) return;

    const currentPath = buildCurrentPath(pathname, searchParams.toString());
    const target = `/onboarding-guide?guide=global&next=${encodeURIComponent(currentPath)}`;
    if (lastRedirectTarget.current === target) return;

    lastRedirectTarget.current = target;
    router.replace(target);
  }, [auth.hydrated, pathname, router, searchParams, userId]);

  return null;
}
