import { useCallback, useMemo } from 'react';
import type { InventoryDisplayLanguage } from '@hellowhen/contracts';
import { resolveInventoryDisplayCopy } from '@hellowhen/shared';
import { useAppSettings } from '../../providers/AppSettingsProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import type { NeedItem, OfferItem } from './types';

type InventoryDisplayable = Pick<
  NeedItem | OfferItem,
  'title' | 'description' | 'defaultLanguage' | 'translations' | 'displayLanguage'
>;

type LocalizedInventoryItem<T extends InventoryDisplayable> = T & {
  displayLanguage: InventoryDisplayLanguage;
};

function sourceInventoryCopy(item: InventoryDisplayable) {
  const options = item.displayLanguage?.options ?? [];
  const defaultLanguage = item.defaultLanguage ?? 'en';
  const original = options.find((option) => option.isOriginal)
    ?? options.find((option) => option.languageCode === defaultLanguage);

  if (!original) return item;
  const originalLanguage = original.languageCode ?? defaultLanguage;

  return {
    title: original.title,
    description: original.description,
    defaultLanguage: originalLanguage,
    translations: options
      .filter((option) => option.languageCode !== original.languageCode)
      .map((option) => ({
        languageCode: option.languageCode,
        title: option.title,
        description: option.description,
        source: option.source,
      })),
  };
}

export function resolveMobileInventoryDisplay<T extends InventoryDisplayable>(
  item: T,
  viewerLanguage?: string | null,
  preferredLanguages?: readonly (string | null | undefined)[] | null,
): LocalizedInventoryItem<T> {
  const display = resolveInventoryDisplayCopy(
    sourceInventoryCopy(item),
    viewerLanguage,
    preferredLanguages,
  );

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

export function useInventoryDisplayResolver() {
  const { language } = useTranslation();
  const { settings } = useAppSettings();

  return useCallback(
    <T extends InventoryDisplayable>(item: T) => resolveMobileInventoryDisplay(
      item,
      language,
      settings.contentLanguageOrder,
    ),
    [language, settings.contentLanguageOrder],
  );
}

export function useLocalizedInventoryItem<T extends InventoryDisplayable>(item: T | null | undefined) {
  const resolveDisplay = useInventoryDisplayResolver();
  return useMemo(() => item ? resolveDisplay(item) : null, [item, resolveDisplay]);
}

export function useLocalizedInventoryItems<T extends InventoryDisplayable>(items: readonly T[]) {
  const resolveDisplay = useInventoryDisplayResolver();
  return useMemo(() => items.map((item) => resolveDisplay(item)), [items, resolveDisplay]);
}
