'use client';

import { useState } from 'react';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
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

      <section className="mobile-card mobile-card--soft">
        <h3>Country + preferred currency</h3>
        <p>Money preferences now live on Profile so they can be saved with your public account data.</p>
      </section>

      {message ? <p className="notice-box success">{message}</p> : null}
      {error ? <p className="notice-box danger">{error}</p> : null}
      {!auth.isAuthenticated ? <p className="notice-box info">You are not logged in. Appearance still persists locally on this browser.</p> : null}
    </MobilePage>
  );
}
