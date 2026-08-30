import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { SemanticColorName } from '@hellowhen/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useThemeTokens } from '../../providers/ThemeProvider';

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
};

type SlidingSegmentedControlProps<T extends string> = {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  tone?: SemanticColorName;
  animationDuration?: number;
  style?: StyleProp<ViewStyle>;
};

const OUTER_PADDING = 4;
const SEGMENT_GAP = 4;

function SegmentLabel({
  label,
  active,
  selectedColor,
  unselectedColor,
  reducedMotion,
}: {
  label: string;
  active: boolean;
  selectedColor: string;
  unselectedColor: string;
  reducedMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(active ? 1 : 0);
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress, reducedMotion]);

  const color = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [unselectedColor, selectedColor],
  });

  return (
    <Animated.Text numberOfLines={1} style={[styles.label, { color }]}>
      {label}
    </Animated.Text>
  );
}

export function SlidingSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  tone,
  animationDuration = 280,
  style,
}: SlidingSegmentedControlProps<T>) {
  const theme = useThemeTokens();
  const reducedMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const indicatorOffset = useRef(new Animated.Value(0)).current;
  const previousSegmentWidthRef = useRef(0);
  const hasMeasuredRef = useRef(false);
  const selectedSemantic = tone ? theme.semantic[tone] : null;
  const segmentWidth = useMemo(() => {
    if (!containerWidth || options.length === 0) return 0;
    const available = containerWidth - OUTER_PADDING * 2 - SEGMENT_GAP * Math.max(options.length - 1, 0);
    return Math.max(0, available / options.length);
  }, [containerWidth, options.length]);
  const segmentStride = segmentWidth + SEGMENT_GAP;
  const targetOffset = segmentStride * activeIndex;

  useEffect(() => {
    if (segmentWidth <= 0) return;

    const layoutChanged = Math.abs(previousSegmentWidthRef.current - segmentWidth) > 0.5;
    previousSegmentWidthRef.current = segmentWidth;

    if (!hasMeasuredRef.current || layoutChanged || reducedMotion) {
      indicatorOffset.stopAnimation();
      indicatorOffset.setValue(targetOffset);
      hasMeasuredRef.current = true;
      return;
    }

    indicatorOffset.stopAnimation();
    const animation = Animated.timing(indicatorOffset, {
      toValue: targetOffset,
      duration: animationDuration,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [animationDuration, indicatorOffset, reducedMotion, segmentWidth, targetOffset]);

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    setContainerWidth((current) => Math.abs(current - nextWidth) < 0.5 ? current : nextWidth);
  }

  const selectedBackground = selectedSemantic?.softBg ?? theme.color.surface;
  const selectedBorder = selectedSemantic?.border ?? theme.color.border;
  const selectedText = selectedSemantic?.text ?? theme.color.text;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: selectedBackground,
              borderColor: selectedBorder,
              transform: [{ translateX: indicatorOffset }],
            },
          ]}
        />
      ) : null}

      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: active, disabled: Boolean(option.disabled) }}
            disabled={option.disabled}
            onPress={() => {
              if (!active) onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              pressed && !option.disabled && styles.pressed,
              option.disabled && styles.disabled,
            ]}
          >
            <SegmentLabel
              label={option.label}
              active={active}
              selectedColor={selectedText}
              unselectedColor={theme.color.muted}
              reducedMotion={reducedMotion}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    borderRadius: 24,
    borderWidth: 1,
    padding: OUTER_PADDING,
    gap: SEGMENT_GAP,
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: OUTER_PADDING,
    bottom: OUTER_PADDING,
    left: OUTER_PADDING,
    borderRadius: 20,
    borderWidth: 1,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  label: {
    maxWidth: '100%',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
