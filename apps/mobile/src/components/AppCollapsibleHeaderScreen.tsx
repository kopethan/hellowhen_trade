import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { AppScreen } from './AppScreen';
import { useThemeTokens } from '../providers/ThemeProvider';

export type AppCollapsibleHeaderScrollProps = {
  onScroll: NonNullable<React.ComponentProps<typeof ScrollView>['onScroll']>;
  scrollEventThrottle: number;
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

  const handleScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false },
      ),
    [scrollY],
  );

  const scrollProps = useMemo<AppCollapsibleHeaderScrollProps>(() => ({ onScroll: handleScroll, scrollEventThrottle: 16 }), [handleScroll]);

  const headerAnimatedStyle = useMemo(() => {
    if (!headerHeight) return null;
    const collapseDistance = Math.max(88, Math.min(160, headerHeight + 28));
    const collapse = scrollY.interpolate({
      inputRange: [0, 28, collapseDistance],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    });

    return {
      maxHeight: collapse.interpolate({ inputRange: [0, 1], outputRange: [headerHeight, 0] }),
      opacity: collapse.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 0.18, 0] }),
      transform: [
        {
          translateY: collapse.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }),
        },
      ],
    };
  }, [headerHeight, scrollY]);

  const renderedChildren = typeof children === 'function' ? children(scrollProps) : children;

  return (
    <AppScreen style={[styles.screen, style]}>
      <Animated.View style={[styles.headerClip, headerAnimatedStyle]}>
        <View onLayout={handleHeaderLayout} style={[styles.header, { backgroundColor: theme.color.background }, headerStyle]}>
          {header}
        </View>
      </Animated.View>
      <View style={[styles.body, bodyStyle]}>{renderedChildren}</View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 0 },
  headerClip: { overflow: 'hidden', zIndex: 10 },
  header: { paddingBottom: 14 },
  body: { flex: 1, minHeight: 0 },
});
