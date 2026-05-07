export const accentColors = {
  rose: '#f43f5e',
  sky: '#0ea5e9',
  sun: '#f59e0b',
  teal: '#14b8a6',
  violet: '#8b5cf6',
} as const;

export type AccentColorName = keyof typeof accentColors;

export const semanticColors = {
  need: {
    bg: '#2563EB',
    text: '#1E3A8A',
    softBg: '#DBEAFE',
    border: '#93C5FD',
  },
  offer: {
    bg: '#16A34A',
    text: '#166534',
    softBg: '#DCFCE7',
    border: '#86EFAC',
  },
  trade: {
    bg: '#7C3AED',
    text: '#5B21B6',
    softBg: '#EDE9FE',
    border: '#C4B5FD',
  },
  proposal: {
    bg: '#0F766E',
    text: '#115E59',
    softBg: '#CCFBF1',
    border: '#5EEAD4',
  },
  time: {
    bg: '#F97316',
    text: '#9A3412',
    softBg: '#FFEDD5',
    border: '#FDBA74',
  },
  danger: {
    bg: '#DC2626',
    text: '#991B1B',
    softBg: '#FEE2E2',
    border: '#FCA5A5',
  },
  instruction: {
    bg: '#4F46E5',
    text: '#3730A3',
    softBg: '#EEF2FF',
    border: '#A5B4FC',
  },
  info: {
    bg: '#0284C7',
    text: '#075985',
    softBg: '#E0F2FE',
    border: '#7DD3FC',
  },
  success: {
    bg: '#059669',
    text: '#047857',
    softBg: '#D1FAE5',
    border: '#6EE7B7',
  },
  warning: {
    bg: '#F59E0B',
    text: '#92400E',
    softBg: '#FEF3C7',
    border: '#FCD34D',
  },
  credits: {
    bg: '#D97706',
    text: '#92400E',
    softBg: '#FEF3C7',
    border: '#FBBF24',
  },
  admin: {
    bg: '#0F172A',
    text: '#1E293B',
    softBg: '#E2E8F0',
    border: '#94A3B8',
  },
  muted: {
    bg: '#64748B',
    text: '#475569',
    softBg: '#F1F5F9',
    border: '#CBD5E1',
  },
} as const;

export type SemanticColorName = keyof typeof semanticColors;

export const semanticStatusTone = {
  draft: 'muted',
  active: 'success',
  funded: 'credits',
  in_progress: 'instruction',
  submitted: 'info',
  completed: 'success',
  disputed: 'danger',
  expired: 'time',
  closed: 'muted',
  cancelled: 'danger',
  fulfilled: 'success',
  accepted: 'success',
  pending: 'warning',
  declined: 'danger',
  withdrawn: 'muted',
  pending_review: 'warning',
  flagged: 'danger',
  removed: 'admin',
} as const satisfies Record<string, SemanticColorName>;

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
  semantic: semanticColors,
} as const;
