export const PLAN_TIME_DRIVEN_STATUSES = ['open', 'full', 'started'] as const;

type PlanLifecycleInput = {
  status: string;
  startsAt: string | Date;
  endsAt?: string | Date | null;
};

function asTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

export function normalizedPlanLifecycleStatus(plan: PlanLifecycleInput, now: string | Date = new Date()) {
  if (!PLAN_TIME_DRIVEN_STATUSES.includes(plan.status as (typeof PLAN_TIME_DRIVEN_STATUSES)[number])) return plan.status;

  const startsAt = asTime(plan.startsAt);
  const endsAt = plan.endsAt ? asTime(plan.endsAt) : startsAt;
  const current = asTime(now);
  if (![startsAt, endsAt, current].every(Number.isFinite)) return plan.status;
  if (current >= endsAt) return 'completed' as const;
  if (current >= startsAt) return 'started' as const;
  return plan.status;
}
