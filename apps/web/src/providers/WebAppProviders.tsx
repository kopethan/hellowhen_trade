'use client';

import type { ReactNode } from 'react';
import { WebAppSettingsProvider } from './WebAppSettingsProvider';
import { WebAuthProvider } from './WebAuthProvider';

export function WebAppProviders({ children }: { children: ReactNode }) {
  return (
    <WebAppSettingsProvider>
      <WebAuthProvider>{children}</WebAuthProvider>
    </WebAppSettingsProvider>
  );
}
