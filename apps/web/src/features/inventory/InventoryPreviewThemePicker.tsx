'use client';

import { useEffect, useState } from 'react';
import type { PreviewCardTheme } from '@hellowhen/contracts';
import { PREVIEW_CARD_THEME_DESCRIPTIONS, PREVIEW_CARD_THEME_LABELS, PREVIEW_CARD_THEMES, previewCardThemeClassName } from '@hellowhen/shared';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { useWebAuth } from '../../providers/WebAuthProvider';

type InventoryPreviewThemePickerProps = {
  value: PreviewCardTheme;
  onChange: (theme: PreviewCardTheme) => void;
  disabled?: boolean;
};

export function InventoryPreviewThemePicker({ value, onChange, disabled }: InventoryPreviewThemePickerProps) {
  const auth = useWebAuth();
  const [canCustomize, setCanCustomize] = useState(false);

  useEffect(() => {
    if (!betaFeatures.plusSubscriptionFeatures.customizationEnabled || !auth.hydrated || !auth.isAuthenticated) {
      setCanCustomize(false);
      return;
    }
    let mounted = true;
    async function loadPlusSnapshot() {
      try {
        const response = await api.plus.me();
        if (mounted) setCanCustomize(Boolean(response.access.entitlements.customization));
      } catch {
        if (mounted) setCanCustomize(false);
      }
    }
    void loadPlusSnapshot();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);

  if (!betaFeatures.plusSubscriptionFeatures.customizationEnabled) return null;

  return (
    <section className="mobile-card mobile-card--soft inventory-preview-theme-picker">
      <div className="inventory-form__helper-copy">
        <strong>Preview card theme</strong>
        <span>{canCustomize ? 'Choose an approved Plus theme for the first preview card.' : 'Preview themes are a hidden Plus customization preview.'}</span>
      </div>
      <div className="inventory-preview-theme-picker__grid" aria-label="Preview card theme">
        {PREVIEW_CARD_THEMES.map((theme) => {
          const selected = value === theme;
          return (
            <button
              key={theme}
              type="button"
              className={["inventory-preview-theme-option", previewCardThemeClassName(theme), selected ? 'is-selected' : null].filter(Boolean).join(' ')}
              onClick={() => onChange(theme)}
              disabled={disabled || !canCustomize}
              aria-pressed={selected}
            >
              <span className="inventory-preview-theme-option__swatch" aria-hidden="true" />
              <strong>{PREVIEW_CARD_THEME_LABELS[theme]}</strong>
              <small>{PREVIEW_CARD_THEME_DESCRIPTIONS[theme]}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
