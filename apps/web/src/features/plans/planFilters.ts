import type { ListPlansQuery, PlanDto } from '@hellowhen/contracts';

export type PlanFilterKey = 'status' | 'mode' | 'join' | 'places' | 'time';

export type PlanFilterOption = { label: string; value: string; body?: string };
export type PlanFilterGroup = { title: string; body: string; options: PlanFilterOption[] };

export const planFilterGroups: PlanFilterGroup[] = [
  {
    title: 'Status',
    body: 'Choose which public Plan states should appear.',
    options: [
      { label: 'Open', value: 'status:open', body: 'Available to join' },
      { label: 'Full', value: 'status:full', body: 'Capacity reached' },
      { label: 'Started', value: 'status:started', body: 'Already underway' },
    ],
  },
  {
    title: 'Mode',
    body: 'Match the way the Plan happens.',
    options: [
      { label: 'Local / offline', value: 'mode:local', body: 'Meet in person' },
      { label: 'Online', value: 'mode:remote', body: 'Remote or link-based' },
    ],
  },
  {
    title: 'Join',
    body: 'Surface Plans that can be joined freely.',
    options: [{ label: 'Free join', value: 'join:automatic', body: 'No approval request first' }],
  },
  {
    title: 'Places',
    body: 'Filter by route size.',
    options: [
      { label: '1 place', value: 'places:one', body: 'Simple single stop' },
      { label: '2+ places', value: 'places:multiple', body: 'A route or sequence' },
    ],
  },
  {
    title: 'Time',
    body: 'Pick when the Plan starts.',
    options: [
      { label: 'Today', value: 'time:today' },
      { label: 'This week', value: 'time:week' },
      { label: 'This month', value: 'time:month' },
    ],
  },
];

const planFilterKeys: PlanFilterKey[] = ['status', 'mode', 'join', 'places', 'time'];
const allowedPlanFilterValues = new Set(planFilterGroups.flatMap((group) => group.options.map((option) => option.value)));

export function togglePlanFilterValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function normalizePlanFilters(values: string[]) {
  const normalized: string[] = [];
  for (const value of values) {
    if (!allowedPlanFilterValues.has(value) || normalized.includes(value)) continue;
    normalized.push(value);
  }
  return normalized;
}

export function normalizePlanSearchQuery(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function planSearchQueryFromSearchParams(searchParams: URLSearchParams | ReadonlyURLSearchParams) {
  return normalizePlanSearchQuery(searchParams.get('q'));
}

export function activePlanFilterCount(filters: string[], query?: string | null) {
  return normalizePlanFilters(filters).length + (normalizePlanSearchQuery(query) ? 1 : 0);
}

export function planFiltersFromSearchParams(searchParams: URLSearchParams | ReadonlyURLSearchParams) {
  const values: string[] = [];
  for (const key of planFilterKeys) {
    for (const value of searchParams.getAll(key)) values.push(`${key}:${value}`);
  }
  return normalizePlanFilters(values);
}

export function planFilterValues(filters: string[], key: PlanFilterKey) {
  return filters
    .map((value) => {
      const [filterKey, filterValue] = value.split(':');
      return filterKey === key ? filterValue : null;
    })
    .filter((value): value is string => Boolean(value));
}

export function buildPlanFilterSearchParams(filters: string[], query?: string | null) {
  const params = new URLSearchParams();
  const normalizedQuery = normalizePlanSearchQuery(query);
  if (normalizedQuery) params.set('q', normalizedQuery);
  for (const value of normalizePlanFilters(filters)) {
    const [key, option] = value.split(':');
    if (key && option) params.append(key, option);
  }
  return params;
}

export function buildPlanFilterHref(path: string, filters: string[], query?: string | null) {
  const params = buildPlanFilterSearchParams(filters, query);
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export function buildPlanFeedQuery(filters: string[], searchQuery?: string | null): ListPlansQuery {
  const normalizedQuery = normalizePlanSearchQuery(searchQuery);
  const query: ListPlansQuery = { take: filters.length || normalizedQuery ? 100 : 50 };
  if (normalizedQuery) query.q = normalizedQuery;
  const statuses = planFilterValues(filters, 'status');
  const modes = planFilterValues(filters, 'mode');
  if (statuses.length === 1) query.status = statuses[0] as ListPlansQuery['status'];
  if (modes.length === 1) query.mode = modes[0] as ListPlansQuery['mode'];
  return query;
}

function sameLocalDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function isWithinNextDays(date: Date, days: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + days);
  return date.getTime() >= start && date.getTime() <= end.getTime();
}

function planMatchesTimeFilter(plan: PlanDto, values: string[]) {
  if (!values.length) return true;
  const date = new Date(plan.startsAt);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return values.some((value) => {
    if (value === 'today') return sameLocalDate(date, now);
    if (value === 'week') return isWithinNextDays(date, 6);
    if (value === 'month') return date.getTime() >= todayStart && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    return true;
  });
}

function planMatchesSearch(plan: PlanDto, query?: string | null) {
  const normalizedQuery = normalizePlanSearchQuery(query).toLowerCase();
  if (!normalizedQuery) return true;
  const searchable = [
    plan.title,
    plan.description,
    plan.category,
    plan.locationLabel,
    ...(plan.tags ?? []),
    ...(plan.places ?? []).flatMap((place) => [place.title, place.note, place.addressPublicText, place.onlineLabel, place.onlineUrl]),
  ].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(normalizedQuery);
}

export function applyPlanFilters(plans: PlanDto[], filters: string[], query?: string | null) {
  const statuses = planFilterValues(filters, 'status');
  const modes = planFilterValues(filters, 'mode');
  const joinModes = planFilterValues(filters, 'join');
  const placeCounts = planFilterValues(filters, 'places');
  const timeFilters = planFilterValues(filters, 'time');
  return plans.filter((plan) => {
    if (!planMatchesSearch(plan, query)) return false;
    if (statuses.length && !statuses.includes(plan.status)) return false;
    if (modes.length && (!plan.mode || !modes.includes(plan.mode))) return false;
    if (joinModes.includes('automatic') && plan.joinApprovalMode !== 'automatic') return false;
    if (placeCounts.length) {
      const count = plan.places?.length ?? 0;
      const placeMatch = placeCounts.some((value) => value === 'one' ? count === 1 : value === 'multiple' ? count >= 2 : true);
      if (!placeMatch) return false;
    }
    if (!planMatchesTimeFilter(plan, timeFilters)) return false;
    return true;
  });
}

export function planFilterSummary(filters: string[], query?: string | null) {
  const parts = planFilterKeys.map((key) => {
    const count = planFilterValues(filters, key).length;
    return count ? `${count} ${key}` : '';
  }).filter(Boolean);
  const normalizedQuery = normalizePlanSearchQuery(query);
  if (normalizedQuery) parts.unshift(`Search: “${normalizedQuery}”`);
  return parts.join(' · ');
}

type ReadonlyURLSearchParams = Pick<URLSearchParams, 'get' | 'getAll'>;
