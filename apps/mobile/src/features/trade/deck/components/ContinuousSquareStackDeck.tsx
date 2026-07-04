import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { clamp, getCommitDuration, getSquareStackBackgroundPromotion, getSquareStackLayoutMetrics, getSquareStackShadowStyle, getSquareStackTransform, getSquareStackZIndex, getVisibleSquareStackIndexes, SQUARE_STACK_COMMIT_THRESHOLD, SQUARE_STACK_NEXT_RELEASE_TARGET, SQUARE_STACK_VELOCITY_THRESHOLD } from '../squareStackDeck.model';
import type { SquareStackDeckCard, SquareStackDeckProps } from '../squareStackDeck.types';
import { classifySquareStackPanIntent, type SquareStackGestureIntent } from '../squareStackGestureIntent';
import { SquareStackCardShell } from './SquareStackCardShell';

type LayerProps<TCard extends SquareStackDeckCard> = {
  card: TCard;
  index: number;
  total: number;
  size: number;
  committedIndex: number;
  baseIndex: SharedValue<number>;
  progress: SharedValue<number>;
  releaseDirection: SharedValue<-1 | 0 | 1>;
  renderCard: SquareStackDeckProps<TCard>['renderCard'];
  depthEffect: SquareStackDeckProps<TCard>['depthEffect'];
};

