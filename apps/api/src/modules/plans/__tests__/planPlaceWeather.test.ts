import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canReadPlanPlaceWeather,
  lookupPlanPlaceWeather,
  nearestWeatherHour,
  planPlaceCoordinatesForWeather,
  planPlaceWeatherScheduledAt,
  type PlanPlaceWeatherService,
} from '../planPlaceWeather.js';
import { WEATHER_FORECAST_HORIZON_MS, type WeatherHourlyForecast } from '../../weather/weatherTypes.js';

const now = new Date('2026-09-02T12:00:00.000Z');

function forecast(hours: WeatherHourlyForecast['hours']): WeatherHourlyForecast {
  return {
    provider: 'weatherkit',
    providerName: 'Apple Weather',
    attributionRequired: true,
    attribution: {
      serviceName: 'Apple Weather',
      legalUrl: 'https://weatherkit.apple.com/legal-attribution.html',
      logoLightUrl: 'https://weatherkit.apple.com/assets/Apple_Weather_light.png',
      logoDarkUrl: 'https://weatherkit.apple.com/assets/Apple_Weather_dark.png',
    },
    latitude: 48.8566,
    longitude: 2.3522,
    fetchedAt: now.toISOString(),
    hours,
  };
}

function serviceReturning(value: WeatherHourlyForecast | null) {
  const calls: Array<{ latitude: number; longitude: number }> = [];
  const service: PlanPlaceWeatherService = {
    async getHourlyForecast(input) {
      calls.push(input);
      return value;
    },
  };
  return { service, calls };
}

test('Plan Place coordinates prefer the Plan Place snapshot and fall back to its reusable source Place', () => {
  assert.deepEqual(planPlaceCoordinatesForWeather({
    mode: 'local',
    startsAt: now,
    latitude: 48.85,
    longitude: 2.35,
    sourcePlace: { latitude: 40.7, longitude: -74 },
  }), { latitude: 48.85, longitude: 2.35 });

  assert.deepEqual(planPlaceCoordinatesForWeather({
    mode: 'local',
    startsAt: now,
    latitude: null,
    longitude: null,
    sourcePlace: { latitude: 40.7, longitude: -74 },
  }), { latitude: 40.7, longitude: -74 });
});

test('weather eligibility uses only the Plan Place startsAt and rejects remote or out-of-horizon Places', () => {
  const missingOwnDate = { mode: 'local', startsAt: null, latitude: 48.85, longitude: 2.35, planStartsAt: '2026-09-03T12:00:00Z' } as any;
  assert.equal(planPlaceWeatherScheduledAt(missingOwnDate, now), null);
  assert.equal(planPlaceWeatherScheduledAt({ mode: 'remote', startsAt: '2026-09-03T12:00:00Z', latitude: 48.85, longitude: 2.35 }, now), null);
  assert.equal(planPlaceWeatherScheduledAt({ mode: 'local', startsAt: '2026-09-02T11:59:59Z', latitude: 48.85, longitude: 2.35 }, now), null);
  assert.equal(planPlaceWeatherScheduledAt({
    mode: 'local',
    startsAt: new Date(now.getTime() + WEATHER_FORECAST_HORIZON_MS).toISOString(),
    latitude: 48.85,
    longitude: 2.35,
  }, now), null);
  assert.equal(planPlaceWeatherScheduledAt({ mode: 'local', startsAt: '2026-09-03T12:00:00Z', latitude: 48.85, longitude: 2.35 }, now)?.toISOString(), '2026-09-03T12:00:00.000Z');
});

test('nearest hourly weather is selected for the Plan Place scheduled time', () => {
  const result = nearestWeatherHour(forecast([
    { forecastStart: '2026-09-03T12:00:00Z', temperatureC: 18 },
    { forecastStart: '2026-09-03T13:00:00Z', temperatureC: 20 },
  ]), new Date('2026-09-03T12:25:00Z'));
  assert.deepEqual(result, { forecastStart: '2026-09-03T12:00:00Z', temperatureC: 18 });

  assert.equal(nearestWeatherHour(forecast([
    { forecastStart: '2026-09-03T18:00:00Z', temperatureC: 25 },
  ]), new Date('2026-09-03T12:25:00Z')), null);
});

