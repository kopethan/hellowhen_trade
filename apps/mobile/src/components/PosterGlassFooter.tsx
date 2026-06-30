import React, { type PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type PosterGlassFooterProps = PropsWithChildren<{
  enabled?: boolean;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  glassStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function PosterGlassFooter({ enabled = true, style, glassStyle, contentStyle, children }: PosterGlassFooterProps) {
  if (!enabled) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={style}>
      <View style={[glassStyle, contentStyle]}>{children}</View>
    </View>
  );
}
