import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { getThemeTokens, themeTokens, type ThemeMode, type ThemeTokens } from '@hellowhen/theme';
import { useAppSettings } from './AppSettingsProvider';

const ThemeContext = createContext<ThemeTokens>(themeTokens);

function resolveThemeMode(appearance: string | undefined, systemScheme: 'light' | 'dark' | null | undefined): ThemeMode {
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();
  const systemScheme = useColorScheme();
  const mode = resolveThemeMode(settings.appearance, systemScheme);
  const tokens = useMemo(() => getThemeTokens(mode), [mode]);

  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

export function useThemeTokens() {
  return useContext(ThemeContext);
}
