export const PREVIEW_CARD_THEMES = ['default', 'blue', 'green', 'purple', 'amber', 'rose'] as const;
export type PreviewCardTheme = typeof PREVIEW_CARD_THEMES[number];

export const DEFAULT_PREVIEW_CARD_THEME: PreviewCardTheme = 'default';

export const PREVIEW_CARD_THEME_LABELS: Record<PreviewCardTheme, string> = {
  default: 'Default',
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple',
  amber: 'Amber',
  rose: 'Rose',
};

export const PREVIEW_CARD_THEME_DESCRIPTIONS: Record<PreviewCardTheme, string> = {
  default: 'Use the standard Hellowhen preview style.',
  blue: 'A calm blue preview accent.',
  green: 'A fresh green preview accent.',
  purple: 'A soft purple preview accent.',
  amber: 'A warm amber preview accent.',
  rose: 'A warm rose preview accent.',
};

export function normalizePreviewCardTheme(value: string | null | undefined): PreviewCardTheme {
  const normalized = String(value ?? DEFAULT_PREVIEW_CARD_THEME).trim().toLowerCase();
  return (PREVIEW_CARD_THEMES as readonly string[]).includes(normalized) ? normalized as PreviewCardTheme : DEFAULT_PREVIEW_CARD_THEME;
}

export function previewCardThemeClassName(theme: string | null | undefined, prefix = 'preview-theme') {
  return `${prefix}--${normalizePreviewCardTheme(theme)}`;
}

export function isDefaultPreviewCardTheme(theme: string | null | undefined) {
  return normalizePreviewCardTheme(theme) === DEFAULT_PREVIEW_CARD_THEME;
}
