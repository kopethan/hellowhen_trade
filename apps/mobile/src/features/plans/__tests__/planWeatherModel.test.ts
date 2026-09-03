import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLAN_WEATHER_CLIENT_HORIZON_MS,
  formatPlanTemperature,
  isPlanPlaceWeatherClientEligible,
  isSyntheticPlanWeatherPlanId,
  nextPlanTemperatureUnit,
  parsePlanPlaceWeatherResponse,
  temperatureForUnit,
} from '../planWeatherModel';

const now = new Date('2026-09-02T12:00:00.000Z');

function response(overrides: Record<string, unknown> = {}) {
  return {
    weather: {
      temperatureC: 18.4,
      forecastStart: '2026-09-03T12:00:00.000Z',
      scheduledFor: '2026-09-03T12:20:00.000Z',
      provider: 'weatherkit',
      providerName: 'Apple Weather',
      attributionRequired: true,
      attribution: {
        serviceName: 'Apple Weather',
        legalUrl: 'https://weatherkit.apple.com/legal-attribution.html',
        logoLightUrl: 'https://weatherkit.apple.com/assets/light.png',
        logoDarkUrl: 'https://weatherkit.apple.com/assets/dark.png',
      },
      fetchedAt: '2026-09-02T12:00:00.000Z',
      ...overrides,
    },
  };
}

test('mobile eligibility uses only an offline Plan Place own startsAt', () => {
  assert.equal(isPlanPlaceWeatherClientEligible({ mode: 'local', startsAt: '2026-09-03T12:00:00Z' }, now), true);
  assert.equal(isPlanPlaceWeatherClientEligible({ mode: 'remote', startsAt: '2026-09-03T12:00:00Z' }, now), false);
  assert.equal(isPlanPlaceWeatherClientEligible({ mode: 'local', startsAt: null, planStartsAt: '2026-09-03T12:00:00Z' } as any, now), false);
  assert.equal(isPlanPlaceWeatherClientEligible({ mode: 'local', startsAt: '2026-09-02T11:59:59Z' }, now), false);
  assert.equal(isPlanPlaceWeatherClientEligible({ mode: 'local', startsAt: new Date(now.getTime() + PLAN_WEATHER_CLIENT_HORIZON_MS).toISOString() }, now), false);
});

test('synthetic starter and create-preview Plans never request weather', () => {
  assert.equal(isSyntheticPlanWeatherPlanId('starter-plan-idea-coffee'), true);
  assert.equal(isSyntheticPlanWeatherPlanId('create-plan-preview'), true);
  assert.equal(isSyntheticPlanWeatherPlanId('cm123-real-plan'), false);
});

test('temperature formatting keeps Celsius default semantics and converts Fahrenheit', () => {
  assert.equal(temperatureForUnit(20, 'celsius'), 20);
  assert.equal(temperatureForUnit(20, 'fahrenheit'), 68);
  assert.equal(formatPlanTemperature(18.4, 'celsius'), '18°C');
  assert.equal(formatPlanTemperature(18.4, 'fahrenheit'), '65°F');
  assert.equal(nextPlanTemperatureUnit('celsius'), 'fahrenheit');
  assert.equal(nextPlanTemperatureUnit('fahrenheit'), 'celsius');
});

test('weather response parser requires complete WeatherKit attribution before display', () => {
  const parsed = parsePlanPlaceWeatherResponse(response());
  assert.equal(parsed?.temperatureC, 18.4);
  assert.equal(parsed?.attribution.serviceName, 'Apple Weather');

  assert.equal(parsePlanPlaceWeatherResponse(response({ attribution: null })), null);
  assert.equal(parsePlanPlaceWeatherResponse(response({ attributionRequired: false })), null);
  assert.equal(parsePlanPlaceWeatherResponse(response({ provider: 'other' })), null);
  assert.equal(parsePlanPlaceWeatherResponse(response({ temperatureC: Number.NaN })), null);
  assert.equal(parsePlanPlaceWeatherResponse(response({
    attribution: {
      serviceName: 'Apple Weather',
      legalUrl: 'http://example.com/legal',
      logoLightUrl: 'https://weatherkit.apple.com/assets/light.png',
      logoDarkUrl: 'https://weatherkit.apple.com/assets/dark.png',
    },
  })), null);
});
