export const PLAN_WEATHER_CLIENT_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

export type PlanTemperatureUnit = 'celsius' | 'fahrenheit';

export type PlanPlaceWeatherAttribution = {
  serviceName: string;
  legalUrl: string;
  logoLightUrl: string;
  logoDarkUrl: string;
};

export type PlanPlaceWeatherSnapshot = {
  temperatureC: number;
  forecastStart: string;
  scheduledFor: string;
  provider: 'weatherkit';
  providerName: string;
  attributionRequired: true;
  attribution: PlanPlaceWeatherAttribution;
  fetchedAt: string;
};

type WeatherEligiblePlanPlace = {
  mode?: string | null;
  startsAt?: string | null;
};

function isValidHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validIsoDate(value: unknown) {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function isPlanPlaceWeatherClientEligible(place: WeatherEligiblePlanPlace | null | undefined, now = new Date()) {
  if (!place || place.mode !== 'local' || !place.startsAt) return false;
  const scheduledMs = Date.parse(place.startsAt);
  if (!Number.isFinite(scheduledMs)) return false;
  const nowMs = now.getTime();
  return scheduledMs >= nowMs && scheduledMs < nowMs + PLAN_WEATHER_CLIENT_HORIZON_MS;
}

export function isSyntheticPlanWeatherPlanId(planId: string) {
  return planId === 'create-plan-preview' || planId.startsWith('starter-plan-idea-');
}

export function parsePlanPlaceWeatherResponse(value: unknown): PlanPlaceWeatherSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const weather = (value as { weather?: unknown }).weather;
  if (weather === null || weather === undefined || typeof weather !== 'object') return null;

  const candidate = weather as Record<string, unknown>;
  if (candidate.provider !== 'weatherkit' || candidate.attributionRequired !== true) return null;
  if (typeof candidate.temperatureC !== 'number' || !Number.isFinite(candidate.temperatureC)) return null;
  if (!validIsoDate(candidate.forecastStart) || !validIsoDate(candidate.scheduledFor) || !validIsoDate(candidate.fetchedAt)) return null;
  if (typeof candidate.providerName !== 'string' || !candidate.providerName.trim()) return null;

  const rawAttribution = candidate.attribution;
  if (!rawAttribution || typeof rawAttribution !== 'object') return null;
  const attribution = rawAttribution as Record<string, unknown>;
  if (typeof attribution.serviceName !== 'string' || !attribution.serviceName.trim()) return null;
  if (!isValidHttpsUrl(attribution.legalUrl) || !isValidHttpsUrl(attribution.logoLightUrl) || !isValidHttpsUrl(attribution.logoDarkUrl)) return null;

  return {
    temperatureC: candidate.temperatureC,
    forecastStart: String(candidate.forecastStart),
    scheduledFor: String(candidate.scheduledFor),
    provider: 'weatherkit',
    providerName: candidate.providerName.trim(),
    attributionRequired: true,
    attribution: {
      serviceName: attribution.serviceName.trim(),
      legalUrl: String(attribution.legalUrl),
      logoLightUrl: String(attribution.logoLightUrl),
      logoDarkUrl: String(attribution.logoDarkUrl),
    },
    fetchedAt: String(candidate.fetchedAt),
  };
}

export function temperatureForUnit(temperatureC: number, unit: PlanTemperatureUnit) {
  if (!Number.isFinite(temperatureC)) return null;
  return unit === 'fahrenheit' ? (temperatureC * 9) / 5 + 32 : temperatureC;
}

export function formatPlanTemperature(temperatureC: number, unit: PlanTemperatureUnit) {
  const converted = temperatureForUnit(temperatureC, unit);
  if (converted === null) return '';
  return `${Math.round(converted)}°${unit === 'fahrenheit' ? 'F' : 'C'}`;
}

export function nextPlanTemperatureUnit(unit: PlanTemperatureUnit): PlanTemperatureUnit {
  return unit === 'celsius' ? 'fahrenheit' : 'celsius';
}
