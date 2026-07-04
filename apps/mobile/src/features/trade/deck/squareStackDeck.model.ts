import { Extrapolation, interpolate } from 'react-native-reanimated';
import type { SquareStackDepthEffect } from './squareStackDeck.types';

// Keep one previous card mounted as a hidden incoming layer only.
// The resting deck remains forward-only so swiped cards do not look like
// they return to the stack.
export const SQUARE_STACK_VISIBLE_BEFORE = 1;
// Keep a compact future stack mounted. More layers made fallback card text and
// surfaces pile up during mobile swipes, so the native deck shows only the
// next two stack positions.
export const SQUARE_STACK_VISIBLE_AFTER = 2;
export const SQUARE_STACK_COMMIT_THRESHOLD = 0.36;
export const SQUARE_STACK_VELOCITY_THRESHOLD = 1.05;
// The left commit animation throws past the drag range on release so the
// outgoing card exits clearly instead of lingering as a ghost edge.
export const SQUARE_STACK_NEXT_RELEASE_TARGET = 1.42;
// Background cards should react to the active drag, but only subtly.
// They finish their promotion during an accepted release instead of jumping
// as soon as the finger lifts.
export const SQUARE_STACK_BACKGROUND_THRESHOLD_PROMOTION = 0.22;
export const SQUARE_STACK_BACKGROUND_DRAG_PROMOTION = 0.34;
export const SQUARE_STACK_DEPTH_ALLOWANCE_X = 36;
export const SQUARE_STACK_DEPTH_ALLOWANCE_Y = 46;
export const SQUARE_STACK_DEFAULT_MIN_CARD_SIZE = 280;
export const SQUARE_STACK_DEFAULT_MAX_CARD_SIZE = 390;

export type SquareStackLayoutInput = {
  availableWidth: number;
  availableHeight: number;
  minCardSize?: number;
  maxCardSize?: number;
};

export type SquareStackLayoutMetrics = {
  cardSize: number;
  stageWidth: number;
  stageHeight: number;
  depthAllowanceX: number;
  depthAllowanceY: number;
};

export function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function getSquareStackLayoutMetrics({
  availableWidth,
  availableHeight,
  minCardSize = SQUARE_STACK_DEFAULT_MIN_CARD_SIZE,
  maxCardSize = SQUARE_STACK_DEFAULT_MAX_CARD_SIZE,
}: SquareStackLayoutInput): SquareStackLayoutMetrics {
  const safeWidth = Math.max(0, availableWidth);
  const safeHeight = Math.max(0, availableHeight);
  const usableWidth = Math.max(180, safeWidth - SQUARE_STACK_DEPTH_ALLOWANCE_X);
  const usableHeight = Math.max(180, safeHeight - SQUARE_STACK_DEPTH_ALLOWANCE_Y);
  const naturalCardSize = Math.min(usableWidth, usableHeight, maxCardSize);
  const safeMinCardSize = Math.min(minCardSize, naturalCardSize);
  const cardSize = Math.round(clamp(naturalCardSize, safeMinCardSize, maxCardSize));

  return {
    cardSize,
    stageWidth: cardSize + SQUARE_STACK_DEPTH_ALLOWANCE_X,
    stageHeight: cardSize + SQUARE_STACK_DEPTH_ALLOWANCE_Y,
    depthAllowanceX: SQUARE_STACK_DEPTH_ALLOWANCE_X,
    depthAllowanceY: SQUARE_STACK_DEPTH_ALLOWANCE_Y,
  };
}

export function getVisibleSquareStackIndexes(activeIndex: number, total: number) {
  const indexes: number[] = [];
  const from = Math.max(0, activeIndex - SQUARE_STACK_VISIBLE_BEFORE);
  const to = Math.min(total - 1, activeIndex + SQUARE_STACK_VISIBLE_AFTER);
  for (let index = from; index <= to; index += 1) indexes.push(index);
  return indexes;
}


export function getSquareStackBackgroundPromotion(progress: number, releaseDirection: -1 | 0 | 1) {
  'worklet';
  const forwardProgress = Math.max(0, progress);

  if (releaseDirection === 1) {
    return interpolate(
      forwardProgress,
      [0, SQUARE_STACK_COMMIT_THRESHOLD, SQUARE_STACK_NEXT_RELEASE_TARGET],
      [0, SQUARE_STACK_BACKGROUND_THRESHOLD_PROMOTION, 1],
      Extrapolation.CLAMP,
    );
  }

  return interpolate(
    forwardProgress,
    [0, SQUARE_STACK_COMMIT_THRESHOLD, 1],
    [0, SQUARE_STACK_BACKGROUND_THRESHOLD_PROMOTION, SQUARE_STACK_BACKGROUND_DRAG_PROMOTION],
    Extrapolation.CLAMP,
  );
}

