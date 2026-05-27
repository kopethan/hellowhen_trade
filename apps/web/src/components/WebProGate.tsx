'use client';

import type { ReactNode } from 'react';
import type { ProAccessState, ProSubscriptionSnapshot } from '@hellowhen/shared';
import { getWebProGate } from '../lib/proGate';

type WebProGateProps = {
  state?: Partial<ProAccessState> | ProSubscriptionSnapshot | null;
  children: ReactNode;
  fallback?: ReactNode;
  requireVisibleSurface?: boolean;
};

export function WebProGate({ state, children, fallback = null, requireVisibleSurface = true }: WebProGateProps) {
  const gate = getWebProGate(state);
  const surfaceAllowed = !requireVisibleSurface || gate.canSeeProSurfaces;
  if (surfaceAllowed && gate.hasProAccess) return <>{children}</>;
  if (surfaceAllowed) return <>{fallback}</>;
  return null;
}
