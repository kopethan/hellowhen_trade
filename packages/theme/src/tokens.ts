export const accentColors = {
  rose: '#f43f5e',
  sky: '#0ea5e9',
  sun: '#f59e0b',
  teal: '#14b8a6',
  violet: '#8b5cf6',
} as const;

export type AccentColorName = keyof typeof accentColors;

export const themeTokens = {
  radius: {
    sm: 8,
    md: 14,
    lg: 22,
    xl: 28,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  color: {
    background: '#f7f7f4',
    surface: '#ffffff',
    text: '#171717',
    muted: '#6b7280',
    border: '#e5e7eb',
    inverseBackground: '#101011',
    inverseSurface: '#171719',
    inverseText: '#f8fafc',
  },
} as const;
