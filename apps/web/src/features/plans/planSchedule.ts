import { buildEstimatedPlanPlaceEndTimes, estimateFinalPlanPlaceEndTime } from '@hellowhen/shared';

export type PlanSchedulePlace = {
  id?: string;
  date: string;
  time: string;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function toDateInputValue(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInputValue(value?: string | null, fallback = '13:00') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatPlanTime(time?: string | null) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return 'Time not set';
  return time;
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim()) || !/^\d{2}:\d{2}$/.test(timeValue.trim())) return null;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function buildPlanSchedule(places: PlanSchedulePlace[]) {
  if (places.length === 0) {
    return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, placeEndsAt: [] as Array<string | undefined>, estimatedFinalEnd: null, error: 'Add at least one place with a valid date and time.' };
  }

  const firstPlace = places[0];
  const firstDateTime = firstPlace ? parseLocalDateTime(firstPlace.date, firstPlace.time) : null;
  if (!firstDateTime) {
    return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, placeEndsAt: [] as Array<string | undefined>, estimatedFinalEnd: null, error: 'Add a valid date and time for Place 1.' };
  }

  let previousDateTime = firstDateTime;
  let lastDateTime = firstDateTime;
  const placeStartsAt: Array<string | undefined> = [firstDateTime.toISOString()];

  for (let index = 1; index < places.length; index += 1) {
    const place = places[index];
    if (!place) continue;
    const currentDateTime = parseLocalDateTime(place.date, place.time);
    if (!currentDateTime) {
      return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, placeEndsAt: [] as Array<string | undefined>, estimatedFinalEnd: null, error: `Add a valid date and time for Place ${index + 1}.` };
    }
    if (currentDateTime.getTime() < previousDateTime.getTime()) {
      return { startsAt: '', endsAt: '', placeStartsAt: [] as Array<string | undefined>, placeEndsAt: [] as Array<string | undefined>, estimatedFinalEnd: null, error: 'Each place time must be at the same time or after the previous place.' };
    }
    placeStartsAt[index] = currentDateTime.toISOString();
    previousDateTime = currentDateTime;
    lastDateTime = currentDateTime;
  }

  const placeEndsAt = buildEstimatedPlanPlaceEndTimes(placeStartsAt);
  const estimatedFinalEnd = estimateFinalPlanPlaceEndTime(placeStartsAt);

  return {
    startsAt: firstDateTime.toISOString(),
    endsAt: placeEndsAt[placeEndsAt.length - 1] ?? lastDateTime.toISOString(),
    placeStartsAt,
    placeEndsAt,
    estimatedFinalEnd,
    error: '',
  };
}
