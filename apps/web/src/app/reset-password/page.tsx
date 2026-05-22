'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';

export default function ResetPasswordPage() {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(nextToken);
  }, []);

  async function submit() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      if (!token) throw new Error(t('auth.reset.missingTokenError'));
      if (password.length < 8) throw new Error(t('auth.errors.passwordMin'));
      if (password !== confirmPassword) throw new Error(t('auth.errors.passwordsMismatch'));
      const result = await auth.resetPassword(token, password, confirmPassword);
      setMessage(result.message ?? t('auth.reset.success'));
      setPassword('');
      setConfirmPassword('');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === t('auth.reset.missingTokenError') ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card auth-card reset-card">
      <span className="semantic-badge instruction">{t('auth.reset.badge')}</span>
      <h1>{t('auth.reset.title')}</h1>
      <p className="notice-box info">{t('auth.reset.body')}</p>
      {!token ? <p className="notice-box danger">{t('auth.reset.missingToken')}</p> : null}
      <div className="form-stack">
        <label className="field-label">
          {t('auth.fields.newPassword')}
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('auth.placeholders.passwordMin')} type="password" autoComplete="new-password" />
        </label>
        <label className="field-label">
          {t('auth.fields.confirmNewPassword')}
          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t('auth.placeholders.repeatPassword')} type="password" autoComplete="new-password" />
        </label>
        <button onClick={() => { void submit(); }} disabled={loading || !token} type="button">{loading ? t('auth.actions.resetting') : t('auth.actions.resetPassword')}</button>
      </div>
      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
      <div className="auth-recovery-links">
        <Link href="/auth" className="button full">{t('auth.actions.backToLogin')}</Link>
        <p className="meta">
          {t('auth.reset.stillLockedOut')} <Link href="/support?category=account_recovery">{t('auth.reset.contactSupport')}</Link>.
        </p>
      </div>
    </section>
  );
}
