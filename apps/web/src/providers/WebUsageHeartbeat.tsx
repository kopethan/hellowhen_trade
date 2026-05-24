'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';
import { useWebAuth } from './WebAuthProvider';

const CLIENT_ID_STORAGE_KEY = 'hellowhen_usage_client_id_v1';
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

type UsageArea = 'trades' | 'trade_detail' | 'proposal_thread' | 'needs' | 'offers' | 'account' | 'admin' | 'other';

type UsageDescriptor = {
  area: UsageArea;
  routePattern: string;
};

function dynamicIdSegment(value: string, parent?: string) {
  if (!value) return value;
  if (/^\[[a-zA-Z]+Id\]$/.test(value)) return value;
  const looksLikeId = /^[a-z0-9_-]{12,}$/i.test(value) || /^\d+$/.test(value);
  if (!looksLikeId) return value;
  if (parent === 'trades') return '[tradeId]';
  if (parent === 'proposals') return '[proposalId]';
  if (parent === 'needs') return '[needId]';
  if (parent === 'offers') return '[offerId]';
  if (parent === 'users') return '[userId]';
  if (parent === 'plans') return '[planId]';
  return '[id]';
}

function toRoutePattern(pathname: string) {
  const cleanPath = (pathname || '/').split(/[?#]/)[0] || '/';
  const segments = cleanPath.split('/').map((segment, index, all) => dynamicIdSegment(segment, all[index - 1]));
  return segments.join('/').replace(/\/+/g, '/');
}

function describeUsage(pathname: string): UsageDescriptor {
  const routePattern = toRoutePattern(pathname);
  if (routePattern === '/admin' || routePattern.startsWith('/admin/')) return { area: 'admin', routePattern };
  if (/^\/trades\/\[tradeId\]\/proposals\//.test(routePattern)) return { area: 'proposal_thread', routePattern };
  if (/^\/trades\/\[tradeId\]$/.test(routePattern)) return { area: 'trade_detail', routePattern };
  if (routePattern === '/trades' || routePattern.startsWith('/trades/')) return { area: 'trades', routePattern };
  if (routePattern === '/needs' || routePattern.startsWith('/needs/')) return { area: 'needs', routePattern };
  if (routePattern === '/offers' || routePattern.startsWith('/offers/')) return { area: 'offers', routePattern };
  if (routePattern === '/account' || routePattern.startsWith('/account/') || routePattern === '/settings' || routePattern === '/me' || routePattern === '/wallet' || routePattern === '/support') return { area: 'account', routePattern };
  return { area: 'other', routePattern };
}

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getUsageClientId() {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;
    const next = createClientId();
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export function WebUsageHeartbeat() {
  const pathname = usePathname() || '/';
  const auth = useWebAuth();
  const descriptor = useMemo(() => describeUsage(pathname), [pathname]);

  useEffect(() => {
    if (!auth.hydrated || !auth.user) return undefined;
    let cancelled = false;

    async function sendHeartbeat() {
      if (cancelled || document.visibilityState === 'hidden') return;
      const clientId = getUsageClientId();
      if (!clientId) return;
      await api.usage.heartbeat({ ...descriptor, clientId }).catch(() => undefined);
    }

    void sendHeartbeat();
    const interval = window.setInterval(() => { void sendHeartbeat(); }, HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat();
    };
    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [auth.hydrated, auth.user?.id, descriptor]);

  return null;
}
