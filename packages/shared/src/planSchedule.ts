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

export type PlanStopStartGapViolation = {
  previousIndex: number;
  currentIndex: number;
  previousStartsAt: string;
  currentStartsAt: string;
  earliestStartsAt: string;
  actualGapMinutes: number;
  minGapMinutes: number;
};

export const PLAN_ESTIMATED_FINAL_PLACE_END_ROUNDING_MINUTES = 30;
export const PLAN_ESTIMATED_FINAL_PLACE_MIN_DURATION_MINUTES = 30;
export const PLAN_ESTIMATED_FINAL_PLACE_MAX_DURATION_MINUTES = 8 * 60;
export const PLAN_ESTIMATED_SINGLE_PLACE_DURATION_MINUTES = 90;
export const PLAN_MIN_STOP_START_GAP_MINUTES = 15;

const MINUTE_MS = 60_000;

export type PlanScheduleDraftStop = {
  date: string;
  time: string;
};

function parsePlanScheduleDraftDateTime(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim()) || !/^\d{2}:\d{2}$/.test(timeValue.trim())) return null;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function planScheduleDraftPartsFromDate(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}

/**
 * Move one Plan stop in time and shift every downstream stop by the same delta.
 * Earlier stops are never changed. If either the old or new selected time is
 * incomplete, only the selected stop is updated and no downstream time is
 * invented.
 */
export function cascadePlanStopDateTimeChange<T extends PlanScheduleDraftStop>(
  stops: T[],
  index: number,
  patch: Partial<Pick<PlanScheduleDraftStop, 'date' | 'time'>>,
): T[] {
  const selectedStop = stops[index];
  if (!selectedStop) return stops;

  const nextSelectedStop = { ...selectedStop, ...patch };
  const previousDateTime = parsePlanScheduleDraftDateTime(selectedStop.date, selectedStop.time);
  const nextDateTime = parsePlanScheduleDraftDateTime(nextSelectedStop.date, nextSelectedStop.time);
  if (!previousDateTime || !nextDateTime) {
    return stops.map((stop, stopIndex) => stopIndex === index ? nextSelectedStop : stop);
  }

  const deltaMs = nextDateTime.getTime() - previousDateTime.getTime();
  return stops.map((stop, stopIndex) => {
    if (stopIndex < index) return stop;
    if (stopIndex === index) return nextSelectedStop;
    if (deltaMs === 0) return stop;

    const downstreamDateTime = parsePlanScheduleDraftDateTime(stop.date, stop.time);
    if (!downstreamDateTime) return stop;
    return {
      ...stop,
      ...planScheduleDraftPartsFromDate(new Date(downstreamDateTime.getTime() + deltaMs)),
    };
  });
}

/**
 * Reorder Plan stop content without moving timestamps with that content. Each
 * route position keeps a chronological schedule slot, matching native Plan
 * behavior. Existing valid slots are sorted first so older out-of-order drafts
 * are repaired instead of preserving an invalid chronology.
 */
export function reorderPlanStopsPreservingTimeline<T extends PlanScheduleDraftStop>(
  stops: T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= stops.length) return stops;

  const reordered = [...stops];
  const movingStop = reordered[index];
  const displacedStop = reordered[nextIndex];
  if (!movingStop || !displacedStop) return stops;

  reordered[index] = displacedStop;
  reordered[nextIndex] = movingStop;

  const scheduleSlots = stops.map((stop, slotIndex) => {
    const dateTime = parsePlanScheduleDraftDateTime(stop.date, stop.time);
    return dateTime
      ? { date: stop.date, time: stop.time, timestamp: dateTime.getTime(), slotIndex }
      : null;
  });

  if (scheduleSlots.every((slot): slot is NonNullable<typeof slot> => Boolean(slot))) {
    const orderedSlots = [...scheduleSlots].sort((left, right) => left.timestamp - right.timestamp || left.slotIndex - right.slotIndex);
    return reordered.map((stop, slotIndex) => ({
      ...stop,
      date: orderedSlots[slotIndex]!.date,
      time: orderedSlots[slotIndex]!.time,
    }));
  }

  // For unfinished drafts, preserve the route-position slots involved in the
  // swap without manufacturing a date/time that the user has not entered.
  return reordered.map((stop, stopIndex) => {
    if (stopIndex === index) return { ...stop, date: movingStop.date, time: movingStop.time };
    if (stopIndex === nextIndex) return { ...stop, date: displacedStop.date, time: displacedStop.time };
    return stop;
  });
}

function parsePlanPlaceTime(value: PlanPlaceTimeInput) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}


export function findPlanStopStartGapViolation(
  placeStartsAt: PlanPlaceTimeInput[],
  minGapMinutes = PLAN_MIN_STOP_START_GAP_MINUTES,
): PlanStopStartGapViolation | null {
  const safeMinimum = Number.isFinite(minGapMinutes) && minGapMinutes > 0 ? minGapMinutes : PLAN_MIN_STOP_START_GAP_MINUTES;
  const minGapMs = safeMinimum * MINUTE_MS;

  for (let index = 1; index < placeStartsAt.length; index += 1) {
    const previous = parsePlanPlaceTime(placeStartsAt[index - 1]);
    const current = parsePlanPlaceTime(placeStartsAt[index]);
    if (previous === null || current === null) continue;
    const actualGapMs = current - previous;
    if (actualGapMs >= minGapMs) continue;
    return {
      previousIndex: index - 1,
      currentIndex: index,
      previousStartsAt: new Date(previous).toISOString(),
      currentStartsAt: new Date(current).toISOString(),
      earliestStartsAt: new Date(previous + minGapMs).toISOString(),
      actualGapMinutes: actualGapMs / MINUTE_MS,
      minGapMinutes: safeMinimum,
    };
  }

  return null;
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
