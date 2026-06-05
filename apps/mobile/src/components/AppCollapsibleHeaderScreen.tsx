import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { AppScreen } from './AppScreen';
import { useThemeTokens } from '../providers/ThemeProvider';

const FALLBACK_HEADER_INSET = 132;

type ScrollViewProps = React.ComponentProps<typeof ScrollView>;

export type AppCollapsibleHeaderNativeScrollProps = {
  onScroll: NonNullable<ScrollViewProps['onScroll']>;
  scrollEventThrottle: number;
};

export type AppCollapsibleHeaderScrollProps = {
  scrollViewProps: AppCollapsibleHeaderNativeScrollProps;
  contentInsetStyle: ViewStyle;
  contentTopInset: number;
};

type AppCollapsibleHeaderScreenProps = {
  header: React.ReactNode;
  children: React.ReactNode | ((scrollProps: AppCollapsibleHeaderScrollProps) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  resetKey?: string | number;
};

export function AppCollapsibleHeaderScreen({ header, children, style, headerStyle, bodyStyle, resetKey }: AppCollapsibleHeaderScreenProps) {
  const theme = useThemeTokens();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    scrollY.setValue(0);
  }, [resetKey, scrollY]);

  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setHeaderHeight((current) => (nextHeight > current + 1 || current === 0 ? nextHeight : current));
  }, []);

  const handleScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>(
    (event) => {
      scrollY.setValue(Math.max(0, event.nativeEvent.contentOffset.y));
    },
    [scrollY],
  );

  const contentTopInset = headerHeight || FALLBACK_HEADER_INSET;

  const scrollProps = useMemo<AppCollapsibleHeaderScrollProps>(
    () => ({
      scrollViewProps: {
        onScroll: handleScroll,
        scrollEventThrottle: 16,
      },
      contentInsetStyle: { paddingTop: contentTopInset },
      contentTopInset,
    }),
    [contentTopInset, handleScroll],
  );

  const headerAnimatedStyle = useMemo(() => {
    const measuredHeight = headerHeight || FALLBACK_HEADER_INSET;
    const collapseDistance = Math.max(72, Math.min(148, measuredHeight));

    return {
      opacity: scrollY.interpolate({
        inputRange: [0, 18, collapseDistance],
        outputRange: [1, 0.98, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: scrollY.interpolate({
            inputRange: [0, collapseDistance],
            outputRange: [0, -(measuredHeight + 18)],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [headerHeight, scrollY]);

  const renderedChildren = typeof children === 'function' ? children(scrollProps) : children;

  return (
    <AppScreen style={[styles.screen, style]}>
      <View style={[styles.body, bodyStyle]}>{renderedChildren}</View>
      <Animated.View pointerEvents="box-none" style={[styles.headerOverlay, headerAnimatedStyle]}>
        <View onLayout={handleHeaderLayout} style={[styles.header, { backgroundColor: theme.color.background }, headerStyle]}>
          {header}
        </View>
      </Animated.View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 0 },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
  header: { paddingBottom: 14 },
  body: { flex: 1, minHeight: 0 },
});
