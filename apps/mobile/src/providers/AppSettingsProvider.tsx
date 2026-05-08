import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '@hellowhen/contracts';

const SETTINGS_STORAGE_KEY = 'hellowhen_app_settings_v1';

const defaultSettings: AppSettings = {
  appearance: 'system',
  language: 'en',
  notificationsEnabled: true,
};

type SettingsContextValue = {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  setSettings: (_settings: AppSettings) => {},
  hydrated: false,
});

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    appearance: value?.appearance === 'light' || value?.appearance === 'dark' || value?.appearance === 'system' ? value.appearance : defaultSettings.appearance,
    language: value?.language || defaultSettings.language,
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

  const value = useMemo(() => ({ settings, setSettings, hydrated }), [hydrated, setSettings, settings]);

  if (!hydrated) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(SettingsContext);
}
