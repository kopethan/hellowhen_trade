import type { DiscoveryLanguage, InventoryTranslationDto } from '@hellowhen/contracts';
import {
  INVENTORY_DESCRIPTION_MAX_LENGTH,
  INVENTORY_DESCRIPTION_MIN_LENGTH,
  INVENTORY_TITLE_MAX_LENGTH,
  INVENTORY_TITLE_MIN_LENGTH,
} from '@hellowhen/contracts/src/inventoryLimits';
import {
  addLocalizedContentTranslationDraft,
  buildLocalizedContentTranslationsPayload,
  changeLocalizedContentOriginalLanguage,
  getAvailableLocalizedContentTranslationLanguages,
  normalizeLocalizedContentTranslationDrafts,
  removeLocalizedContentTranslationDraft,
  supportedLocalizedContentLanguages,
  updateLocalizedContentTranslationDraft,
  type LocalizedContentOriginalDraft,
  type LocalizedContentTranslationDraft,
} from '../localizedContentTranslations';

export type InventoryTranslationDraft = LocalizedContentTranslationDraft;
export type InventoryOriginalLanguageDraft = LocalizedContentOriginalDraft;

export type InventoryTranslationValidationIssue =
  | 'incomplete'
  | 'title_too_short'
  | 'title_too_long'
  | 'description_too_short'
  | 'description_too_long';

export const supportedInventoryLanguages = supportedLocalizedContentLanguages;

export function normalizeInventoryTranslationDrafts(
  translations: readonly Partial<InventoryTranslationDraft | InventoryTranslationDto>[] | null | undefined,
  defaultLanguage: DiscoveryLanguage,
) {
  return normalizeLocalizedContentTranslationDrafts(translations, defaultLanguage);
}

export function inventoryTranslationDraftsFromItem(
  translations: readonly Partial<InventoryTranslationDto>[] | null | undefined,
  defaultLanguage: DiscoveryLanguage,
) {
  return normalizeInventoryTranslationDrafts(translations, defaultLanguage);
}

export function getAvailableInventoryTranslationLanguages(
  defaultLanguage: DiscoveryLanguage,
  translations: readonly InventoryTranslationDraft[],
) {
  return getAvailableLocalizedContentTranslationLanguages(defaultLanguage, translations);
}

export function addInventoryTranslationDraft(
  translations: readonly InventoryTranslationDraft[],
  defaultLanguage: DiscoveryLanguage,
  languageCode: DiscoveryLanguage,
) {
  return addLocalizedContentTranslationDraft(translations, defaultLanguage, languageCode);
}

export function updateInventoryTranslationDraft(
  translations: readonly InventoryTranslationDraft[],
  defaultLanguage: DiscoveryLanguage,
  draft: InventoryTranslationDraft,
) {
  return updateLocalizedContentTranslationDraft(translations, defaultLanguage, draft);
}

export function removeInventoryTranslationDraft(
  translations: readonly InventoryTranslationDraft[],
  languageCode: DiscoveryLanguage,
) {
  return removeLocalizedContentTranslationDraft(translations, languageCode);
}

export function upsertInventoryTranslationDraft(
  translations: readonly InventoryTranslationDraft[],
  defaultLanguage: DiscoveryLanguage,
  draft: InventoryTranslationDraft,
) {
  return updateInventoryTranslationDraft(translations, defaultLanguage, draft);
}

export function hasInventoryTranslationDraftContent(translations: readonly InventoryTranslationDraft[]) {
  return translations.some((translation) => translation.title.trim() || translation.description.trim());
}

export function buildInventoryTranslationsPayload(
  defaultLanguage: DiscoveryLanguage,
  translations: readonly InventoryTranslationDraft[],
) {
  return buildLocalizedContentTranslationsPayload(defaultLanguage, translations);
}

export function validateInventoryTranslationDrafts(
  defaultLanguage: DiscoveryLanguage,
  translations: readonly InventoryTranslationDraft[],
): InventoryTranslationValidationIssue | null {
  for (const translation of buildInventoryTranslationsPayload(defaultLanguage, translations)) {
    if (!translation.title || !translation.description) return 'incomplete';
    if (translation.title.length < INVENTORY_TITLE_MIN_LENGTH) return 'title_too_short';
    if (translation.title.length > INVENTORY_TITLE_MAX_LENGTH) return 'title_too_long';
    if (translation.description.length < INVENTORY_DESCRIPTION_MIN_LENGTH) return 'description_too_short';
    if (translation.description.length > INVENTORY_DESCRIPTION_MAX_LENGTH) return 'description_too_long';
  }
  return null;
}

export function inventoryTranslationDraftsEqual(
  left: readonly InventoryTranslationDraft[],
  right: readonly InventoryTranslationDraft[],
  defaultLanguage: DiscoveryLanguage,
) {
  const normalizeForCompare = (translations: readonly InventoryTranslationDraft[]) => normalizeInventoryTranslationDrafts(
    translations,
    defaultLanguage,
  ).map((translation) => ({
    languageCode: translation.languageCode,
    title: translation.title,
    description: translation.description,
  }));
  return JSON.stringify(normalizeForCompare(left)) === JSON.stringify(normalizeForCompare(right));
}

export function changeInventoryOriginalLanguage(
  draft: InventoryOriginalLanguageDraft,
  nextDefaultLanguage: DiscoveryLanguage,
): InventoryOriginalLanguageDraft {
  return changeLocalizedContentOriginalLanguage(draft, nextDefaultLanguage);
}

export function restoreLegacyInventoryTranslationDraft(
  defaultLanguage: DiscoveryLanguage,
  title: unknown,
  description: unknown,
  enabled: unknown,
) {
  const cleanTitle = typeof title === 'string' ? title : '';
  const cleanDescription = typeof description === 'string' ? description : '';
  if (!enabled && !cleanTitle.trim() && !cleanDescription.trim()) return [];
  const languageCode: DiscoveryLanguage = defaultLanguage === 'en' ? 'fr' : 'en';
  return [{ languageCode, title: cleanTitle, description: cleanDescription }];
}
