import type { PropsWithChildren } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeTokens } from '../providers/ThemeProvider';

export function AppCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useThemeTokens();
  return <View style={[styles.card, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
});
