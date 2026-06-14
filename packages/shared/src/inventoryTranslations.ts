export type InventoryLanguageCode = 'en' | 'fr' | 'es';

export type InventoryTranslationLike = {
  languageCode?: string | null;
  title?: string | null;
  description?: string | null;
};

export type InventoryTranslatableLike = {
  title?: string | null;
  description?: string | null;
  defaultLanguage?: string | null;
  translations?: InventoryTranslationLike[] | null;
};

export type InventoryDisplayCopy = {
  title: string;
  description: string;
  languageCode: string;
  isTranslated: boolean;
};

export function normalizeInventoryLanguageCode(value?: string | null): InventoryLanguageCode | null {
  const normalized = value?.trim().toLowerCase().replace('_', '-').split('-')[0];
  if (normalized === 'en' || normalized === 'fr' || normalized === 'es') return normalized;
  return null;
}

export function getAlternateInventoryLanguage(languageCode: string): InventoryLanguageCode {
  const normalized = normalizeInventoryLanguageCode(languageCode);
  if (normalized === 'fr' || normalized === 'es') return 'en';
  return 'fr';
}

export function resolveInventoryDisplayCopy(item: InventoryTranslatableLike, viewerLanguage?: string | null): InventoryDisplayCopy {
  const defaultLanguage = normalizeInventoryLanguageCode(item.defaultLanguage) ?? 'en';
  const requestedLanguage = normalizeInventoryLanguageCode(viewerLanguage) ?? defaultLanguage;
  const original = {
    title: item.title?.trim() ?? '',
    description: item.description?.trim() ?? '',
    languageCode: defaultLanguage,
    isTranslated: false,
  };

  if (requestedLanguage === defaultLanguage) return original;

  const translation = (item.translations ?? []).find((entry) => normalizeInventoryLanguageCode(entry.languageCode) === requestedLanguage);
  const translatedTitle = translation?.title?.trim();
  const translatedDescription = translation?.description?.trim();
  if (!translatedTitle || !translatedDescription) return original;

  return {
    title: translatedTitle,
    description: translatedDescription,
    languageCode: requestedLanguage,
    isTranslated: true,
  };
}

export function withResolvedInventoryDisplay<T extends InventoryTranslatableLike>(item: T, viewerLanguage?: string | null): T {
  const display = resolveInventoryDisplayCopy(item, viewerLanguage);
  return {
    ...item,
    title: display.title,
    description: display.description,
  };
}
