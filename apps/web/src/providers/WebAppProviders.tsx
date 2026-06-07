'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { WebAppSettingsProvider } from './WebAppSettingsProvider';
import { WebAuthProvider } from './WebAuthProvider';
import { WebI18nProvider } from './WebI18nProvider';
import { WebUsageHeartbeat } from './WebUsageHeartbeat';
import { WebOnboardingGate } from './WebOnboardingGate';

export function WebAppProviders({ children }: { children: ReactNode }) {
  return (
    <WebAppSettingsProvider>
      <WebI18nProvider>
        <WebAuthProvider><Suspense fallback={null}><WebOnboardingGate /></Suspense><WebUsageHeartbeat />{children}</WebAuthProvider>
      </WebI18nProvider>
    </WebAppSettingsProvider>
  );
}
