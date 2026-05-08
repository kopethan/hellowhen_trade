import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../providers/ThemeProvider';

export function AppScreen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.color.background,
          paddingTop: insets.top + 18,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 0,
  },
});
