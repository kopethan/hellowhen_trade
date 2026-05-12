import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { clamp, getCommitDuration, getSquareStackLayoutMetrics, getSquareStackShadowStyle, getSquareStackTransform, getSquareStackZIndex, getVisibleSquareStackIndexes, SQUARE_STACK_COMMIT_THRESHOLD, SQUARE_STACK_VELOCITY_THRESHOLD, SQUARE_STACK_VISIBLE_AFTER } from '../squareStackDeck.model';
import type { SquareStackDeckCard, SquareStackDeckProps } from '../squareStackDeck.types';
import { classifySquareStackPanIntent, type SquareStackGestureIntent } from '../squareStackGestureIntent';
import { MobileIcon } from '../../../../components/MobileIcon';
import { useThemeTokens } from '../../../../providers/ThemeProvider';
import { useTranslation } from '../../../../providers/MobileI18nProvider';
import { SquareStackCardShell } from './SquareStackCardShell';

type LayerProps<TCard extends SquareStackDeckCard> = {
  card: TCard;
  index: number;
  total: number;
  size: number;
  committedIndex: number;
  baseIndex: SharedValue<number>;
  progress: SharedValue<number>;
  renderCard: SquareStackDeckProps<TCard>['renderCard'];
  depthEffect: SquareStackDeckProps<TCard>['depthEffect'];
};

function SquareStackLayerInner<TCard extends SquareStackDeckCard>({ card, index, total, size, committedIndex, baseIndex, progress, renderCard, depthEffect }: LayerProps<TCard>) {
  const depthOffset = index - committedIndex;
  const isCommittedTopLayer = depthOffset === 0;
  const isIncomingPreviousLayer = depthOffset === -1;

  const animatedStyle = useAnimatedStyle(() => {
    const visualOffset = index - baseIndex.value - progress.value;
    const pose = getSquareStackTransform(visualOffset, size, depthEffect ?? 'flat');
    let layerOpacity = pose.opacity;

    // Resting decks are forward-only: the previous card is mounted only so it
    // can enter during a back gesture, but it stays invisible at idle.
    if (index < baseIndex.value && progress.value >= 0) {
      layerOpacity = 0;
    }

    // Keep the readable card opaque while it is moving. This matches the old
    // Plan deck and prevents lower layers from flashing through the promotion.
    if ((isCommittedTopLayer && visualOffset < 0) || (isIncomingPreviousLayer && progress.value < 0 && visualOffset < 0)) {
      layerOpacity = 1;
    }

    return {
      opacity: layerOpacity,
      zIndex: getSquareStackZIndex(visualOffset),
      transform: [{ translateX: pose.translateX }, { translateY: pose.translateY }, { scale: pose.scale }],
    };
  }, [depthEffect, index, isCommittedTopLayer, isIncomingPreviousLayer, size]);

  const shadowStyle = useAnimatedStyle(() => {
    const visualOffset = index - baseIndex.value - progress.value;
    return getSquareStackShadowStyle(visualOffset, depthEffect ?? 'flat');
  }, [depthEffect, index]);

  return (
    <Animated.View pointerEvents="box-none" style={[styles.layer, animatedStyle]}>
      <Animated.View style={[styles.shadowLayer, { width: size, height: size, borderRadius: Math.max(24, Math.round(size * 0.075)) }, shadowStyle]}>
        <SquareStackCardShell size={size}>{renderCard({ card, index, total })}</SquareStackCardShell>
      </Animated.View>
    </Animated.View>
  );
}

const SquareStackLayer = memo(SquareStackLayerInner) as typeof SquareStackLayerInner;

