'use client';

import { useEffect, useState } from 'react';
import type { MediaAssetDto, PlaceStaticMapDto } from '@hellowhen/contracts';
import { planMediaSrc } from './plansPresentation';

export type PlaceVisualThemeMode = 'light' | 'dark';
export type PlaceVisualKind = 'media' | 'static_map' | 'fallback';

export type PlaceVisual = {
  url: string | null;
  kind: PlaceVisualKind;
};

function readResolvedThemeMode(): PlaceVisualThemeMode {
  if (typeof window === 'undefined') return 'light';
  const htmlTheme = document.documentElement.dataset.theme;
  if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useResolvedPlaceVisualTheme(): PlaceVisualThemeMode {
  const [mode, setMode] = useState<PlaceVisualThemeMode>('light');

  useEffect(() => {
    const updateMode = () => setMode(readResolvedThemeMode());
    updateMode();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener?.('change', updateMode);
    const observer = new MutationObserver(updateMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      mediaQuery.removeEventListener?.('change', updateMode);
      observer.disconnect();
    };
  }, []);

  return mode;
}

export function staticMapUrlForTheme(staticMap?: PlaceStaticMapDto | null, themeMode: PlaceVisualThemeMode = 'light') {
  if (!staticMap) return null;
  return themeMode === 'dark' ? staticMap.darkUrl || staticMap.lightUrl || null : staticMap.lightUrl || staticMap.darkUrl || null;
}

export function resolvePlaceVisual({
  media,
  staticMap,
  themeMode,
}: {
  media?: MediaAssetDto | null;
  staticMap?: PlaceStaticMapDto | null;
  themeMode?: PlaceVisualThemeMode;
}): PlaceVisual {
  const mediaUrl = planMediaSrc(media ?? null);
  if (mediaUrl) return { url: mediaUrl, kind: 'media' };

  const staticMapUrl = staticMapUrlForTheme(staticMap, themeMode ?? 'light');
  if (staticMapUrl) return { url: staticMapUrl, kind: 'static_map' };

  return { url: null, kind: 'fallback' };
}
