import { Extrapolation, interpolate } from 'react-native-reanimated';
import type { SquareStackDepthEffect } from './squareStackDeck.types';

export const SQUARE_STACK_VISIBLE_BEFORE = 1;
export const SQUARE_STACK_VISIBLE_AFTER = 4;
export const SQUARE_STACK_COMMIT_THRESHOLD = 0.36;
export const SQUARE_STACK_VELOCITY_THRESHOLD = 1.05;
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

export function getSquareStackTransform(visualOffset: number, cardSize: number, depthEffect: SquareStackDepthEffect = 'flat') {
  'worklet';

  const clampedOffset = clamp(visualOffset, -1, 4);

  if (depthEffect === 'motionOnly') {
    const motionInput = [-1, -0.72, -0.28, -0.08, 0, 1, 2, 3, 4];
    return {
      translateX: interpolate(clampedOffset, motionInput, [-cardSize * 0.74, -cardSize * 0.52, -cardSize * 0.16, 0, 0, 7, 14, 21, 28], Extrapolation.CLAMP),
      translateY: interpolate(clampedOffset, motionInput, [-cardSize * 0.74, -cardSize * 0.52, -cardSize * 0.16, 0, 0, 7, 14, 21, 28], Extrapolation.CLAMP),
      scale: interpolate(clampedOffset, motionInput, [0.88, 0.925, 0.975, 0.998, 1, 0.988, 0.976, 0.964, 0.952], Extrapolation.CLAMP),
      opacity: interpolate(clampedOffset, motionInput, [0, 0.18, 0.72, 0.96, 1, 0.82, 0.58, 0.36, 0], Extrapolation.CLAMP),
    };
  }

  if (depthEffect === 'flat') {
    const flatInput = [-1, -0.08, 0, 1, 2, 3, 4];
    return {
      translateX: interpolate(clampedOffset, flatInput, [-cardSize * 0.22, 0, 0, 4, 8, 12, 16], Extrapolation.CLAMP),
      translateY: interpolate(clampedOffset, flatInput, [-cardSize * 0.18, 0, 0, 4, 8, 12, 16], Extrapolation.CLAMP),
      scale: interpolate(clampedOffset, flatInput, [0.995, 0.998, 1, 0.992, 0.986, 0.98, 0.974], Extrapolation.CLAMP),
      opacity: interpolate(clampedOffset, flatInput, [0, 0, 1, 0.985, 0.95, 0.88, 0], Extrapolation.CLAMP),
    };
  }

  const input = [-1, 0, 1, 2, 3, 4];
  return {
    translateX: interpolate(clampedOffset, input, [-cardSize * 0.62, 0, 7, 13, 19, 25], Extrapolation.CLAMP),
    translateY: interpolate(clampedOffset, input, [-cardSize * 0.54, 0, 7, 13, 19, 25], Extrapolation.CLAMP),
    scale: interpolate(clampedOffset, input, [0.985, 1, 0.988, 0.978, 0.97, 0.964], Extrapolation.CLAMP),
    opacity: interpolate(clampedOffset, input, [0, 1, 0.965, 0.9, 0.78, 0], Extrapolation.CLAMP),
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
