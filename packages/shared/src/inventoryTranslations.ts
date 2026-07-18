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
  originalTitle?: string | null;
  originalDescription?: string | null;
  defaultLanguage?: string | null;
  translations?: InventoryTranslationLike[] | null;
  displayLanguage?: { options?: LocalizedContentOption[] | null } | null;
};

export type InventoryOriginalCopy = {
  title: string;
  description: string;
  defaultLanguage: InventoryLanguageCode;
  translations: InventoryTranslationLike[];
};

function originalOptionFromDisplay(item: InventoryTranslatableLike, defaultLanguage: InventoryLanguageCode) {
  const options = item.displayLanguage?.options ?? [];
  return options.find((option) => option.isOriginal)
    ?? options.find((option) => option.languageCode === defaultLanguage);
}

/**
 * Returns the creator-authored source copy for an editor. Display APIs may
 * replace title/description with the viewer's preferred translation, so edit
 * forms must never initialize directly from those display fields.
 */
export function resolveInventoryOriginalCopy(item: InventoryTranslatableLike): InventoryOriginalCopy {
  const defaultLanguage = normalizeInventoryLanguageCode(item.defaultLanguage) ?? 'en';
  const displayOriginal = originalOptionFromDisplay(item, defaultLanguage);
  const hasExplicitOriginalTitle = Object.prototype.hasOwnProperty.call(item, 'originalTitle');
  const hasExplicitOriginalDescription = Object.prototype.hasOwnProperty.call(item, 'originalDescription');
  const title = hasExplicitOriginalTitle
    ? item.originalTitle ?? ''
    : displayOriginal?.title ?? item.title ?? '';
  const description = hasExplicitOriginalDescription
    ? item.originalDescription ?? ''
    : displayOriginal?.description ?? item.description ?? '';
  const storedTranslations = (item.translations ?? []).filter((translation) =>
    normalizeInventoryLanguageCode(translation.languageCode) !== defaultLanguage,
  );
  const translations = storedTranslations.length
    ? storedTranslations
    : (item.displayLanguage?.options ?? [])
      .filter((option) => !option.isOriginal && option.languageCode !== defaultLanguage)
      .map((option) => ({
        languageCode: option.languageCode,
        title: option.title,
        description: option.description,
        source: option.source,
      }));

  return {
    title,
    description,
    defaultLanguage,
    translations,
  };
}

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
  const original = resolveInventoryOriginalCopy(item);
  const display = resolveLocalizedContent({
    viewerLanguage,
    preferredLanguages,
    defaultLanguage: original.defaultLanguage,
    translations: original.translations,
    fallbackFields: original,
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

export function withResolvedInventoryDisplay<T extends InventoryTranslatableLike>(item: T, viewerLanguage?: string | null, preferredLanguages?: readonly (string | null | undefined)[] | null): T & { originalTitle: string; originalDescription: string; displayLanguage: InventoryDisplayLanguage } {
  const original = resolveInventoryOriginalCopy(item);
  const display = resolveInventoryDisplayCopy(item, viewerLanguage, preferredLanguages);
  return {
    ...item,
    originalTitle: original.title,
    originalDescription: original.description,
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
