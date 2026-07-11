export const ACTIVE_PLAN_TIME_STATUSES = ['draft', 'open', 'full', 'started'] as const;
export const PUBLIC_PLAN_STATUSES = ['open', 'full', 'started', 'cancelled'] as const;
export const PLAN_TIME_MIN_GAP_MINUTES = 60;
export const PLAN_STOP_MIN_GAP_MINUTES = 15;

export type PlanScheduleInput = {
  startsAt: string | Date;
  endsAt?: string | Date | null;
  places?: Array<{ startsAt?: string | Date | null; endsAt?: string | Date | null; order?: number }>;
};

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function effectivePlanRange(input: PlanScheduleInput) {
  const startsAt = asDate(input.startsAt);
  const placeEnds = (input.places ?? [])
    .map((place) => place.endsAt ?? place.startsAt ?? null)
    .filter((value): value is string | Date => Boolean(value))
    .map(asDate);
  const explicitEnd = input.endsAt ? asDate(input.endsAt) : null;
  const candidates = explicitEnd ? [...placeEnds, explicitEnd] : placeEnds;
  const latest = candidates.sort((left, right) => right.getTime() - left.getTime())[0] ?? startsAt;
  return { startsAt, endsAt: latest.getTime() >= startsAt.getTime() ? latest : startsAt };
}

export function rangesConflictWithRequiredGap(left: PlanScheduleInput, right: PlanScheduleInput) {
  const gapMs = PLAN_TIME_MIN_GAP_MINUTES * 60 * 1000;
  const leftRange = effectivePlanRange(left);
  const rightRange = effectivePlanRange(right);
  return leftRange.startsAt.getTime() <= rightRange.endsAt.getTime() + gapMs
    && leftRange.endsAt.getTime() >= rightRange.startsAt.getTime() - gapMs;
}

export function findStopGapViolation(input: PlanScheduleInput) {
  const ordered = [...(input.places ?? [])]
    .map((place, index) => ({ ...place, order: place.order ?? index }))
    .sort((left, right) => left.order - right.order)
    .filter((place): place is typeof place & { startsAt: string | Date } => Boolean(place.startsAt));
  const minGapMs = PLAN_STOP_MIN_GAP_MINUTES * 60 * 1000;
  for (let index = 1; index < ordered.length; index += 1) {
    const previousStop = ordered[index - 1];
    const currentStop = ordered[index];
    if (!previousStop || !currentStop) continue;

    const previous = asDate(previousStop.startsAt);
    const current = asDate(currentStop.startsAt);
    if (current.getTime() - previous.getTime() < minGapMs) {
      return { previousIndex: index - 1, currentIndex: index };
    }
  }
  return null;
}

export function isCancelOnlyUpdate(input: Record<string, unknown>) {
  const keys = Object.keys(input);
  return keys.length === 1 && input.status === 'cancelled';
}

export function canReadPlan(plan: { deletedAt?: Date | string | null; status: string }, isOwner: boolean) {
  if (plan.deletedAt) return false;
  return isOwner || PUBLIC_PLAN_STATUSES.includes(plan.status as (typeof PUBLIC_PLAN_STATUSES)[number]);
}
