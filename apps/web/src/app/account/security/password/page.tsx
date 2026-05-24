'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MobilePage, PageIntro } from '../../../../components/MobilePage';
import { api } from '../../../../lib/api';
import { getFriendlyApiErrorMessage } from '../../../../lib/webErrors';
import { useWebAuth } from '../../../../providers/WebAuthProvider';
import { useWebTranslation } from '../../../../providers/WebI18nProvider';

export default function AccountPasswordPage() {
  const auth = useWebAuth();
  const { t } = useWebTranslation();
  const [clientReady, setClientReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordCode, setChangePasswordCode] = useState('');

  useEffect(() => {
    setClientReady(true);
  }, []);

  const authReady = clientReady && auth.hydrated;
  const authenticated = authReady && auth.isAuthenticated;
  const currentUser = authReady ? auth.user : null;

  async function changePassword() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const normalizedCode = changePasswordCode.trim();

      if (!currentPassword || !newPassword || !confirmPassword) {
        setError(t('settings.security.changePasswordRequired'));
        return;
      }
      if (newPassword.length < 8) {
        setError(t('settings.security.changePasswordLength'));
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t('settings.security.changePasswordMismatch'));
        return;
      }
      if (currentPassword === newPassword) {
        setError(t('settings.security.changePasswordSame'));
        return;
      }
      if (currentUser?.twoFactorEnabled && !normalizedCode) {
        setError(t('settings.security.changePasswordCodeRequired'));
        return;
      }

      const response = await api.auth.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
        code: normalizedCode || undefined,
      }) as { message?: string };
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordCode('');
      setMessage(response.message ?? t('settings.security.passwordChanged'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobilePage>
      <PageIntro
        eyebrow={t('settings.security.badge')}
        title={t('settings.security.changePasswordTitle')}
        body={t('settings.security.changePasswordBody')}
        action={<Link href="/account/settings" className="button secondary">{t('settings.security.backToSecurity')}</Link>}
      />

      {!authReady ? <p className="notice-box info">{t('common.states.loading')}…</p> : null}

      {authReady && !authenticated ? (
        <section className="mobile-card mobile-card--soft">
          <h3>{t('settings.security.passwordSignedOutTitle')}</h3>
          <p>{t('settings.security.passwordSignedOutBody')}</p>
          <Link href="/auth?next=/account/security/password" className="button primary">{t('common.actions.loginOrRegister')}</Link>
        </section>
      ) : null}

      {authenticated ? (
        <section className="mobile-card settings-panel">
          <div>
            <span className="semantic-badge warning">{t('settings.security.passwordAccountTitle')}</span>
            <h3>{t('settings.security.changePasswordTitle')}</h3>
            <p>{t('settings.security.passwordPageHelp')}</p>
          </div>
          <label className="field-label">
            {t('settings.security.currentPassword')}
            <input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          <label className="field-label">
            {t('settings.security.newPassword')}
            <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" autoComplete="new-password" />
          </label>
          <label className="field-label">
            {t('settings.security.confirmNewPassword')}
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" />
          </label>
          {currentUser?.twoFactorEnabled ? (
            <label className="field-label">
              {t('settings.security.authenticatorOrRecovery')}
              <input value={changePasswordCode} onChange={(event) => setChangePasswordCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" />
            </label>
          ) : null}
          <button type="button" className="secondary" onClick={() => { void changePassword(); }} disabled={saving}>{saving ? t('common.states.saving') : t('settings.security.changePasswordAction')}</button>
        </section>
      ) : null}

      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
    </MobilePage>
  );
}
