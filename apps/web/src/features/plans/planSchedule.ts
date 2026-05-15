export type PlanSchedulePlace = {
  id?: string;
  time: string;
};

const minutesInDay = 24 * 60;

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

function parseTimeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatPlanTime(time?: string | null) {
  const minutes = time ? parseTimeToMinutes(time) : null;
  if (minutes === null) return 'Time not set';
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function buildPlanSchedule(planDate: string, places: PlanSchedulePlace[]) {
  const dateStart = new Date(`${planDate}T00:00:00`);
  const validPlaces = places.map((place, index) => ({ ...place, index, minutes: parseTimeToMinutes(place.time) }));
  if (Number.isNaN(dateStart.getTime()) || validPlaces.length === 0 || validPlaces.some((place) => place.minutes === null)) {
    return { startsAt: '', endsAt: '', placeStartsAt: [] as string[] };
  }

  let dayOffset = 0;
  let previousMinutes: number | null = null;
  const placeStartsAt = validPlaces.map((place) => {
    const minutes = place.minutes ?? 0;
    if (previousMinutes !== null && minutes < previousMinutes) dayOffset += 1;
    previousMinutes = minutes;
    const date = new Date(dateStart);
    date.setMinutes(dayOffset * minutesInDay + minutes);
    return date.toISOString();
  });

  return {
    startsAt: placeStartsAt[0] ?? '',
    endsAt: placeStartsAt[placeStartsAt.length - 1] ?? '',
    placeStartsAt,
  };
}
