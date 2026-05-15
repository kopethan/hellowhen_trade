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
  const validPlaces = places.map((place, index) => ({ ...place, index, dateTime: parseLocalDateTime(place.date, place.time) }));
  if (validPlaces.length === 0 || validPlaces.some((place) => !place.dateTime)) {
    return { startsAt: '', endsAt: '', placeStartsAt: [] as string[], error: 'Add at least one place with a valid date and time.' };
  }

  for (let index = 1; index < validPlaces.length; index += 1) {
    const previous = validPlaces[index - 1]?.dateTime;
    const current = validPlaces[index]?.dateTime;
    if (previous && current && current.getTime() < previous.getTime()) {
      return { startsAt: '', endsAt: '', placeStartsAt: [] as string[], error: 'Each place must be at the same time or after the previous place.' };
    }
  }

  const placeStartsAt = validPlaces.map((place) => place.dateTime!.toISOString());
  return {
    startsAt: placeStartsAt[0] ?? '',
    endsAt: placeStartsAt[placeStartsAt.length - 1] ?? '',
    placeStartsAt,
    error: '',
  };
}
