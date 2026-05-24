'use client';

import type { ReactNode } from 'react';
import { WebAppSettingsProvider } from './WebAppSettingsProvider';
import { WebAuthProvider } from './WebAuthProvider';
import { WebI18nProvider } from './WebI18nProvider';
import { WebUsageHeartbeat } from './WebUsageHeartbeat';

export function WebAppProviders({ children }: { children: ReactNode }) {
  return (
    <WebAppSettingsProvider>
      <WebI18nProvider>
        <WebAuthProvider><WebUsageHeartbeat />{children}</WebAuthProvider>
      </WebI18nProvider>
    </WebAppSettingsProvider>
  );
}
