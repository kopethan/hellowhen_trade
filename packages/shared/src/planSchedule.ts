export type PlanPlaceTimeInput = string | Date | null | undefined;

export type PlanEndEstimateOptions = {
  roundingMinutes?: number;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  singlePlaceDurationMinutes?: number | null;
};

export type EstimatedFinalPlanEnd = {
  endsAt: string;
  averageGapMinutes: number;
  roundedGapMinutes: number;
  placeCount: number;
};

export const PLAN_ESTIMATED_FINAL_PLACE_END_ROUNDING_MINUTES = 30;
export const PLAN_ESTIMATED_FINAL_PLACE_MIN_DURATION_MINUTES = 30;
export const PLAN_ESTIMATED_FINAL_PLACE_MAX_DURATION_MINUTES = 8 * 60;
export const PLAN_ESTIMATED_SINGLE_PLACE_DURATION_MINUTES = 90;

const MINUTE_MS = 60_000;

function parsePlanPlaceTime(value: PlanPlaceTimeInput) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function roundDurationMinutes(value: number, roundingMinutes: number, minDurationMinutes: number, maxDurationMinutes?: number) {
  const safeRounding = Number.isFinite(roundingMinutes) && roundingMinutes > 0 ? roundingMinutes : PLAN_ESTIMATED_FINAL_PLACE_END_ROUNDING_MINUTES;
  const safeMinimum = Number.isFinite(minDurationMinutes) && minDurationMinutes > 0 ? minDurationMinutes : PLAN_ESTIMATED_FINAL_PLACE_MIN_DURATION_MINUTES;
  const rounded = Math.max(safeMinimum, Math.round(value / safeRounding) * safeRounding);
  if (typeof maxDurationMinutes === 'number' && Number.isFinite(maxDurationMinutes) && maxDurationMinutes > 0) {
    return Math.min(rounded, maxDurationMinutes);
  }
  return rounded;
}

export function estimateFinalPlanPlaceEndTime(placeStartsAt: PlanPlaceTimeInput[], options: PlanEndEstimateOptions = {}): EstimatedFinalPlanEnd | null {
  const sortedTimes = placeStartsAt
    .map(parsePlanPlaceTime)
    .filter((value): value is number => typeof value === 'number')
    .sort((left, right) => left - right);

  if (sortedTimes.length === 1) {
    const singleStartTime = sortedTimes[0];
    const singlePlaceDurationMinutes = options.singlePlaceDurationMinutes === null
      ? null
      : options.singlePlaceDurationMinutes ?? PLAN_ESTIMATED_SINGLE_PLACE_DURATION_MINUTES;
    if (singleStartTime === undefined || singlePlaceDurationMinutes === null) return null;
    const roundedGapMinutes = roundDurationMinutes(
      singlePlaceDurationMinutes,
      options.roundingMinutes ?? PLAN_ESTIMATED_FINAL_PLACE_END_ROUNDING_MINUTES,
      options.minDurationMinutes ?? PLAN_ESTIMATED_FINAL_PLACE_MIN_DURATION_MINUTES,
      options.maxDurationMinutes ?? PLAN_ESTIMATED_FINAL_PLACE_MAX_DURATION_MINUTES,
    );
    return {
      endsAt: new Date(singleStartTime + roundedGapMinutes * MINUTE_MS).toISOString(),
      averageGapMinutes: singlePlaceDurationMinutes,
      roundedGapMinutes,
      placeCount: sortedTimes.length,
    };
  }
  if (sortedTimes.length < 2) return null;

  const gapsMinutes: number[] = [];
  for (let index = 1; index < sortedTimes.length; index += 1) {
    const previous = sortedTimes[index - 1];
    const current = sortedTimes[index];
    if (previous === undefined || current === undefined) continue;
    gapsMinutes.push(Math.max(0, (current - previous) / MINUTE_MS));
  }
  if (!gapsMinutes.length) return null;

  const averageGapMinutes = gapsMinutes.reduce((sum, gap) => sum + gap, 0) / gapsMinutes.length;
  const roundedGapMinutes = roundDurationMinutes(
    averageGapMinutes,
    options.roundingMinutes ?? PLAN_ESTIMATED_FINAL_PLACE_END_ROUNDING_MINUTES,
    options.minDurationMinutes ?? PLAN_ESTIMATED_FINAL_PLACE_MIN_DURATION_MINUTES,
    options.maxDurationMinutes ?? PLAN_ESTIMATED_FINAL_PLACE_MAX_DURATION_MINUTES,
  );
  const lastStartTime = sortedTimes[sortedTimes.length - 1];
  if (lastStartTime === undefined) return null;

  return {
    endsAt: new Date(lastStartTime + roundedGapMinutes * MINUTE_MS).toISOString(),
    averageGapMinutes,
    roundedGapMinutes,
    placeCount: sortedTimes.length,
  };
}

export function buildEstimatedPlanPlaceEndTimes(placeStartsAt: PlanPlaceTimeInput[], options: PlanEndEstimateOptions = {}) {
  const parsedTimes = placeStartsAt.map(parsePlanPlaceTime);
  const finalEstimate = estimateFinalPlanPlaceEndTime(placeStartsAt, options);

  return parsedTimes.map((startTime, index) => {
    if (startTime === null) return undefined;
    const nextStartTime = parsedTimes[index + 1];
    if (typeof nextStartTime === 'number' && nextStartTime >= startTime) {
      return new Date(nextStartTime).toISOString();
    }
    return finalEstimate?.endsAt;
  });
}
