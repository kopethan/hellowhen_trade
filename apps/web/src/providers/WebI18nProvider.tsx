'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTranslator, resolveLanguage, type LanguagePreference, type SupportedLanguage, type TranslationValues } from '@hellowhen/i18n';
import { useWebAppSettings } from './WebAppSettingsProvider';

type WebI18nContextValue = {
  language: SupportedLanguage;
  preference: LanguagePreference;
  t: (key: string, values?: TranslationValues) => string;
};

const defaultTranslator = createTranslator('en');

const WebI18nContext = createContext<WebI18nContextValue>({
  language: 'en',
  preference: 'system',
  t: defaultTranslator,
});

function getBrowserLanguageCandidates() {
  if (typeof navigator === 'undefined') return [];
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  return [...languages, navigator.language].filter((value): value is string => Boolean(value));
}

export function WebI18nProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useWebAppSettings();
  const [browserLanguages, setBrowserLanguages] = useState<string[]>([]);

  useEffect(() => {
    setBrowserLanguages(getBrowserLanguageCandidates());
  }, []);

  const language = useMemo(
    () => resolveLanguage(settings.language, browserLanguages),
    [browserLanguages, settings.language],
  );
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<WebI18nContextValue>(() => ({ language, preference: settings.language, t }), [language, settings.language, t]);

  return <WebI18nContext.Provider value={value}>{children}</WebI18nContext.Provider>;
}

export function useWebTranslation() {
  return useContext(WebI18nContext);
}
