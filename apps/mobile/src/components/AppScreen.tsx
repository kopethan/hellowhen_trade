import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle } from 'react-native';
import { useThemeTokens } from '../providers/ThemeProvider';

export function AppScreen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const theme = useThemeTokens();
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.color.background }, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 18,
  },
});
