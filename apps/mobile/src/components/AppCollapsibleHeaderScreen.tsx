import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_SCREEN_HORIZONTAL_PADDING, AppScreen } from './AppScreen';
import { useThemeTokens } from '../providers/ThemeProvider';

const FALLBACK_HEADER_INSET = 132;
const SMART_HEADER_DIRECTION_THRESHOLD = 18;
const SMART_HEADER_ANIMATION_MS = 170;

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

export type AppCollapsibleHeaderScreenProps = {
  header: React.ReactNode;
  children: React.ReactNode | ((scrollProps: AppCollapsibleHeaderScrollProps) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  resetKey?: string | number;
  revealHeaderOnScrollUp?: boolean;
};

export function AppCollapsibleHeaderScreen({ header, children, style, headerStyle, bodyStyle, resetKey, revealHeaderOnScrollUp = false }: AppCollapsibleHeaderScreenProps) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const smartHeaderProgress = useRef(new Animated.Value(0)).current;
  const lastScrollOffsetRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollDirectionDistanceRef = useRef(0);
  const smartHeaderHiddenRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const safeTopOffset = insets.top + 18;

  useEffect(() => {
    scrollY.setValue(0);
    smartHeaderProgress.stopAnimation();
    smartHeaderProgress.setValue(0);
    lastScrollOffsetRef.current = 0;
    scrollDirectionRef.current = null;
    scrollDirectionDistanceRef.current = 0;
    smartHeaderHiddenRef.current = false;
  }, [resetKey, scrollY, smartHeaderProgress]);

  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setHeaderHeight((current) => (nextHeight > current + 1 || current === 0 ? nextHeight : current));
  }, []);

  const setSmartHeaderHidden = useCallback(
    (hidden: boolean) => {
      if (smartHeaderHiddenRef.current === hidden) return;
      smartHeaderHiddenRef.current = hidden;
      smartHeaderProgress.stopAnimation();
      Animated.timing(smartHeaderProgress, {
        toValue: hidden ? 1 : 0,
        duration: SMART_HEADER_ANIMATION_MS,
        useNativeDriver: true,
      }).start();
    },
    [smartHeaderProgress],
  );

  const handleScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>(
    (event) => {
      const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
      scrollY.setValue(nextOffset);

      if (!revealHeaderOnScrollUp) return;

      const previousOffset = lastScrollOffsetRef.current;
      lastScrollOffsetRef.current = nextOffset;

      if (nextOffset <= 1) {
        scrollDirectionRef.current = null;
        scrollDirectionDistanceRef.current = 0;
        setSmartHeaderHidden(false);
        return;
      }

      const delta = nextOffset - previousOffset;
      if (Math.abs(delta) < 1) return;

      const direction: 'up' | 'down' = delta > 0 ? 'down' : 'up';
      if (scrollDirectionRef.current !== direction) {
        scrollDirectionRef.current = direction;
        scrollDirectionDistanceRef.current = 0;
      }

      scrollDirectionDistanceRef.current += Math.abs(delta);
      if (scrollDirectionDistanceRef.current < SMART_HEADER_DIRECTION_THRESHOLD) return;

      scrollDirectionDistanceRef.current = 0;
      setSmartHeaderHidden(direction === 'down');
    },
    [revealHeaderOnScrollUp, scrollY, setSmartHeaderHidden],
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
    const animationDriver = revealHeaderOnScrollUp ? smartHeaderProgress : scrollY;

    if (revealHeaderOnScrollUp) {
      return {
        opacity: animationDriver.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [1, 0.98, 0],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: animationDriver.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -(measuredHeight + 18)],
              extrapolate: 'clamp',
            }),
          },
        ],
      };
    }

    return {
      opacity: animationDriver.interpolate({
        inputRange: [0, 18, collapseDistance],
        outputRange: [1, 0.98, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: animationDriver.interpolate({
            inputRange: [0, collapseDistance],
            outputRange: [0, -(measuredHeight + 18)],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [headerHeight, revealHeaderOnScrollUp, scrollY, smartHeaderProgress]);

  const renderedChildren = typeof children === 'function' ? children(scrollProps) : children;

  return (
    <AppScreen style={[styles.screen, style]}>
      <View style={[styles.body, bodyStyle]}>{renderedChildren}</View>
      <Animated.View pointerEvents="box-none" style={[styles.headerOverlay, { top: safeTopOffset }, headerAnimatedStyle]}>
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
    left: APP_SCREEN_HORIZONTAL_PADDING,
    right: APP_SCREEN_HORIZONTAL_PADDING,
    zIndex: 10,
    elevation: 10,
  },
  header: { paddingBottom: 14 },
  body: { flex: 1, minHeight: 0 },
});
