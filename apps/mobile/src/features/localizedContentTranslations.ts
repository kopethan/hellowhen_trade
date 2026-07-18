import type { DiscoveryLanguage } from '@hellowhen/contracts';

export type LocalizedContentTranslationDraft = {
  languageCode: DiscoveryLanguage;
  title: string;
  description: string;
};

export type LocalizedContentTranslationInput = {
  languageCode?: unknown;
  title?: unknown;
  description?: unknown;
};

export type LocalizedContentOriginalDraft = {
  defaultLanguage: DiscoveryLanguage;
  title: string;
  description: string;
  translations: LocalizedContentTranslationDraft[];
};

export const supportedLocalizedContentLanguages: DiscoveryLanguage[] = ['en', 'fr', 'es'];

function isLocalizedContentLanguage(value: unknown): value is DiscoveryLanguage {
  return value === 'en' || value === 'fr' || value === 'es';
}

export function normalizeLocalizedContentTranslationDrafts(
  translations: readonly LocalizedContentTranslationInput[] | null | undefined,
  defaultLanguage: DiscoveryLanguage,
) {
  const byLanguage = new Map<DiscoveryLanguage, LocalizedContentTranslationDraft>();

  for (const translation of translations ?? []) {
    if (!isLocalizedContentLanguage(translation.languageCode) || translation.languageCode === defaultLanguage) continue;
    byLanguage.set(translation.languageCode, {
      languageCode: translation.languageCode,
      title: typeof translation.title === 'string' ? translation.title : '',
      description: typeof translation.description === 'string' ? translation.description : '',
    });
  }

  return supportedLocalizedContentLanguages
    .filter((languageCode) => byLanguage.has(languageCode))
    .map((languageCode) => byLanguage.get(languageCode)!)
    .filter(Boolean);
}

export function getAvailableLocalizedContentTranslationLanguages(
  defaultLanguage: DiscoveryLanguage,
  translations: readonly LocalizedContentTranslationDraft[],
) {
  const usedLanguages = new Set<DiscoveryLanguage>([
    defaultLanguage,
    ...translations.map((translation) => translation.languageCode),
  ]);
  return supportedLocalizedContentLanguages.filter((languageCode) => !usedLanguages.has(languageCode));
}

export function addLocalizedContentTranslationDraft(
  translations: readonly LocalizedContentTranslationDraft[],
  defaultLanguage: DiscoveryLanguage,
  languageCode: DiscoveryLanguage,
) {
  if (!getAvailableLocalizedContentTranslationLanguages(defaultLanguage, translations).includes(languageCode)) {
    return [...translations];
  }
  return normalizeLocalizedContentTranslationDrafts(
    [...translations, { languageCode, title: '', description: '' }],
    defaultLanguage,
  );
}

export function updateLocalizedContentTranslationDraft(
  translations: readonly LocalizedContentTranslationDraft[],
  defaultLanguage: DiscoveryLanguage,
  draft: LocalizedContentTranslationDraft,
) {
  if (draft.languageCode === defaultLanguage) return [...translations];
  const nextTranslations = translations.some((translation) => translation.languageCode === draft.languageCode)
    ? translations.map((translation) => translation.languageCode === draft.languageCode ? draft : translation)
    : [...translations, draft];
  return normalizeLocalizedContentTranslationDrafts(nextTranslations, defaultLanguage);
}

export function removeLocalizedContentTranslationDraft(
  translations: readonly LocalizedContentTranslationDraft[],
  languageCode: DiscoveryLanguage,
) {
  return translations.filter((translation) => translation.languageCode !== languageCode);
}

export function buildLocalizedContentTranslationsPayload(
  defaultLanguage: DiscoveryLanguage,
  translations: readonly LocalizedContentTranslationDraft[],
) {
  return normalizeLocalizedContentTranslationDrafts(translations, defaultLanguage)
    .filter((translation) => translation.title.trim() || translation.description.trim())
    .map((translation) => ({
      languageCode: translation.languageCode,
      title: translation.title.trim(),
      description: translation.description.trim(),
    }));
}

export function changeLocalizedContentOriginalLanguage(
  draft: LocalizedContentOriginalDraft,
  nextDefaultLanguage: DiscoveryLanguage,
): LocalizedContentOriginalDraft {
  if (draft.defaultLanguage === nextDefaultLanguage) return draft;

  const translations = normalizeLocalizedContentTranslationDrafts(draft.translations, draft.defaultLanguage);
  const promotedTranslation = translations.find((translation) => translation.languageCode === nextDefaultLanguage);
  const hasPromotedContent = Boolean(promotedTranslation?.title.trim() || promotedTranslation?.description.trim());
  const remainingTranslations = translations.filter((translation) => translation.languageCode !== nextDefaultLanguage);

  if (!hasPromotedContent) {
    return {
      ...draft,
      defaultLanguage: nextDefaultLanguage,
      translations: normalizeLocalizedContentTranslationDrafts(remainingTranslations, nextDefaultLanguage),
    };
  }

  const previousOriginal: LocalizedContentTranslationDraft = {
    languageCode: draft.defaultLanguage,
    title: draft.title,
    description: draft.description,
  };

  return {
    defaultLanguage: nextDefaultLanguage,
    title: promotedTranslation?.title.trim() ? promotedTranslation.title : draft.title,
    description: promotedTranslation?.description.trim() ? promotedTranslation.description : draft.description,
    translations: normalizeLocalizedContentTranslationDrafts(
      [...remainingTranslations, previousOriginal],
      nextDefaultLanguage,
    ),
  };
}
