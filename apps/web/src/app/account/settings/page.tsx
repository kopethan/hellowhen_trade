'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AppSettings } from '@hellowhen/contracts';
import type { LanguagePreference } from '@hellowhen/i18n';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { api } from '../../../lib/api';
import { getFriendlyApiErrorMessage } from '../../../lib/webErrors';
import { useWebAppSettings } from '../../../providers/WebAppSettingsProvider';
import { useWebAuth } from '../../../providers/WebAuthProvider';
import { useWebTranslation } from '../../../providers/WebI18nProvider';

type Appearance = 'system' | 'light' | 'dark';

type ChoiceOption<T extends string> = { value: T; titleKey: string; bodyKey: string };

const appearanceOptions: Array<ChoiceOption<Appearance>> = [
  { value: 'system', titleKey: 'settings.appearance.options.system.title', bodyKey: 'settings.appearance.options.system.body' },
  { value: 'light', titleKey: 'settings.appearance.options.light.title', bodyKey: 'settings.appearance.options.light.body' },
  { value: 'dark', titleKey: 'settings.appearance.options.dark.title', bodyKey: 'settings.appearance.options.dark.body' },
];

const languageOptions: Array<ChoiceOption<LanguagePreference>> = [
  { value: 'system', titleKey: 'settings.language.options.system.title', bodyKey: 'settings.language.options.system.body' },
  { value: 'en', titleKey: 'settings.language.options.en.title', bodyKey: 'settings.language.options.en.body' },
  { value: 'fr', titleKey: 'settings.language.options.fr.title', bodyKey: 'settings.language.options.fr.body' },
];

