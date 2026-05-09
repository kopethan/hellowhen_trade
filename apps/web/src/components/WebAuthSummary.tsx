'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWebAuth } from '../providers/WebAuthProvider';

export function WebAuthSummary() {
  const router = useRouter();
  const auth = useWebAuth();
  const profile = auth.user?.profile;
  const displayName = profile?.displayName || auth.user?.email || 'Guest';

  if (!auth.hydrated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <h3>Checking session...</h3>
        <p>Loading your account state.</p>
      </section>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <h3>Sign in to manage your account</h3>
        <p>Create needs, offers, trades, wallet demo actions, and support requests after login.</p>
        <Link href="/auth" className="button primary full">Login or register</Link>
      </section>
    );
  }

  return (
    <section className="mobile-card account-session-card">
      <div>
        <span className="semantic-badge success">Signed in</span>
        <h3>{displayName}</h3>
        <p>{auth.user?.email}</p>
      </div>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          void auth.logout().then(() => router.push('/auth'));
        }}
      >
        Logout
      </button>
    </section>
  );
}
