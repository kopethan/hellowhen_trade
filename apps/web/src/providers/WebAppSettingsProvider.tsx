'use client';

import type { AppSettings } from '@hellowhen/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const SETTINGS_STORAGE_KEY = 'hellowhen_app_settings_v1';
const LEGACY_APPEARANCE_KEY = 'hellowhen:appearance';

const defaultSettings: AppSettings = {
  appearance: 'system',
  language: 'en',
  notificationsEnabled: true,
};

type SettingsContextValue = {
  settings: AppSettings;
  hydrated: boolean;
  setSettings: (settings: AppSettings, options?: { syncRemote?: boolean }) => Promise<void>;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  hydrated: false,
  setSettings: async () => undefined,
  refreshSettings: async () => undefined,
});

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    appearance: value?.appearance === 'light' || value?.appearance === 'dark' || value?.appearance === 'system' ? value.appearance : defaultSettings.appearance,
    language: value?.language || defaultSettings.language,
    notificationsEnabled: typeof value?.notificationsEnabled === 'boolean' ? value.notificationsEnabled : defaultSettings.notificationsEnabled,
  };
}

function resolveTheme(appearance: AppSettings['appearance']) {
  if (appearance === 'light' || appearance === 'dark') return appearance;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(appearance: AppSettings['appearance']) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(appearance);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.appearance = appearance;
}

function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.localStorage.setItem(LEGACY_APPEARANCE_KEY, settings.appearance);
}

function readStoredSettings() {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
    const legacyAppearance = window.localStorage.getItem(LEGACY_APPEARANCE_KEY);
    return normalizeSettings({ appearance: legacyAppearance as AppSettings['appearance'] });
  } catch {
    return defaultSettings;
  }
}

export function WebAppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredSettings();
    setSettingsState(stored);
    applyTheme(stored.appearance);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || settings.appearance !== 'system' || typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [hydrated, settings.appearance]);

  const setSettings = useCallback(async (nextSettings: AppSettings, options?: { syncRemote?: boolean }) => {
    const normalized = normalizeSettings(nextSettings);
    setSettingsState(normalized);
    saveSettings(normalized);
    applyTheme(normalized.appearance);

    if (options?.syncRemote) {
      await api.settings.updateMe(normalized);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    const remote = normalizeSettings(await api.settings.me() as Partial<AppSettings>);
    setSettingsState(remote);
    saveSettings(remote);
    applyTheme(remote.appearance);
  }, []);

  const value = useMemo(() => ({ settings, hydrated, setSettings, refreshSettings }), [hydrated, refreshSettings, setSettings, settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useWebAppSettings() {
  return useContext(SettingsContext);
}
