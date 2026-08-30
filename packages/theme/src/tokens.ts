export const semanticColors = {
  need: {
    bg: '#2563EB',
    onBg: '#FFFFFF',
    text: '#1E3A8A',
    softBg: '#DBEAFE',
    border: '#93C5FD',
  },
  offer: {
    bg: '#15803D',
    onBg: '#FFFFFF',
    text: '#166534',
    softBg: '#DCFCE7',
    border: '#86EFAC',
  },
  trade: {
    bg: '#A21CAF',
    onBg: '#FFFFFF',
    text: '#86198F',
    softBg: '#FAE8FF',
    border: '#F0ABFC',
  },
  proposal: {
    bg: '#0F766E',
    onBg: '#FFFFFF',
    text: '#115E59',
    softBg: '#CCFBF1',
    border: '#5EEAD4',
  },
  plan: {
    bg: '#7C3AED',
    onBg: '#FFFFFF',
    text: '#5B21B6',
    softBg: '#EDE9FE',
    border: '#C4B5FD',
  },
  place: {
    bg: '#0E7490',
    onBg: '#FFFFFF',
    text: '#155E75',
    softBg: '#CFFAFE',
    border: '#67E8F9',
  },
  time: {
    bg: '#F97316',
    onBg: '#09090B',
    text: '#9A3412',
    softBg: '#FFEDD5',
    border: '#FDBA74',
  },
  danger: {
    bg: '#DC2626',
    onBg: '#FFFFFF',
    text: '#991B1B',
    softBg: '#FEE2E2',
    border: '#FCA5A5',
  },
  instruction: {
    bg: '#334155',
    onBg: '#FFFFFF',
    text: '#334155',
    softBg: '#F1F5F9',
    border: '#CBD5E1',
  },
  info: {
    bg: '#0284C7',
    onBg: '#09090B',
    text: '#075985',
    softBg: '#E0F2FE',
    border: '#7DD3FC',
  },
  success: {
    bg: '#059669',
    onBg: '#09090B',
    text: '#047857',
    softBg: '#D1FAE5',
    border: '#6EE7B7',
  },
  warning: {
    bg: '#F59E0B',
    onBg: '#09090B',
    text: '#92400E',
    softBg: '#FEF3C7',
    border: '#FCD34D',
  },
  credits: {
    bg: '#D97706',
    onBg: '#09090B',
    text: '#92400E',
    softBg: '#FEF3C7',
    border: '#FBBF24',
  },
  admin: {
    bg: '#0F172A',
    onBg: '#FFFFFF',
    text: '#1E293B',
    softBg: '#E2E8F0',
    border: '#94A3B8',
  },
  muted: {
    bg: '#64748B',
    onBg: '#FFFFFF',
    text: '#475569',
    softBg: '#F1F5F9',
    border: '#CBD5E1',
  },
} as const;

export type SemanticColorName = keyof typeof semanticColors;
export type SemanticTone = { bg: string; onBg: string; text: string; softBg: string; border: string };
export type SemanticPalette = Record<SemanticColorName, SemanticTone>;

export const semanticColorsDark: SemanticPalette = {
  need: { bg: '#60A5FA', onBg: '#172554', text: '#BFDBFE', softBg: '#172554', border: '#1D4ED8' },
  offer: { bg: '#4ADE80', onBg: '#052E16', text: '#BBF7D0', softBg: '#052E16', border: '#15803D' },
  trade: { bg: '#E879F9', onBg: '#1A1020', text: '#F5D0FE', softBg: '#4A044E', border: '#A21CAF' },
  proposal: { bg: '#2DD4BF', onBg: '#042F2E', text: '#CCFBF1', softBg: '#042F2E', border: '#0F766E' },
  plan: { bg: '#A78BFA', onBg: '#1B1035', text: '#DDD6FE', softBg: '#2E1065', border: '#6D28D9' },
  place: { bg: '#22D3EE', onBg: '#082F49', text: '#A5F3FC', softBg: '#083344', border: '#0E7490' },
  time: { bg: '#FB923C', onBg: '#431407', text: '#FED7AA', softBg: '#431407', border: '#C2410C' },
  danger: { bg: '#F87171', onBg: '#450A0A', text: '#FECACA', softBg: '#450A0A', border: '#B91C1C' },
  instruction: { bg: '#CBD5E1', onBg: '#0F172A', text: '#E2E8F0', softBg: '#1E293B', border: '#475569' },
  info: { bg: '#38BDF8', onBg: '#082F49', text: '#BAE6FD', softBg: '#082F49', border: '#0369A1' },
  success: { bg: '#34D399', onBg: '#022C22', text: '#A7F3D0', softBg: '#022C22', border: '#047857' },
  warning: { bg: '#FBBF24', onBg: '#451A03', text: '#FDE68A', softBg: '#451A03', border: '#B45309' },
  credits: { bg: '#FBBF24', onBg: '#451A03', text: '#FDE68A', softBg: '#451A03', border: '#B45309' },
  admin: { bg: '#E2E8F0', onBg: '#0F172A', text: '#E2E8F0', softBg: '#1E293B', border: '#64748B' },
  muted: { bg: '#94A3B8', onBg: '#0F172A', text: '#CBD5E1', softBg: '#1F2937', border: '#475569' },
};

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

const radiusTokens = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
} as const;

const spacingTokens = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type ThemeMode = 'light' | 'dark';
export type ThemeColorTokens = {
  background: string;
  surface: string;
  elevated: string;
  subtleSurface: string;
  text: string;
  muted: string;
  border: string;
  inverseBackground: string;
  inverseSurface: string;
  inverseText: string;
};

export type ThemeTokens = {
  mode: ThemeMode;
  radius: typeof radiusTokens;
  spacing: typeof spacingTokens;
  color: ThemeColorTokens;
  semantic: SemanticPalette;
};

export const themeTokens: ThemeTokens = {
  mode: 'light',
  radius: radiusTokens,
  spacing: spacingTokens,
  color: {
    background: '#F7F7F4',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    subtleSurface: '#F8FAFC',
    text: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    inverseBackground: '#101011',
    inverseSurface: '#171719',
    inverseText: '#F8FAFC',
  },
  semantic: semanticColors as SemanticPalette,
};

export const darkThemeTokens: ThemeTokens = {
  mode: 'dark',
  radius: radiusTokens,
  spacing: spacingTokens,
  color: {
    background: '#09090B',
    surface: '#111113',
    elevated: '#18181B',
    subtleSurface: '#1F2937',
    text: '#F8FAFC',
    muted: '#A1A1AA',
    border: '#27272A',
    inverseBackground: '#F7F7F4',
    inverseSurface: '#FFFFFF',
    inverseText: '#0F172A',
  },
  semantic: semanticColorsDark,
};

export function getThemeTokens(mode: ThemeMode): ThemeTokens {
  return mode === 'dark' ? darkThemeTokens : themeTokens;
}
