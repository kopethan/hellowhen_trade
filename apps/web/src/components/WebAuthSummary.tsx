'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';

export function WebAuthSummary() {
  const router = useRouter();
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const profile = auth.user?.profile;
  const displayName = profile?.displayName || auth.user?.email || 'Guest';

  if (!auth.hydrated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <h3>{t('auth.session.checkingTitle')}</h3>
        <p>{t('auth.session.checkingBody')}</p>
      </section>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="mobile-card mobile-card--soft">
        <h3>{t('auth.session.signedOutTitle')}</h3>
        <p>{t('auth.session.signedOutBody')}</p>
        <Link href="/auth" className="button primary full">{t('common.actions.loginOrRegister')}</Link>
      </section>
    );
  }

  return (
    <section className="mobile-card account-session-card">
      <div>
        <span className="semantic-badge success">{t('common.states.signedIn')}</span>
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
        {t('common.actions.logout')}
      </button>
    </section>
  );
}