export function getSquareStackTransform(visualOffset: number, cardSize: number, depthEffect: SquareStackDepthEffect = 'flat') {
  'worklet';

  const clampedOffset = clamp(visualOffset, -SQUARE_STACK_NEXT_RELEASE_TARGET, 4);

  if (depthEffect === 'motionOnly') {
    const motionInput = [-SQUARE_STACK_NEXT_RELEASE_TARGET, -1, -0.72, -0.52, -0.36, -0.28, -0.08, 0, 1, 2, 3, 4];
    return {
      translateX: interpolate(clampedOffset, motionInput, [-cardSize * 1.16, -cardSize * 0.78, -cardSize * 0.54, -cardSize * 0.37, -cardSize * 0.24, -cardSize * 0.16, 0, 0, 7, 14, 21, 28], Extrapolation.CLAMP),
      translateY: interpolate(clampedOffset, motionInput, [-cardSize * 1.08, -cardSize * 0.78, -cardSize * 0.54, -cardSize * 0.37, -cardSize * 0.24, -cardSize * 0.16, 0, 0, 7, 14, 21, 28], Extrapolation.CLAMP),
      scale: interpolate(clampedOffset, motionInput, [0.82, 0.88, 0.925, 0.95, 0.965, 0.975, 0.998, 1, 0.988, 0.976, 0.964, 0.952], Extrapolation.CLAMP),
      rotateZ: `${interpolate(clampedOffset, motionInput, [-9, -7, -5, -3.5, -2, -1, 0, 0, 0, 0, 0, 0], Extrapolation.CLAMP)}deg`,
      opacity: interpolate(clampedOffset, motionInput, [0, 0.04, 0.18, 0.42, 0.72, 0.92, 1, 1, 0.66, 0.28, 0, 0], Extrapolation.CLAMP),
    };
  }

  if (depthEffect === 'flat') {
    const flatInput = [-1, -0.08, 0, 1, 2, 3, 4];
    return {
      translateX: interpolate(clampedOffset, flatInput, [-cardSize * 0.22, 0, 0, 4, 8, 12, 16], Extrapolation.CLAMP),
      translateY: interpolate(clampedOffset, flatInput, [-cardSize * 0.18, 0, 0, 4, 8, 12, 16], Extrapolation.CLAMP),
      scale: interpolate(clampedOffset, flatInput, [0.995, 0.998, 1, 0.992, 0.986, 0.98, 0.974], Extrapolation.CLAMP),
      rotateZ: '0deg',
      opacity: interpolate(clampedOffset, flatInput, [0, 0, 1, 0.72, 0.26, 0, 0], Extrapolation.CLAMP),
    };
  }

  const input = [-1, 0, 1, 2, 3, 4];
  return {
    translateX: interpolate(clampedOffset, input, [-cardSize * 0.62, 0, 7, 13, 19, 25], Extrapolation.CLAMP),
    translateY: interpolate(clampedOffset, input, [-cardSize * 0.54, 0, 7, 13, 19, 25], Extrapolation.CLAMP),
    scale: interpolate(clampedOffset, input, [0.985, 1, 0.988, 0.978, 0.97, 0.964], Extrapolation.CLAMP),
    rotateZ: `${interpolate(clampedOffset, input, [-5, 0, 0, 0, 0, 0], Extrapolation.CLAMP)}deg`,
    opacity: interpolate(clampedOffset, input, [0, 1, 0.72, 0.26, 0, 0], Extrapolation.CLAMP),
  };
}

export function getSquareStackShadowStyle(visualOffset: number, depthEffect: SquareStackDepthEffect = 'flat') {
  'worklet';
  const clampedOffset = clamp(visualOffset, -1, 4);

  if (depthEffect === 'flat' || depthEffect === 'motionOnly') {
    return { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
  }

  const input = [-1, 0, 1, 2, 3, 4];
  return {
    shadowOpacity: interpolate(clampedOffset, input, [0.18, 0.2, 0.13, 0.08, 0.045, 0], Extrapolation.CLAMP),
    shadowRadius: interpolate(clampedOffset, input, [24, 26, 18, 12, 8, 0], Extrapolation.CLAMP),
    elevation: Math.round(interpolate(clampedOffset, input, [14, 16, 9, 5, 2, 0], Extrapolation.CLAMP)),
  };
}

export function getSquareStackZIndex(visualOffset: number) {
  'worklet';
  return Math.round(1000 - visualOffset * 40);
}

export function getCommitDuration(currentProgress: number, targetProgress: number) {
  'worklet';
  const remaining = Math.abs(targetProgress - currentProgress);
  return clamp(160 + remaining * 180, 120, 340);
}
