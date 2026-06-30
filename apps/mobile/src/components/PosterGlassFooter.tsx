import React, { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type PosterGlassFooterProps = PropsWithChildren<{
  enabled?: boolean;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  glassStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function PosterGlassFooter({ enabled = true, isDark, style, glassStyle, contentStyle, children }: PosterGlassFooterProps) {
  if (!enabled) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={style}>
      <View
        style={[
          styles.glass,
          {
            backgroundColor: isDark ? 'rgba(3,9,13,0.2)' : 'rgba(4,13,12,0.17)',
            borderColor: 'rgba(255,255,255,0.1)',
          },
          glassStyle,
        ]}
      >
        <View pointerEvents="none" style={[styles.softWash, { backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.045)' }]} />
        <View pointerEvents="none" style={[styles.lowerVeil, { backgroundColor: isDark ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.035)' }]} />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
  },
  softWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '46%',
  },
  lowerVeil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
  },
  content: {
    position: 'relative',
  },
});
