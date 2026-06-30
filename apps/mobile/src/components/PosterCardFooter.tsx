import React, { type PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type PosterCardFooterProps = PropsWithChildren<{
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  surfaceStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/**
 * Shared footer layout for mobile poster cards.
 *
 * This component intentionally does not draw a visible glass panel. The lower
 * poster atmosphere is owned by LowerImageAtmosphere so Trade and Plan cards
 * stay visually aligned with the web card style: text sits over the image wash,
 * not inside a separate rounded box.
 */
export function PosterCardFooter({ enabled = true, style, surfaceStyle, contentStyle, children }: PosterCardFooterProps) {
  if (!enabled) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={style}>
      <View style={[surfaceStyle, contentStyle]}>{children}</View>
    </View>
  );
}