export function ContinuousSquareStackDeck<TCard extends SquareStackDeckCard>({
  cards,
  initialIndex = 0,
  renderCard,
  onIndexChange,
  availableWidth,
  availableHeight,
  minCardSize,
  maxCardSize,
  renderWindow = 'visible',
  showDebugBadge = false,
  depthEffect = 'motionOnly',
}: SquareStackDeckProps<TCard>) {
  const { width, height } = useWindowDimensions();
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const layoutMetrics = useMemo(() => getSquareStackLayoutMetrics({
    availableWidth: availableWidth && availableWidth > 0 ? availableWidth : width - 36,
    availableHeight: availableHeight && availableHeight > 0 ? availableHeight : height * 0.54,
    minCardSize,
    maxCardSize,
  }), [availableHeight, availableWidth, height, maxCardSize, minCardSize, width]);

  const { cardSize, stageHeight, stageWidth } = layoutMetrics;
  const safeInitialIndex = Math.min(Math.max(initialIndex, 0), Math.max(cards.length - 1, 0));
  const [committedIndex, setCommittedIndex] = useState(safeInitialIndex);
  const [programmaticAnimating, setProgrammaticAnimating] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotifiedIndexRef = useRef(safeInitialIndex);
  const baseIndex = useSharedValue(safeInitialIndex);
  const progress = useSharedValue(0);
  const gestureIntent = useSharedValue<SquareStackGestureIntent>('UNDECIDED');
  const gestureStartAbsX = useSharedValue(0);
  const gestureStartAbsY = useSharedValue(0);

  useEffect(() => () => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    controlsHideTimerRef.current = setTimeout(() => setControlsVisible(false), 1500);
  }, []);

  useEffect(() => {
    const nextIndex = Math.min(committedIndex, Math.max(cards.length - 1, 0));
    if (nextIndex !== committedIndex) setCommittedIndex(nextIndex);
    baseIndex.value = nextIndex;
    progress.value = 0;
  }, [baseIndex, cards.length, committedIndex, progress]);

  useEffect(() => {
    const nextCard = cards[committedIndex];
    if (!nextCard || lastNotifiedIndexRef.current === committedIndex) return;
    lastNotifiedIndexRef.current = committedIndex;
    onIndexChange?.(committedIndex, nextCard);
  }, [cards, committedIndex, onIndexChange]);

  const visibleIndexes = useMemo(() => {
    if (renderWindow === 'all') return cards.map((_, cardIndex) => cardIndex);
    return getVisibleSquareStackIndexes(committedIndex, cards.length);
  }, [cards, cards.length, committedIndex, renderWindow]);

  const commitIndex = useCallback((direction: -1 | 1) => {
    setCommittedIndex((current) => Math.min(Math.max(current + direction, 0), Math.max(cards.length - 1, 0)));
  }, [cards.length]);

  const finishProgrammaticCommit = useCallback((direction: -1 | 1) => {
    commitIndex(direction);
    setProgrammaticAnimating(false);
  }, [commitIndex]);

  const finishCancelledProgrammaticCommit = useCallback(() => {
    setProgrammaticAnimating(false);
  }, []);

  const commitFromControl = useCallback((direction: -1 | 1) => {
    showControlsTemporarily();
    if (programmaticAnimating) return;
    if (direction === -1 && committedIndex <= 0) return;
    if (direction === 1 && committedIndex >= cards.length - 1) return;
    setProgrammaticAnimating(true);
    progress.value = withTiming(direction, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (!finished) {
        progress.value = 0;
        runOnJS(finishCancelledProgrammaticCommit)();
        return;
      }
      baseIndex.value = baseIndex.value + direction;
      progress.value = 0;
      runOnJS(finishProgrammaticCommit)(direction);
    });
  }, [baseIndex, cards.length, committedIndex, finishCancelledProgrammaticCommit, finishProgrammaticCommit, programmaticAnimating, progress, showControlsTemporarily]);

  const canGoPrevious = cards.length > 1 && committedIndex > 0;
  const canGoNext = cards.length > 1 && committedIndex < cards.length - 1;
  const cardInsetX = Math.max(0, Math.round((stageWidth - cardSize) / 2));
  const cardInsetY = Math.max(0, Math.round((stageHeight - cardSize) / 2));
  const maxVisibleBackLayers = Math.max(1, Math.min(3, SQUARE_STACK_VISIBLE_AFTER - 1));
  const visibleBackLayers = Math.min(Math.max(cards.length - committedIndex - 1, 0), maxVisibleBackLayers);
  const depthRatio = visibleBackLayers / maxVisibleBackLayers;
  const advanceControlOutset = 18 + Math.round(16 * depthRatio);
  const controlsAreVisible = controlsVisible || programmaticAnimating;

  const gesture = useMemo(() => Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event: any) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      gestureStartAbsX.value = touch.absoluteX;
      gestureStartAbsY.value = touch.absoluteY;
      gestureIntent.value = 'UNDECIDED';
      runOnJS(showControlsTemporarily)();
    })
    .onTouchesMove((event: any, state: any) => {
      if (gestureIntent.value !== 'UNDECIDED') return;
      const touch = event.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - gestureStartAbsX.value;
      const dy = touch.absoluteY - gestureStartAbsY.value;
      const nextIntent = classifySquareStackPanIntent({ dx, dy, hasPrev: baseIndex.value > 0, hasNext: baseIndex.value < cards.length - 1 });
      if (nextIntent === 'UNDECIDED') return;
      gestureIntent.value = nextIntent;
      if (nextIntent === 'SCROLL') {
        progress.value = withTiming(0, { duration: 90, easing: Easing.out(Easing.quad) });
        state.fail();
        return;
      }
      state.activate();
    })
    .onUpdate((event) => {
      if (gestureIntent.value !== 'SWIPE_NEXT' && gestureIntent.value !== 'SWIPE_PREV') return;
      const diagonalDrag = event.translationX + event.translationY * 0.9;
      const rawProgress = -diagonalDrag / (cardSize * 0.72);
      const canGoNext = baseIndex.value < cards.length - 1;
      const canGoPrev = baseIndex.value > 0;
      const resisted = (rawProgress > 0 && !canGoNext) || (rawProgress < 0 && !canGoPrev) ? rawProgress * 0.18 : rawProgress;
      progress.value = clamp(resisted, -1, 1);
    })
    .onEnd((event) => {
      const endingIntent = gestureIntent.value;
      gestureIntent.value = 'UNDECIDED';
      if (endingIntent !== 'SWIPE_NEXT' && endingIntent !== 'SWIPE_PREV') {
        progress.value = withTiming(0, { duration: 90, easing: Easing.out(Easing.quad) });
        return;
      }
      const velocityProgress = -(event.velocityX + event.velocityY * 0.9) / (cardSize * 0.72);
      const currentProgress = progress.value;
      const canGoNext = baseIndex.value < cards.length - 1;
      const canGoPrev = baseIndex.value > 0;
      let direction: -1 | 0 | 1 = 0;
      if (endingIntent === 'SWIPE_NEXT' && (currentProgress > SQUARE_STACK_COMMIT_THRESHOLD || velocityProgress > SQUARE_STACK_VELOCITY_THRESHOLD) && canGoNext) direction = 1;
      if (endingIntent === 'SWIPE_PREV' && (currentProgress < -SQUARE_STACK_COMMIT_THRESHOLD || velocityProgress < -SQUARE_STACK_VELOCITY_THRESHOLD) && canGoPrev) direction = -1;
      const targetProgress = direction === 0 ? 0 : direction;
      progress.value = withTiming(targetProgress, { duration: getCommitDuration(currentProgress, targetProgress), easing: Easing.out(Easing.cubic) }, (finished) => {
        if (!finished) return;
        if (direction !== 0) {
          baseIndex.value = baseIndex.value + direction;
          progress.value = 0;
          runOnJS(commitIndex)(direction);
          return;
        }
        progress.value = 0;
      });
    })
    .onFinalize(() => {
      gestureIntent.value = 'UNDECIDED';
    }), [baseIndex, cardSize, cards.length, commitIndex, gestureIntent, gestureStartAbsX, gestureStartAbsY, progress, showControlsTemporarily]);

  if (cards.length === 0) {
    return <View style={[styles.stage, { width: stageWidth, height: stageHeight }]} />;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
        {canGoPrevious ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.actions.previousCard')}
            hitSlop={12}
            disabled={programmaticAnimating}
            onPress={() => commitFromControl(-1)}
            style={({ pressed }) => [styles.deckControl, { top: cardInsetY - 18, left: cardInsetX - 18, opacity: controlsAreVisible ? 1 : 0 }, pressed && styles.pressedControl, programmaticAnimating && styles.disabledControl]}
          >
            <MobileIcon name="deck-back" size={26} color={theme.color.muted} decorative />
          </Pressable>
        ) : null}
        {canGoNext ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.actions.nextCard')}
            hitSlop={12}
            disabled={programmaticAnimating}
            onPress={() => commitFromControl(1)}
            style={({ pressed }) => [styles.deckControl, { right: cardInsetX - advanceControlOutset, bottom: cardInsetY - advanceControlOutset, opacity: controlsAreVisible ? 1 : 0 }, pressed && styles.pressedControl, programmaticAnimating && styles.disabledControl]}
          >
            <MobileIcon name="deck-advance" size={26} color={theme.color.muted} decorative />
          </Pressable>
        ) : null}
        {visibleIndexes.map((cardIndex) => {
          const card = cards[cardIndex];
          if (!card) return null;
          return <SquareStackLayer key={card.id} card={card} index={cardIndex} total={cards.length} size={cardSize} committedIndex={committedIndex} baseIndex={baseIndex} progress={progress} renderCard={renderCard} depthEffect={depthEffect} />;
        })}
        {showDebugBadge ? <View pointerEvents="none" style={styles.debugBadge} /> : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowLayer: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
  },
  deckControl: {
    position: 'absolute',
    zIndex: 1200,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedControl: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  disabledControl: {
    opacity: 0.34,
  },
  debugBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
  },
});
