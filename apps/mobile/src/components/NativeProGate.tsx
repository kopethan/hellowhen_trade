import type { ReactNode } from 'react';
import React from 'react';
import type { ProAccessState, ProSubscriptionSnapshot } from '@hellowhen/shared';
import { getMobileProGate } from '../lib/proGate';

type NativeProGateProps = {
  state?: Partial<ProAccessState> | ProSubscriptionSnapshot | null;
  children: ReactNode;
  fallback?: ReactNode;
  requireVisibleSurface?: boolean;
};

export function NativeProGate({ state, children, fallback = null, requireVisibleSurface = true }: NativeProGateProps) {
  const gate = getMobileProGate(state);
  const surfaceAllowed = !requireVisibleSurface || gate.canSeeProSurfaces;
  if (surfaceAllowed && gate.hasProAccess) return <>{children}</>;
  if (surfaceAllowed) return <>{fallback}</>;
  return null;
}
