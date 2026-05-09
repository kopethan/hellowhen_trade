export const SQUARE_DECK_LAYER_OFFSET = 10;
export const SQUARE_DECK_LAYER_SCALE = 0.018;
export const SQUARE_DECK_RAIL_K = 0.7;
export const SQUARE_DECK_TRANSITION_MS = 210;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getLayerPose(layer: number) {
  return {
    x: layer * SQUARE_DECK_LAYER_OFFSET,
    y: layer * SQUARE_DECK_LAYER_OFFSET,
    scale: 1 - layer * SQUARE_DECK_LAYER_SCALE,
    opacity: layer > 2 ? 0 : 1 - layer * 0.08,
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

export function getDragPose(dx: number) {
  const cappedX = clamp(dx, -180, 180);
  return {
    x: cappedX,
    y: -Math.abs(cappedX) * SQUARE_DECK_RAIL_K,
    rotate: cappedX * 0.025,
  };
}
