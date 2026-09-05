import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { AppText } from './AppText';
import { MobileIcon } from './MobileIcon';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useThemeTokens } from '../providers/ThemeProvider';
import { useTranslation } from '../providers/MobileI18nProvider';
import { SECONDARY_HEADER_TITLE_STYLE } from './headerTypography';

export type AppHeaderTitleOverflowBehavior = 'truncate' | 'scroll';

type AppHeaderProps = {
  title: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
  backAccessibilityLabel?: string;
  /**
   * Opt-in edge reveal for genuinely long titles. The default stays truncated
   * so existing headers do not suddenly animate. Motion is skipped when the
   * platform Reduce Motion preference is enabled.
   */
  titleOverflowBehavior?: AppHeaderTitleOverflowBehavior;
};

const TITLE_REVEAL_START_DELAY_MS = 900;
const TITLE_REVEAL_EDGE_PAUSE_MS = 900;
const TITLE_REVEAL_PIXELS_PER_SECOND = 24;
const TITLE_REVEAL_MIN_DURATION_MS = 1800;
const TITLE_REVEAL_MAX_DURATION_MS = 7000;
const TITLE_REVEAL_RETURN_SPEED_MULTIPLIER = 1.35;
const TITLE_OVERFLOW_EPSILON = 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ScrollingHeaderTitle({ title }: { title: string }) {
  const reducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const overflowDistance = Math.max(0, contentWidth - viewportWidth);
  const hasOverflow = viewportWidth > 0 && contentWidth > viewportWidth + TITLE_OVERFLOW_EPSILON;
  const revealDuration = useMemo(
    () => clamp(
      Math.round((overflowDistance / TITLE_REVEAL_PIXELS_PER_SECOND) * 1000),
      TITLE_REVEAL_MIN_DURATION_MS,
      TITLE_REVEAL_MAX_DURATION_MS,
    ),
    [overflowDistance],
  );

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);

    if (reducedMotion || !hasOverflow) return undefined;

    // One calm reveal cycle is enough to expose the hidden title without
    // turning a navigation header into a continuously moving marquee.
    const animation = Animated.sequence([
      Animated.delay(TITLE_REVEAL_START_DELAY_MS),
      Animated.timing(translateX, {
        toValue: -overflowDistance,
        duration: revealDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.delay(TITLE_REVEAL_EDGE_PAUSE_MS),
      Animated.timing(translateX, {
        toValue: 0,
        duration: Math.max(
          1000,
          Math.round(revealDuration / TITLE_REVEAL_RETURN_SPEED_MULTIPLIER),
        ),
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [hasOverflow, overflowDistance, reducedMotion, revealDuration, title, translateX]);

  function handleViewportLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    setViewportWidth((current) => Math.abs(current - nextWidth) < 0.5 ? current : nextWidth);
  }

  if (reducedMotion) {
    return <AppText style={styles.title} numberOfLines={1}>{title}</AppText>;
  }

  return (
    <View pointerEvents="none" onLayout={handleViewportLayout} style={styles.titleViewport}>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        accessible={false}
        onContentSizeChange={(width) => {
          setContentWidth((current) => Math.abs(current - width) < 0.5 ? current : width);
        }}
        style={styles.titleMeasureScroller}
        contentContainerStyle={styles.titleMeasureContent}
      >
        <Animated.View style={{ transform: [{ translateX }] }}>
          <AppText
            accessible
            accessibilityRole="header"
            style={styles.scrollingTitle}
            numberOfLines={1}
          >
            {title}
          </AppText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

export function AppHeader({
  title,
  onBack,
  rightSlot,
  backAccessibilityLabel,
  titleOverflowBehavior = 'truncate',
}: AppHeaderProps) {
  const theme = useThemeTokens();
  const { t } = useTranslation();

  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel ?? t('navigation.goBack')}
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: theme.color.surface, borderColor: theme.color.border },
          pressed && styles.pressed,
        ]}
      >
        <MobileIcon name="back" size={21} color={theme.color.text} />
      </Pressable>
      {titleOverflowBehavior === 'scroll' ? (
        <ScrollingHeaderTitle key={title} title={title} />
      ) : (
        <AppText accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</AppText>
      )}
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { flex: 1, minWidth: 0, ...SECONDARY_HEADER_TITLE_STYLE },
  titleViewport: { flex: 1, minWidth: 0, height: 32, justifyContent: 'center', overflow: 'hidden' },
  titleMeasureScroller: { width: '100%', overflow: 'hidden' },
  titleMeasureContent: { alignItems: 'center', paddingRight: 1 },
  scrollingTitle: { ...SECONDARY_HEADER_TITLE_STYLE },
  rightSlot: { marginLeft: 'auto' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