test('lookup returns compact scheduled weather without coordinates', async () => {
  const { service, calls } = serviceReturning(forecast([
    { forecastStart: '2026-09-03T12:00:00Z', temperatureC: 18.25 },
    { forecastStart: '2026-09-03T13:00:00Z', temperatureC: 19.75 },
  ]));

  const result = await lookupPlanPlaceWeather({
    mode: 'local',
    startsAt: '2026-09-03T12:20:00Z',
    latitude: 48.8566,
    longitude: 2.3522,
  }, service, now);

  assert.deepEqual(calls, [{ latitude: 48.8566, longitude: 2.3522 }]);
  assert.deepEqual(result, {
    temperatureC: 18.25,
    forecastStart: '2026-09-03T12:00:00Z',
    scheduledFor: '2026-09-03T12:20:00.000Z',
    provider: 'weatherkit',
    providerName: 'Apple Weather',
    attributionRequired: true,
    attribution: {
      serviceName: 'Apple Weather',
      legalUrl: 'https://weatherkit.apple.com/legal-attribution.html',
      logoLightUrl: 'https://weatherkit.apple.com/assets/Apple_Weather_light.png',
      logoDarkUrl: 'https://weatherkit.apple.com/assets/Apple_Weather_dark.png',
    },
    fetchedAt: now.toISOString(),
  });
  assert.equal('latitude' in (result ?? {}), false);
  assert.equal('longitude' in (result ?? {}), false);
});


test('lookup refuses WeatherKit display data when required attribution is missing', async () => {
  const missingAttribution = forecast([{ forecastStart: '2026-09-03T12:00:00Z', temperatureC: 18 }]);
  delete missingAttribution.attribution;
  const { service } = serviceReturning(missingAttribution);

  const result = await lookupPlanPlaceWeather({
    mode: 'local',
    startsAt: '2026-09-03T12:20:00Z',
    latitude: 48.8566,
    longitude: 2.3522,
  }, service, now);

  assert.equal(result, null);
});

test('ineligible Plan Places never call the weather provider', async () => {
  const { service, calls } = serviceReturning(forecast([]));
  assert.equal(await lookupPlanPlaceWeather({ mode: 'remote', startsAt: '2026-09-03T12:00:00Z', latitude: 48.85, longitude: 2.35 }, service, now), null);
  assert.equal(await lookupPlanPlaceWeather({ mode: 'local', startsAt: null, latitude: 48.85, longitude: 2.35 }, service, now), null);
  assert.equal(await lookupPlanPlaceWeather({ mode: 'local', startsAt: '2026-09-03T12:00:00Z', latitude: null, longitude: null }, service, now), null);
  assert.equal(calls.length, 0);
});

test('Plan weather visibility mirrors current public Plan visibility while allowing the owner', () => {
  assert.equal(canReadPlanPlaceWeather({ ownerId: 'owner', status: 'draft', deletedAt: null, ownerTrustTier: 'restricted' }, 'owner'), true);
  assert.equal(canReadPlanPlaceWeather({ ownerId: 'owner', status: 'open', deletedAt: null, ownerTrustTier: 'email_verified' }, 'viewer'), true);
  assert.equal(canReadPlanPlaceWeather({ ownerId: 'owner', status: 'draft', deletedAt: null, ownerTrustTier: 'email_verified' }, 'viewer'), false);
  assert.equal(canReadPlanPlaceWeather({ ownerId: 'owner', status: 'open', deletedAt: null, ownerTrustTier: 'restricted' }, 'viewer'), false);
  assert.equal(canReadPlanPlaceWeather({ ownerId: 'owner', status: 'open', deletedAt: now, ownerTrustTier: 'email_verified' }, 'viewer'), false);
});
