import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings, ContentLanguageCode, LanguagePreference } from '@hellowhen/contracts';
import { normalizeLanguagePreference } from '@hellowhen/i18n';
import { api } from '../lib/api';

const SETTINGS_STORAGE_KEY = 'hellowhen_app_settings_v1';
const contentLanguageCodes = ['en', 'fr', 'es'] as const satisfies readonly ContentLanguageCode[];

const defaultSettings: AppSettings = {
  appearance: 'system',
  language: 'system',
  contentLanguageOrder: ['en'],
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

function normalizeContentLanguageOrder(value: unknown, appLanguage: LanguagePreference): ContentLanguageCode[] {
  const ordered: ContentLanguageCode[] = [];
  const add = (language: unknown) => {
    if (typeof language !== 'string') return;
    if (!contentLanguageCodes.includes(language as ContentLanguageCode)) return;
    if (ordered.includes(language as ContentLanguageCode)) return;
    ordered.push(language as ContentLanguageCode);
  };

  if (Array.isArray(value)) {
    value.forEach(add);
  }

  if (!ordered.length && appLanguage !== 'system') add(appLanguage);
  if (!ordered.length) add('en');
  return ordered;
}

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const language = normalizeLanguagePreference(value?.language);
  return {
    appearance: value?.appearance === 'light' || value?.appearance === 'dark' || value?.appearance === 'system' ? value.appearance : defaultSettings.appearance,
    language,
    contentLanguageOrder: normalizeContentLanguageOrder(value?.contentLanguageOrder, language),
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