export default function AccountSettingsPage() {
  const auth = useWebAuth();
  const appSettings = useWebAppSettings();
  const { t } = useWebTranslation();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function updateAppSettings(patch: Partial<AppSettings>, successAccountKey: string, successLocalKey: string) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await appSettings.setSettings({ ...appSettings.settings, ...patch }, { syncRemote: auth.isAuthenticated });
      setMessage(t(auth.isAuthenticated ? successAccountKey : successLocalKey));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function requestEmailVerification() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await api.auth.requestEmailVerification() as { message?: string; devVerificationUrl?: string };
      setMessage(response.devVerificationUrl ? `${response.message ?? t('settings.security.verificationRequested')} ${t('settings.security.developmentLink')}: ${response.devVerificationUrl}` : response.message ?? t('settings.security.verificationRequested'));
      await auth.refreshMe().catch(() => undefined);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function startTwoFactorSetup() {
    setSaving(true);
    setMessage(null);
    setError(null);
    setRecoveryCodes([]);
    try {
      if (!twoFactorPassword.trim()) {
        setError(t('settings.security.passwordRequiredForSetup'));
        return;
      }
      await auth.reauthenticate({ password: twoFactorPassword.trim() });
      const response = await api.auth.twoFactorSetup() as { secret: string; otpauthUrl: string; message: string };
      setTwoFactorSecret(response.secret);
      setMessage(t('settings.security.setupStarted'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function enableTwoFactor() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await api.auth.twoFactorEnable({ code: twoFactorCode }) as { recoveryCodes?: string[] };
      setRecoveryCodes(response.recoveryCodes ?? []);
      setTwoFactorSecret('');
      setTwoFactorCode('');
      setTwoFactorPassword('');
      setMessage(t('settings.security.twoFactorEnabled'));
      await auth.refreshMe().catch(() => undefined);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function disableTwoFactor() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.auth.twoFactorDisable({ password: twoFactorPassword || undefined, code: twoFactorCode || undefined });
      setTwoFactorPassword('');
      setTwoFactorCode('');
      setRecoveryCodes([]);
      setMessage(t('settings.security.twoFactorDisabled'));
      await auth.refreshMe().catch(() => undefined);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function logoutAllDevices() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await auth.logoutAll();
      setMessage(t('settings.security.allSessionsSignedOut'));
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobilePage>
      <PageIntro
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        body={t('settings.body')}
      />

      <section className="mobile-card settings-panel">
        <div>
          <span className="semantic-badge info">{t('settings.appearance.badge')}</span>
          <h3>{t('settings.appearance.title')}</h3>
          <p>{t('settings.appearance.body')}</p>
        </div>
        <div className="choice-list">
          {appearanceOptions.map((option) => {
            const active = appSettings.settings.appearance === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={active ? 'choice-card choice-card--active' : 'choice-card'}
                onClick={() => { void updateAppSettings({ appearance: option.value }, 'settings.appearance.savedAccount', 'settings.appearance.savedBrowser'); }}
                disabled={saving}
              >
                <span>
                  <strong>{t(option.titleKey)}</strong>
                  <small>{t(option.bodyKey)}</small>
                </span>
                {active ? <em>✓</em> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mobile-card settings-panel">
        <div>
          <span className="semantic-badge info">{t('settings.language.badge')}</span>
          <h3>{t('settings.language.title')}</h3>
          <p>{t('settings.language.body')}</p>
        </div>
        <div className="choice-list">
          {languageOptions.map((option) => {
            const active = appSettings.settings.language === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={active ? 'choice-card choice-card--active' : 'choice-card'}
                onClick={() => { void updateAppSettings({ language: option.value }, 'settings.language.savedAccount', 'settings.language.savedBrowser'); }}
                disabled={saving}
              >
                <span>
                  <strong>{t(option.titleKey)}</strong>
                  <small>{t(option.bodyKey)}</small>
                </span>
                {active ? <em>✓</em> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mobile-card settings-panel">
        <div>
          <span className="semantic-badge instruction">{t('settings.notifications.badge')}</span>
          <h3>{t('settings.notifications.title')}</h3>
          <p>{t('settings.notifications.body')}</p>
        </div>
        <label className="checkbox-row checkbox-row--boxed">
          <input
            checked={appSettings.settings.notificationsEnabled}
            onChange={(event) => { void updateAppSettings({ notificationsEnabled: event.target.checked }, 'settings.notifications.savedAccount', 'settings.notifications.savedBrowser'); }}
            type="checkbox"
            disabled={saving}
          />
          <span>{t('settings.notifications.enable')}</span>
        </label>
      </section>

      <section className="mobile-card settings-panel">
        <div>
          <span className="semantic-badge warning">{t('settings.security.badge')}</span>
          <h3>{t('settings.security.title')}</h3>
          <p>{t('settings.security.body')}</p>
        </div>
        <div className="security-status-grid">
          <span><strong>{auth.user?.emailVerifiedAt ? t('settings.security.verified') : t('settings.security.notVerified')}</strong><small>{t('settings.security.email')}</small></span>
          <span><strong>{auth.user?.twoFactorEnabled ? t('settings.security.enabled') : t('settings.security.off')}</strong><small>{t('settings.security.authenticator')}</small></span>
        </div>
        {!auth.user?.twoFactorEnabled ? (
          <label className="field-label">
            {t('settings.security.passwordForSetup')}
            <input value={twoFactorPassword} onChange={(event) => setTwoFactorPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
        ) : null}
        <div className="button-row">
          <button type="button" className="secondary" disabled={saving || !auth.isAuthenticated || Boolean(auth.user?.emailVerifiedAt)} onClick={() => { void requestEmailVerification(); }}>{t('common.actions.verifyEmail')}</button>
          <button type="button" className="secondary" disabled={saving || !auth.isAuthenticated || Boolean(auth.user?.twoFactorEnabled)} onClick={() => { void startTwoFactorSetup(); }}>{t('settings.security.setupAuthenticator')}</button>
          <button type="button" className="secondary" disabled={saving || !auth.isAuthenticated} onClick={() => { void logoutAllDevices(); }}>{t('common.actions.logoutAllDevices')}</button>
        </div>
        {twoFactorSecret ? (
          <div className="two-factor-setup-box">
            <p className="meta">{t('settings.security.authenticatorSecret')}</p>
            <code>{twoFactorSecret}</code>
            <label className="field-label">
              {t('settings.security.code6Digit')}
              <input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} inputMode="numeric" placeholder="123456" />
            </label>
            <button type="button" onClick={() => { void enableTwoFactor(); }} disabled={saving || twoFactorCode.trim().length < 6}>{t('settings.security.enableTwoStep')}</button>
          </div>
        ) : null}
        {auth.user?.twoFactorEnabled ? (
          <div className="two-factor-setup-box">
            <label className="field-label">
              {t('settings.security.password')}
              <input value={twoFactorPassword} onChange={(event) => setTwoFactorPassword(event.target.value)} type="password" autoComplete="current-password" />
            </label>
            <label className="field-label">
              {t('settings.security.authenticatorOrRecovery')}
              <input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} inputMode="numeric" />
            </label>
            <button type="button" className="secondary" onClick={() => { void disableTwoFactor(); }} disabled={saving}>{t('settings.security.disableTwoStep')}</button>
          </div>
        ) : null}
        {recoveryCodes.length ? (
          <div className="recovery-code-grid">
            {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
          </div>
        ) : null}
      </section>

      <section className="mobile-card mobile-card--soft">
        <span className="semantic-badge info">{t('settings.policies.badge')}</span>
        <h3>{t('settings.policies.title')}</h3>
        <p>{t('settings.policies.body')}</p>
        <div className="cta-row">
          <Link href="/legal" className="button secondary">{t('settings.policies.open')}</Link>
          <Link href="/support" className="button secondary">{t('settings.policies.support')}</Link>
          <Link href="/account/delete" className="button secondary danger-text">{t('settings.policies.deleteAccount')}</Link>
        </div>
      </section>

      <section className="mobile-card mobile-card--soft">
        <h3>{t('settings.localDisplay.title')}</h3>
        <p>{t('settings.localDisplay.body')}</p>
      </section>

      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
      {!auth.isAuthenticated ? <p className="notice-box info">{t('settings.signedOutHint')}</p> : null}
    </MobilePage>
  );
}
