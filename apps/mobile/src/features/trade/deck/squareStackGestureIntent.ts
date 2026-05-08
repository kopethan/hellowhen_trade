export type SquareStackGestureIntent = 'UNDECIDED' | 'SCROLL' | 'SWIPE_NEXT' | 'SWIPE_PREV';

type SquareStackPanIntentInput = {
  dx: number;
  dy: number;
  hasPrev: boolean;
  hasNext: boolean;
};

const LOCK_DISTANCE = 10;
const ANGLE_SWIPE_DEG = 40;
const ANGLE_SCROLL_DEG = 72;
const VERTICAL_DOMINANCE = 1.6;
const ANGLE_BACKSLASH_SWIPE_DEG = 86;
const BACKSLASH_VERTICAL_DOMINANCE = 2.25;

export function isBackslashDiagonal(dx: number, dy: number) {
  'worklet';
  return dx * dy > 0;
}

function intentForHorizontalDirection(dx: number, hasPrev: boolean, hasNext: boolean): SquareStackGestureIntent {
  'worklet';
  if (dx < 0) return hasNext ? 'SWIPE_NEXT' : 'SCROLL';
  if (dx > 0) return hasPrev ? 'SWIPE_PREV' : 'SCROLL';
  return 'UNDECIDED';
}

export function classifySquareStackPanIntent({ dx, dy, hasPrev, hasNext }: SquareStackPanIntentInput): SquareStackGestureIntent {
  'worklet';

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const distance = Math.hypot(dx, dy);

  if (distance < LOCK_DISTANCE) return 'UNDECIDED';
  if (absX <= 0.001) return 'SCROLL';

  const angleDeg = Math.atan2(absY, absX) * (180 / Math.PI);
  const backslash = isBackslashDiagonal(dx, dy);

  if (absY > absX * VERTICAL_DOMINANCE && !backslash) return 'SCROLL';
  if (angleDeg <= ANGLE_SWIPE_DEG) return intentForHorizontalDirection(dx, hasPrev, hasNext);
  if (!backslash) return 'SCROLL';

  if (angleDeg <= ANGLE_BACKSLASH_SWIPE_DEG && absY <= absX * BACKSLASH_VERTICAL_DOMINANCE) {
    return intentForHorizontalDirection(dx, hasPrev, hasNext);
  }

  if (angleDeg >= ANGLE_SCROLL_DEG) return 'SCROLL';
  return intentForHorizontalDirection(dx, hasPrev, hasNext);
}
