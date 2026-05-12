export const supportedLanguages = ['en', 'fr'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

export const languagePreferences = ['system', ...supportedLanguages] as const;
export type LanguagePreference = typeof languagePreferences[number];

export const defaultLanguage: SupportedLanguage = 'en';
export const defaultLanguagePreference: LanguagePreference = 'system';

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && supportedLanguages.includes(value as SupportedLanguage);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === 'string' && languagePreferences.includes(value as LanguagePreference);
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return isLanguagePreference(value) ? value : defaultLanguagePreference;
}

function localeToLanguage(locale: string): SupportedLanguage | null {
  const normalized = locale.trim().toLowerCase().replace('_', '-');
  if (!normalized) return null;
  const base = normalized.split('-')[0];
  return isSupportedLanguage(base) ? base : null;
}

export function resolveLanguage(preference: unknown, localeCandidates: readonly string[] = []): SupportedLanguage {
  const normalizedPreference = normalizeLanguagePreference(preference);
  if (normalizedPreference !== 'system') return normalizedPreference;

  for (const candidate of localeCandidates) {
    const language = localeToLanguage(candidate);
    if (language) return language;
  }

  return defaultLanguage;
}
