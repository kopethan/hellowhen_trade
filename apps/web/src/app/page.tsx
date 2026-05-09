'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import { useWebAuth } from '../providers/WebAuthProvider';

export default function HomePage() {
  const router = useRouter();
  const auth = useWebAuth();

  useEffect(() => {
    if (auth.hydrated && auth.isAuthenticated) router.replace('/trades');
  }, [auth.hydrated, auth.isAuthenticated, router]);

  if (!auth.hydrated) {
    return (
      <section className="auth-page-shell">
        <section className="mobile-card mobile-card--soft auth-panel">
          <p className="eyebrow">Hellowhen Trade</p>
          <h2>Loading your session...</h2>
        </section>
      </section>
    );
  }

  if (auth.isAuthenticated) return null;

  return (
    <section className="auth-page-shell">
      <WebAuthPanel />
    </section>
  );
}
