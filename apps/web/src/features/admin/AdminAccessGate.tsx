'use client';

import type { ReactNode } from 'react';
import { useWebAuth } from '../../providers/WebAuthProvider';

function GenericNotFound() {
  return (
    <main className="utility-shell admin-hidden-page" aria-label="Page not found">
      <section className="app-card">
        <span className="semantic-badge admin">404</span>
        <h1>Page not found</h1>
        <p>The page you requested could not be found.</p>
      </section>
    </main>
  );
}

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

  if (auth.user?.role !== 'admin') return <GenericNotFound />;

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
