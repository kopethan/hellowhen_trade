'use client';

import type { InventoryDisplayLanguage } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { inventoryLanguageLabel, type InventoryI18n } from './inventoryPresentation';

type LanguageOption = NonNullable<InventoryDisplayLanguage['options']>[number];

type UseContentLanguageDetailSelectionInput = {
  displayLanguage?: InventoryDisplayLanguage | null;
  fallbackTitle: string;
  fallbackDescription?: string | null;
};

export function useContentLanguageDetailSelection({ displayLanguage, fallbackTitle, fallbackDescription }: UseContentLanguageDetailSelectionInput) {
  const initialLanguage = displayLanguage?.languageCode ?? '';
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);

  useEffect(() => {
    setSelectedLanguage(initialLanguage);
  }, [initialLanguage]);

  const options = useMemo(() => displayLanguage?.options ?? [], [displayLanguage?.options]);
  const activeLanguage = selectedLanguage || displayLanguage?.languageCode || '';
  const activeOption = options.find((option) => option.languageCode === activeLanguage) ?? null;

  return {
    title: activeOption?.title ?? fallbackTitle,
    description: activeOption?.description ?? fallbackDescription ?? '',
    selectedLanguage: activeLanguage,
    setSelectedLanguage,
    options,
  };
}

function shouldShowControls(displayLanguage?: InventoryDisplayLanguage | null, options?: readonly LanguageOption[]) {
  if (!displayLanguage?.languageCode) return false;
  if ((options?.length ?? 0) > 1) return true;
  return displayLanguage.source !== 'exact';
}

export function ContentLanguageDetailControls({
  displayLanguage,
  selectedLanguage,
  onSelectLanguage,
  i18n,
}: {
  displayLanguage?: InventoryDisplayLanguage | null;
  selectedLanguage: string;
  onSelectLanguage: (languageCode: string) => void;
  i18n?: InventoryI18n;
}) {
  const options = displayLanguage?.options ?? [];
  if (!shouldShowControls(displayLanguage, options)) return null;

  const activeLanguage = selectedLanguage || displayLanguage?.languageCode || options[0]?.languageCode || 'en';
  const activeLabel = inventoryLanguageLabel(activeLanguage, i18n);
  const firstRequested = displayLanguage?.requestedLanguages?.[0] ?? null;
  const missingRequested = firstRequested && firstRequested !== activeLanguage && !(displayLanguage?.availableLanguages ?? []).includes(firstRequested as any)
    ? inventoryLanguageLabel(firstRequested, i18n)
    : null;

  return (
    <div className="content-language-detail" aria-label="Content language">
      <div className="content-language-detail__summary">
        <span className="semantic-badge instruction">{activeLabel}</span>
        {missingRequested ? <small>{missingRequested} not available</small> : null}
      </div>
      {options.length > 1 ? (
        <div className="content-language-detail__options" role="group" aria-label="Available content languages">
          {options.map((option) => {
            const active = option.languageCode === activeLanguage;
            return (
              <button
                key={option.languageCode}
                type="button"
                className={active ? 'is-active' : undefined}
                aria-pressed={active}
                onClick={() => onSelectLanguage(option.languageCode)}
              >
                {inventoryLanguageLabel(option.languageCode, i18n)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
