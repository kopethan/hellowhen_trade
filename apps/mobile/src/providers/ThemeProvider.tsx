import React, { createContext, useContext } from 'react';
import { themeTokens } from '@hellowhen/theme';

const ThemeContext = createContext(themeTokens);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={themeTokens}>{children}</ThemeContext.Provider>;
}

export function useThemeTokens() {
  return useContext(ThemeContext);
}
