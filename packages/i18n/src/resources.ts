import { en } from './locales/en';
import { fr } from './locales/fr';
import { es } from './locales/es';
import type { SupportedLanguage } from './languages';

export const resources = { en, fr, es } as const;
export type TranslationResources = typeof en;
export type TranslationValues = Record<string, string | number | boolean | null | undefined>;
export type TranslationKey = string;

function readPath(source: unknown, path: string): string | null {
  const value = path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
  return typeof value === 'string' ? value : null;
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) return template;
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) => {
    const value = values[name];
    return value === null || typeof value === 'undefined' ? match : String(value);
  });
}

export function translate(language: SupportedLanguage, key: TranslationKey, values?: TranslationValues) {
  const localized = readPath(resources[language], key);
  const fallback = readPath(resources.en, key);
  return interpolate(localized ?? fallback ?? key, values);
}

export function createTranslator(language: SupportedLanguage) {
  return (key: TranslationKey, values?: TranslationValues) => translate(language, key, values);
}
