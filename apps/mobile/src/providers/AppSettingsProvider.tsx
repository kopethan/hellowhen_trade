import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '@hellowhen/contracts';
import { normalizeLanguagePreference } from '@hellowhen/i18n';
import { api } from '../lib/api';

const SETTINGS_STORAGE_KEY = 'hellowhen_app_settings_v1';

const defaultSettings: AppSettings = {
  appearance: 'system',
  language: 'system',
  notificationsEnabled: true,
};

type SettingsContextValue = {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  refreshSettings: () => Promise<void>;
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  setSettings: (_settings: AppSettings) => {},
  refreshSettings: async () => undefined,
  hydrated: false,
});

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    appearance: value?.appearance === 'light' || value?.appearance === 'dark' || value?.appearance === 'system' ? value.appearance : defaultSettings.appearance,
    language: normalizeLanguagePreference(value?.language),
    notificationsEnabled: typeof value?.notificationsEnabled === 'boolean' ? value.notificationsEnabled : defaultSettings.notificationsEnabled,
  };
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!mounted) return;
        if (raw) setSettingsState(normalizeSettings(JSON.parse(raw) as Partial<AppSettings>));
      } catch {
        if (mounted) setSettingsState(defaultSettings);
      } finally {
        if (mounted) setHydrated(true);
      }
    }
    void hydrate();
    return () => { mounted = false; };
  }, []);

  const setSettings = useCallback((nextSettings: AppSettings) => {
    const normalized = normalizeSettings(nextSettings);
    setSettingsState(normalized);
    void AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized)).catch(() => undefined);
  }, []);

  const refreshSettings = useCallback(async () => {
    const response = await api.settings.me() as { settings?: Partial<AppSettings> | null };
    const remote = normalizeSettings(response.settings);
    setSettingsState(remote);
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(remote));
  }, []);

  const value = useMemo(() => ({ settings, setSettings, refreshSettings, hydrated }), [hydrated, refreshSettings, setSettings, settings]);

  if (!hydrated) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(SettingsContext);
}
