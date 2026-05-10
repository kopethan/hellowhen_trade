'use client';

import { useState } from 'react';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { api } from '../../../lib/api';
import { getFriendlyApiErrorMessage } from '../../../lib/webErrors';
import { useWebAppSettings } from '../../../providers/WebAppSettingsProvider';
import { useWebAuth } from '../../../providers/WebAuthProvider';

type Appearance = 'system' | 'light' | 'dark';

const appearanceOptions: Array<{ value: Appearance; title: string; body: string }> = [
  { value: 'system', title: 'System', body: 'Follow your device/browser setting.' },
  { value: 'light', title: 'Light', body: 'Always open in light mode.' },
  { value: 'dark', title: 'Dark', body: 'Always open in dark mode.' },
];

export default function AccountSettingsPage() {
  const auth = useWebAuth();
  const appSettings = useWebAppSettings();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function updateAppearance(appearance: Appearance) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await appSettings.setSettings({ ...appSettings.settings, appearance }, { syncRemote: auth.isAuthenticated });
      setMessage(auth.isAuthenticated ? 'Appearance saved to your account.' : 'Appearance saved on this browser.');
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
      setMessage(response.devVerificationUrl ? `${response.message ?? 'Verification requested'} Development link: ${response.devVerificationUrl}` : response.message ?? 'Verification email requested.');
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
      const response = await api.auth.twoFactorSetup() as { secret: string; otpauthUrl: string; message: string };
      setTwoFactorSecret(response.secret);
      setMessage('Add the secret to your authenticator app, then enter the 6-digit code.');
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
      setMessage('Two-step verification enabled. Save your recovery codes now.');
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
      setMessage('Two-step verification disabled.');
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
      setMessage('All sessions were signed out.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function updateNotifications(enabled: boolean) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await appSettings.setSettings({ ...appSettings.settings, notificationsEnabled: enabled }, { syncRemote: auth.isAuthenticated });
      setMessage(auth.isAuthenticated ? 'Notification preference saved to your account.' : 'Notification preference saved on this browser.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobilePage>
      <PageIntro
        eyebrow="Settings"
        title="App preferences"
        body="Control web appearance and account preferences. Accent color and old action-bar settings stay removed."
      />

      <section className="mobile-card settings-panel">
        <div>
          <span className="semantic-badge info">Appearance</span>
          <h3>Dark mode</h3>
          <p>The selected mode is stored before React loads, so web reloads should not flash back to light mode.</p>
        </div>
        <div className="choice-list">
          {appearanceOptions.map((option) => {
            const active = appSettings.settings.appearance === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={active ? 'choice-card choice-card--active' : 'choice-card'}
                onClick={() => { void updateAppearance(option.value); }}
                disabled={saving}
              >
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.body}</small>
                </span>
                {active ? <em>✓</em> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mobile-card settings-panel">
        <div>
          <span className="semantic-badge instruction">Account</span>
          <h3>Notifications</h3>
          <p>This is stored with the same settings model as mobile. Push/email delivery rules will come later.</p>
        </div>
        <label className="checkbox-row checkbox-row--boxed">
          <input
            checked={appSettings.settings.notificationsEnabled}
            onChange={(event) => { void updateNotifications(event.target.checked); }}
            type="checkbox"
            disabled={saving}
          />
          <span>Enable trade and support notifications</span>
        </label>
      </section>

      <section className="mobile-card settings-panel">
        <div>
          <span className="semantic-badge warning">Security</span>
          <h3>Account protection</h3>
          <p>Email verification, two-step verification, and session controls protect your account, trade conversations, and admin tools.</p>
        </div>
        <div className="security-status-grid">
          <span><strong>{auth.user?.emailVerifiedAt ? 'Verified' : 'Not verified'}</strong><small>Email</small></span>
          <span><strong>{auth.user?.twoFactorEnabled ? 'Enabled' : 'Off'}</strong><small>Authenticator app</small></span>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" disabled={saving || !auth.isAuthenticated || Boolean(auth.user?.emailVerifiedAt)} onClick={() => { void requestEmailVerification(); }}>Verify email</button>
          <button type="button" className="secondary" disabled={saving || !auth.isAuthenticated || Boolean(auth.user?.twoFactorEnabled)} onClick={() => { void startTwoFactorSetup(); }}>Set up authenticator</button>
          <button type="button" className="secondary" disabled={saving || !auth.isAuthenticated} onClick={() => { void logoutAllDevices(); }}>Logout all devices</button>
        </div>
        {twoFactorSecret ? (
          <div className="two-factor-setup-box">
            <p className="meta">Authenticator secret</p>
            <code>{twoFactorSecret}</code>
            <label className="field-label">
              6-digit code
              <input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} inputMode="numeric" placeholder="123456" />
            </label>
            <button type="button" onClick={() => { void enableTwoFactor(); }} disabled={saving || twoFactorCode.trim().length < 6}>Enable two-step verification</button>
          </div>
        ) : null}
        {auth.user?.twoFactorEnabled ? (
          <div className="two-factor-setup-box">
            <label className="field-label">
              Password
              <input value={twoFactorPassword} onChange={(event) => setTwoFactorPassword(event.target.value)} type="password" autoComplete="current-password" />
            </label>
            <label className="field-label">
              Authenticator or recovery code
              <input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} inputMode="numeric" />
            </label>
            <button type="button" className="secondary" onClick={() => { void disableTwoFactor(); }} disabled={saving}>Disable two-step verification</button>
          </div>
        ) : null}
        {recoveryCodes.length ? (
          <div className="recovery-code-grid">
            {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
          </div>
        ) : null}
      </section>

      <section className="mobile-card mobile-card--soft">
        <h3>Local display</h3>
        <p>Country and display currency now live on Profile so they can be saved with your public account data.</p>
      </section>

      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
      {!auth.isAuthenticated ? <p className="notice-box info">You are not logged in. Appearance still persists locally on this browser.</p> : null}
    </MobilePage>
  );
}