function SquareStackLayerInner<TCard extends SquareStackDeckCard>({ card, index, total, size, committedIndex, baseIndex, progress, releaseDirection, renderCard, depthEffect }: LayerProps<TCard>) {
  const depthOffset = index - committedIndex;
  const isCommittedTopLayer = depthOffset === 0;
  const isIncomingPreviousLayer = depthOffset === -1;

  const animatedStyle = useAnimatedStyle(() => {
    const rawVisualOffset = index - baseIndex.value - progress.value;
    const isForwardSwipe = progress.value > 0;
    const isFutureStackLayer = index > baseIndex.value;
    // During a forward drag, future cards should prepare the next position,
    // but only by a controlled amount. The previous freeze made the stack look
    // dead and caused a visible jump after release; this keeps the lower cards
    // moving gently while the active card remains the only layer that travels
    // far to the upper-left.
    const backgroundPromotion = isForwardSwipe && isFutureStackLayer
      ? getSquareStackBackgroundPromotion(progress.value, releaseDirection.value)
      : 0;
    const visualOffset = isForwardSwipe && isFutureStackLayer
      ? index - baseIndex.value - Math.min(backgroundPromotion, index - baseIndex.value)
      : rawVisualOffset;
    const pose = getSquareStackTransform(visualOffset, size, depthEffect ?? 'flat');
    let layerOpacity = pose.opacity;

    // Resting decks are forward-only: the previous card is mounted only so it
    // can enter during a back gesture, but it stays invisible at idle.
    if (index < baseIndex.value && progress.value >= 0) {
      layerOpacity = 0;
    }

    // While the finger is down, keep the active card readable even when it
    // travels far to the upper-left. The accepted release animation owns the
    // fade-out; rejected swipes still spring back as a fully visible card.
    const isDraggingNext = releaseDirection.value === 0 && isCommittedTopLayer && progress.value > 0 && visualOffset < 0;
    const isCommittingNext = releaseDirection.value === 1 && isCommittedTopLayer;
    const isCloseToCenter = visualOffset > -0.28;
    if (isDraggingNext || (isCommittedTopLayer && visualOffset < 0 && isCloseToCenter && !isCommittingNext) || (isIncomingPreviousLayer && progress.value < 0 && visualOffset < 0 && isCloseToCenter)) {
      layerOpacity = 1;
    }

    // Only fade after an accepted release. The drag remains readable, then the
    // release throws the card upper-left and quickly removes the whole layer so
    // no pale card edge is left hovering over the feed.
    if (isCommittingNext && visualOffset < -0.12) {
      const releaseFade = clamp((visualOffset + 0.64) / 0.52, 0, 1);
      layerOpacity = Math.min(layerOpacity, releaseFade * releaseFade * releaseFade);
    }

    const hideOutgoingLayer = isCommittingNext && visualOffset <= -0.72;

    return {
      opacity: hideOutgoingLayer ? 0 : layerOpacity,
      zIndex: hideOutgoingLayer || layerOpacity <= 0.02 ? -1 : getSquareStackZIndex(visualOffset),
      transform: [{ translateX: pose.translateX }, { translateY: pose.translateY }, { scale: pose.scale }, { rotateZ: pose.rotateZ }],
    };
  }, [depthEffect, index, isCommittedTopLayer, isIncomingPreviousLayer, releaseDirection, size]);

  const shadowStyle = useAnimatedStyle(() => {
    const rawVisualOffset = index - baseIndex.value - progress.value;
    const isForwardSwipe = progress.value > 0;
    const isFutureStackLayer = index > baseIndex.value;
    const backgroundPromotion = isForwardSwipe && isFutureStackLayer
      ? getSquareStackBackgroundPromotion(progress.value, releaseDirection.value)
      : 0;
    const visualOffset = isForwardSwipe && isFutureStackLayer
      ? index - baseIndex.value - Math.min(backgroundPromotion, index - baseIndex.value)
      : rawVisualOffset;
    return getSquareStackShadowStyle(visualOffset, depthEffect ?? 'flat');
  }, [depthEffect, index, releaseDirection]);

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
  const layoutMetrics = useMemo(() => getSquareStackLayoutMetrics({
    availableWidth: availableWidth && availableWidth > 0 ? availableWidth : width - 36,
    availableHeight: availableHeight && availableHeight > 0 ? availableHeight : height * 0.54,
    minCardSize,
    maxCardSize,
  }), [availableHeight, availableWidth, height, maxCardSize, minCardSize, width]);

  const { cardSize, stageHeight, stageWidth } = layoutMetrics;
  const safeInitialIndex = Math.min(Math.max(initialIndex, 0), Math.max(cards.length - 1, 0));
  const [committedIndex, setCommittedIndex] = useState(safeInitialIndex);
  const lastNotifiedIndexRef = useRef(safeInitialIndex);
  const baseIndex = useSharedValue(safeInitialIndex);
  const progress = useSharedValue(0);
  const gestureIntent = useSharedValue<SquareStackGestureIntent>('UNDECIDED');
  const releaseDirection = useSharedValue<-1 | 0 | 1>(0);
  const gestureStartAbsX = useSharedValue(0);
  const gestureStartAbsY = useSharedValue(0);

  useEffect(() => {
    const nextIndex = Math.min(committedIndex, Math.max(cards.length - 1, 0));
    if (nextIndex !== committedIndex) setCommittedIndex(nextIndex);
    baseIndex.value = nextIndex;
    progress.value = 0;
    releaseDirection.value = 0;
  }, [baseIndex, cards.length, committedIndex, progress, releaseDirection]);

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

  const gesture = useMemo(() => Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event: any) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      gestureStartAbsX.value = touch.absoluteX;
      gestureStartAbsY.value = touch.absoluteY;
      gestureIntent.value = 'UNDECIDED';
      releaseDirection.value = 0;
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
        releaseDirection.value = 0;
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
      const targetProgress = direction === 1 ? SQUARE_STACK_NEXT_RELEASE_TARGET : direction;
      const releaseDuration = direction === 1 ? 200 : getCommitDuration(currentProgress, targetProgress);
      releaseDirection.value = direction;
      progress.value = withTiming(targetProgress, { duration: releaseDuration, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (!finished) return;
        if (direction !== 0) {
          baseIndex.value = baseIndex.value + direction;
          progress.value = 0;
          releaseDirection.value = 0;
          runOnJS(commitIndex)(direction);
          return;
        }
        progress.value = 0;
        releaseDirection.value = 0;
      });
    })
    .onFinalize(() => {
      gestureIntent.value = 'UNDECIDED';
    }), [baseIndex, cardSize, cards.length, commitIndex, gestureIntent, gestureStartAbsX, gestureStartAbsY, progress, releaseDirection]);

  if (cards.length === 0) {
    return <View style={[styles.stage, { width: stageWidth, height: stageHeight }]} />;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
        {visibleIndexes.map((cardIndex) => {
          const card = cards[cardIndex];
          if (!card) return null;
          return <SquareStackLayer key={card.id} card={card} index={cardIndex} total={cards.length} size={cardSize} committedIndex={committedIndex} baseIndex={baseIndex} progress={progress} releaseDirection={releaseDirection} renderCard={renderCard} depthEffect={depthEffect} />;
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
    overflow: 'visible',
    zIndex: 2,
    elevation: 2,
  },
  layer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  shadowLayer: {
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
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
