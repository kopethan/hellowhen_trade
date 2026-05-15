'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';

export function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? t('auth.emailVerification.checking') : t('auth.emailVerification.missingToken'));

  useEffect(() => {
    let mounted = true;
    async function verify() {
      if (!token) return;
      setStatus('loading');
      setMessage(t('auth.emailVerification.checking'));
      try {
        const response = await api.auth.verifyEmail(token) as { message?: string };
        if (!mounted) return;
        setStatus('success');
        setMessage(response.message ?? t('auth.emailVerification.success'));
        await auth.refreshMe().catch(() => undefined);
      } catch (caughtError) {
        if (!mounted) return;
        setStatus('error');
        setMessage(getFriendlyApiErrorMessage(caughtError, t('auth.emailVerification.failed')));
      }
    }
    void verify();
    return () => { mounted = false; };
  }, [auth, t, token]);

  return (
    <MobilePage>
      <PageIntro eyebrow={t('auth.emailVerification.eyebrow')} title={t('auth.emailVerification.title')} body={t('auth.emailVerification.body')} />
      <section className={status === 'success' ? 'mobile-card notice-box success' : status === 'error' ? 'mobile-card notice-box danger' : 'mobile-card mobile-card--soft'}>
        <h3>{status === 'success' ? t('auth.emailVerification.successTitle') : status === 'error' ? t('auth.emailVerification.failedTitle') : t('common.states.loading')}</h3>
        <p>{message}</p>
        <div className="cta-row">
          <Link href="/auth" className="button primary">{t('common.actions.loginOrRegister')}</Link>
          <Link href="/account/settings" className="button secondary">{t('navigation.routes.settings')}</Link>
        </div>
      </section>
    </MobilePage>
  );
}
