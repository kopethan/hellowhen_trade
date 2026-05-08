import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppScreen } from './AppScreen';
import { useThemeTokens } from '../providers/ThemeProvider';

type AppFixedHeaderScreenProps = {
  header: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
};

export function AppFixedHeaderScreen({ header, children, style, headerStyle, bodyStyle }: AppFixedHeaderScreenProps) {
  const theme = useThemeTokens();

  return (
    <AppScreen style={[styles.screen, style]}>
      <View style={[styles.header, { backgroundColor: theme.color.background }, headerStyle]}>{header}</View>
      <View style={[styles.body, bodyStyle]}>{children}</View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 0 },
  header: { zIndex: 10, paddingBottom: 14 },
  body: { flex: 1, minHeight: 0 },
});
