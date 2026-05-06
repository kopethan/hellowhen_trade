import React from 'react';
import { Text, TextProps } from 'react-native';
import { useThemeTokens } from '../providers/ThemeProvider';

export function AppText({ style, ...props }: TextProps) {
  const theme = useThemeTokens();
  return <Text {...props} style={[{ color: theme.color.text }, style]} />;
}
