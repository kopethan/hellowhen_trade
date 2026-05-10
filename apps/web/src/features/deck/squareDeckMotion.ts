export const SQUARE_DECK_LAYER_OFFSET = 10;
export const SQUARE_DECK_LAYER_SCALE = 0.018;
export const SQUARE_DECK_RAIL_K = 0.7;
export const SQUARE_DECK_TRANSITION_MS = 210;
export const SQUARE_DECK_COMMIT_THRESHOLD = 0.36;
export const SQUARE_DECK_VELOCITY_THRESHOLD = 1.05;
export const SQUARE_DECK_PROGRESS_DISTANCE_FACTOR = 0.72;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function interpolate(value: number, input: readonly number[], output: readonly number[]) {
  if (input.length !== output.length || input.length === 0) return output[0] ?? 0;

  const firstInput = input[0] ?? 0;
  const firstOutput = output[0] ?? 0;
  if (value <= firstInput) return firstOutput;

  for (let index = 1; index < input.length; index += 1) {
    const inputTo = input[index];
    const inputFrom = input[index - 1];
    const outputFrom = output[index - 1];
    const outputTo = output[index];

    if (inputTo === undefined || inputFrom === undefined || outputFrom === undefined || outputTo === undefined) {
      continue;
    }

    if (value <= inputTo) {
      const range = inputTo - inputFrom;
      const ratio = range === 0 ? 0 : (value - inputFrom) / range;
      return outputFrom + (outputTo - outputFrom) * ratio;
    }
  }

  return output[output.length - 1] ?? firstOutput;
}

export function getLayerPose(layer: number) {
  return {
    x: layer * SQUARE_DECK_LAYER_OFFSET,
    y: layer * SQUARE_DECK_LAYER_OFFSET,
    scale: 1 - layer * SQUARE_DECK_LAYER_SCALE,
    opacity: layer > 3 ? 0 : layer <= 1 ? 1 : layer === 2 ? 0.96 : 0.88,
  };
}

export function getForwardPose(progress: number) {
  const p = clamp(progress, 0, 1);
  return {
    x: -120 * p,
    y: -84 * p,
    rotate: -5 * p,
    opacity: clamp(1 - p * 1.2, 0, 1),
  };
}

export function getDragPose(dx: number, dy = 0) {
  const cappedX = clamp(dx, -190, 190);
  const cappedY = clamp(dy, -150, 150);
  const diagonal = clamp(dx + dy * 0.9, -220, 220);
  return {
    x: cappedX,
    y: cappedY,
    rotate: diagonal * 0.018,
  };
}

export function getNativeRailPose(visualOffset: number, cardSize: number) {
  const clampedOffset = clamp(visualOffset, -1, 4);
  const motionInput = [-1, -0.72, -0.28, -0.08, 0, 1, 2, 3, 4];

  return {
    x: interpolate(clampedOffset, motionInput, [-cardSize * 0.74, -cardSize * 0.52, -cardSize * 0.16, 0, 0, 7, 14, 21, 28]),
    y: interpolate(clampedOffset, motionInput, [-cardSize * 0.74, -cardSize * 0.52, -cardSize * 0.16, 0, 0, 7, 14, 21, 28]),
    scale: interpolate(clampedOffset, motionInput, [0.88, 0.925, 0.975, 0.998, 1, 0.988, 0.976, 0.964, 0.952]),
    opacity: interpolate(clampedOffset, motionInput, [0, 0.18, 0.86, 0.98, 1, 1, 1, 0.94, 0]),
    rotate: interpolate(clampedOffset, [-1, -0.28, 0, 4], [-5, -2, 0, 0]),
  };
}

export function getDiagonalProgress(dx: number, dy: number, cardSize: number) {
  const safeCardSize = Math.max(1, cardSize);
  const diagonalDrag = dx + dy * 0.9;
  return clamp(-diagonalDrag / (safeCardSize * SQUARE_DECK_PROGRESS_DISTANCE_FACTOR), -1, 1);
}
