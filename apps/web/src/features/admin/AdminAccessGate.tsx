'use client';

import type { ReactNode } from 'react';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { useWebAuth } from '../../providers/WebAuthProvider';

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const auth = useWebAuth();

  if (!auth.hydrated) {
    return (
      <main className="utility-shell admin-hidden-page" aria-label="Loading">
        <section className="app-card">
          <span className="semantic-badge admin">Loading</span>
          <h1>Loading…</h1>
        </section>
      </main>
    );
  }

  if (auth.user?.role !== 'admin') return <NotFoundPanel />;

  if (!auth.user.twoFactorEnabled) {
    return (
      <main className="utility-shell admin-hidden-page" aria-label="Secure admin setup required">
        <section className="app-card">
          <span className="semantic-badge warning">Two-step verification required</span>
          <h1>Secure setup required</h1>
          <p>Enable authenticator app two-step verification from Account → Settings before opening internal tools.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
