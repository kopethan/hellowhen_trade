import { WEATHER_FORECAST_HORIZON_MS, type WeatherHourlyForecast } from '../weather/weatherTypes.js';

const LOCAL_PLAN_PLACE_MODE = 'local';
const PUBLIC_PLAN_WEATHER_STATUSES = new Set(['open', 'full', 'started']);
const MAX_NEAREST_HOUR_DISTANCE_MS = 90 * 60 * 1000;

export type PlanPlaceWeatherTarget = {
  mode: string | null | undefined;
  startsAt: Date | string | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  sourcePlace?: {
    latitude: number | null | undefined;
    longitude: number | null | undefined;
  } | null;
};

export type PlanWeatherVisibilityTarget = {
  ownerId: string;
  status: string;
  deletedAt?: Date | string | null;
  ownerTrustTier?: string | null;
};

export type PlanPlaceWeatherService = {
  getHourlyForecast(input: { latitude: number; longitude: number }): Promise<WeatherHourlyForecast | null>;
};

export type PlanPlaceWeatherSnapshot = {
  temperatureC: number;
  forecastStart: string;
  scheduledFor: string;
  provider: WeatherHourlyForecast['provider'];
  providerName: string;
  attributionRequired: boolean;
  attribution: WeatherHourlyForecast['attribution'] | null;
  fetchedAt: string;
};

function validCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function planPlaceCoordinatesForWeather(place: PlanPlaceWeatherTarget) {
  const latitude = typeof place.latitude === 'number' ? place.latitude : place.sourcePlace?.latitude;
  const longitude = typeof place.longitude === 'number' ? place.longitude : place.sourcePlace?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

export function planPlaceWeatherScheduledAt(place: PlanPlaceWeatherTarget, now = new Date()) {
  if (place.mode !== LOCAL_PLAN_PLACE_MODE || !place.startsAt) return null;
  const scheduledAt = place.startsAt instanceof Date ? place.startsAt : new Date(place.startsAt);
  if (!Number.isFinite(scheduledAt.getTime())) return null;
  const scheduledMs = scheduledAt.getTime();
  const nowMs = now.getTime();
  if (scheduledMs < nowMs || scheduledMs >= nowMs + WEATHER_FORECAST_HORIZON_MS) return null;
  return scheduledAt;
}

export function nearestWeatherHour(forecast: WeatherHourlyForecast, scheduledAt: Date) {
  let nearest: WeatherHourlyForecast['hours'][number] | null = null;
  let nearestDistanceMs = Number.POSITIVE_INFINITY;

  for (const hour of forecast.hours) {
    const forecastMs = Date.parse(hour.forecastStart);
    if (!Number.isFinite(forecastMs) || !Number.isFinite(hour.temperatureC)) continue;
    const distanceMs = Math.abs(forecastMs - scheduledAt.getTime());
    if (distanceMs < nearestDistanceMs) {
      nearest = hour;
      nearestDistanceMs = distanceMs;
    }
  }

  return nearest && nearestDistanceMs <= MAX_NEAREST_HOUR_DISTANCE_MS ? nearest : null;
}

export function canReadPlanPlaceWeather(target: PlanWeatherVisibilityTarget, viewerId: string) {
  if (target.deletedAt) return false;
  if (target.ownerId === viewerId) return true;
  if (target.ownerTrustTier === 'restricted') return false;
  return PUBLIC_PLAN_WEATHER_STATUSES.has(target.status);
}

export async function lookupPlanPlaceWeather(
  place: PlanPlaceWeatherTarget,
  service: PlanPlaceWeatherService,
  now = new Date(),
): Promise<PlanPlaceWeatherSnapshot | null> {
  const scheduledAt = planPlaceWeatherScheduledAt(place, now);
  if (!scheduledAt) return null;
  const coordinates = planPlaceCoordinatesForWeather(place);
  if (!coordinates) return null;

  const forecast = await service.getHourlyForecast(coordinates);
  if (!forecast) return null;
  if (forecast.attributionRequired && !forecast.attribution) return null;
  const nearest = nearestWeatherHour(forecast, scheduledAt);
  if (!nearest) return null;

  return {
    temperatureC: nearest.temperatureC,
    forecastStart: nearest.forecastStart,
    scheduledFor: scheduledAt.toISOString(),
    provider: forecast.provider,
    providerName: forecast.providerName,
    attributionRequired: forecast.attributionRequired,
    attribution: forecast.attribution ?? null,
    fetchedAt: forecast.fetchedAt,
  };
}
