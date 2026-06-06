'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { hasCompletedWebOnboardingGuideForVisitor } from '../features/onboarding-guide/onboardingGuideStorage';
import { useWebAuth } from './WebAuthProvider';

const ONBOARDING_EXCLUDED_PREFIXES = [
  '/onboarding-guide',
  '/auth',
  '/admin',
  '/reset-password',
  '/credits',
];

function isOnboardingExcludedRoute(pathname: string) {
  return ONBOARDING_EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
    if (isOnboardingExcludedRoute(pathname)) return;
    if (hasCompletedWebOnboardingGuideForVisitor(userId)) return;

    const currentPath = buildCurrentPath(pathname, searchParams.toString());
    const target = `/onboarding-guide?next=${encodeURIComponent(currentPath)}`;
    if (lastRedirectTarget.current === target) return;

    lastRedirectTarget.current = target;
    router.replace(target);
  }, [auth.hydrated, pathname, router, searchParams, userId]);

  return null;
}
