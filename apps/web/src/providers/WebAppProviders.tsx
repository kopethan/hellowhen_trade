'use client';

import type { ReactNode } from 'react';
import { WebAppSettingsProvider } from './WebAppSettingsProvider';
import { WebAuthProvider } from './WebAuthProvider';
import { WebI18nProvider } from './WebI18nProvider';

export function WebAppProviders({ children }: { children: ReactNode }) {
  return (
    <WebAppSettingsProvider>
      <WebI18nProvider>
        <WebAuthProvider>{children}</WebAuthProvider>
      </WebI18nProvider>
    </WebAppSettingsProvider>
  );
}
