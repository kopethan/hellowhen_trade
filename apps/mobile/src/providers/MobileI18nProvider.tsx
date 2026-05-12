import React, { createContext, useContext, useMemo } from 'react';
import { NativeModules } from 'react-native';
import { createTranslator, resolveLanguage, type LanguagePreference, type SupportedLanguage, type TranslationValues } from '@hellowhen/i18n';
import { useAppSettings } from './AppSettingsProvider';

type MobileI18nContextValue = {
  language: SupportedLanguage;
  preference: LanguagePreference;
  t: (key: string, values?: TranslationValues) => string;
};

const defaultTranslator = createTranslator('en');

const MobileI18nContext = createContext<MobileI18nContextValue>({
  language: 'en',
  preference: 'system',
  t: defaultTranslator,
});

function getDeviceLanguageCandidates() {
  const candidates: string[] = [];

  const settingsManager = NativeModules.SettingsManager as { settings?: { AppleLanguages?: string[]; AppleLocale?: string } } | undefined;
  const appleLanguages = settingsManager?.settings?.AppleLanguages;
  if (Array.isArray(appleLanguages)) candidates.push(...appleLanguages.filter((value): value is string => typeof value === 'string'));
  if (typeof settingsManager?.settings?.AppleLocale === 'string') candidates.push(settingsManager.settings.AppleLocale);

  const i18nManager = NativeModules.I18nManager as { localeIdentifier?: string } | undefined;
  if (typeof i18nManager?.localeIdentifier === 'string') candidates.push(i18nManager.localeIdentifier);

  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) candidates.push(intlLocale);
  } catch {
    // Ignore missing Intl locale support and fall back to English.
  }

  return candidates;
}

export function MobileI18nProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();
  const deviceLanguages = useMemo(() => getDeviceLanguageCandidates(), []);
  const language = useMemo(() => resolveLanguage(settings.language, deviceLanguages), [deviceLanguages, settings.language]);
  const t = useMemo(() => createTranslator(language), [language]);
  const value = useMemo<MobileI18nContextValue>(() => ({ language, preference: settings.language, t }), [language, settings.language, t]);

  return <MobileI18nContext.Provider value={value}>{children}</MobileI18nContext.Provider>;
}

export function useTranslation() {
  return useContext(MobileI18nContext);
}
