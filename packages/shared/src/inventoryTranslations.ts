import {
  normalizeContentLanguageCode,
  resolveLocalizedContent,
  type ContentLanguageCode,
  type LocalizedContentOption,
  type LocalizedContentResolutionSource,
} from './contentLanguageResolver.js';

export type InventoryLanguageCode = ContentLanguageCode;

export type InventoryTranslationLike = {
  languageCode?: string | null;
  title?: string | null;
  description?: string | null;
  source?: 'creator' | 'machine' | string | null;
};

export type InventoryTranslatableLike = {
  title?: string | null;
  description?: string | null;
  defaultLanguage?: string | null;
  translations?: InventoryTranslationLike[] | null;
};

export type InventoryDisplayLanguage = {
  languageCode: string;
  isTranslated: boolean;
  source: LocalizedContentResolutionSource;
  requestedLanguages: InventoryLanguageCode[];
  availableLanguages: InventoryLanguageCode[];
  options: LocalizedContentOption[];
};

export type InventoryDisplayCopy = InventoryDisplayLanguage & {
  title: string;
  description: string;
};

export function normalizeInventoryLanguageCode(value?: string | null): InventoryLanguageCode | null {
  return normalizeContentLanguageCode(value);
}

export function getAlternateInventoryLanguage(languageCode: string): InventoryLanguageCode {
  const normalized = normalizeInventoryLanguageCode(languageCode);
  if (normalized === 'fr' || normalized === 'es') return 'en';
  return 'fr';
}

export function resolveInventoryDisplayCopy(item: InventoryTranslatableLike, viewerLanguage?: string | null, preferredLanguages?: readonly (string | null | undefined)[] | null): InventoryDisplayCopy {
  const display = resolveLocalizedContent({
    viewerLanguage,
    preferredLanguages,
    defaultLanguage: item.defaultLanguage,
    translations: item.translations,
    fallbackFields: item,
  });

  return {
    title: display.title,
    description: display.description,
    languageCode: display.languageCode,
    isTranslated: display.isTranslated,
    source: display.source,
    requestedLanguages: display.requestedLanguages,
    availableLanguages: display.availableLanguages,
    options: display.options,
  };
}

export function withResolvedInventoryDisplay<T extends InventoryTranslatableLike>(item: T, viewerLanguage?: string | null, preferredLanguages?: readonly (string | null | undefined)[] | null): T & { displayLanguage: InventoryDisplayLanguage } {
  const display = resolveInventoryDisplayCopy(item, viewerLanguage, preferredLanguages);
  return {
    ...item,
    title: display.title,
    description: display.description,
    displayLanguage: {
      languageCode: display.languageCode,
      isTranslated: display.isTranslated,
      source: display.source,
      requestedLanguages: display.requestedLanguages,
      availableLanguages: display.availableLanguages,
      options: display.options,
    },
  };
}
