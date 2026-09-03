import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWeatherConfig, validateWeatherConfig } from '../weatherConfig.js';
import { WeatherService } from '../weatherService.js';
import { WEATHER_FORECAST_HORIZON_MS, convertTemperatureFromCelsius, type WeatherProvider } from '../weatherTypes.js';

function makeProvider(handler?: WeatherProvider['getHourlyForecast']) {
  let calls = 0;
  const provider: WeatherProvider = {
    id: 'weatherkit',
    async getHourlyForecast(input) {
      calls += 1;
      if (handler) return handler(input);
      return {
        provider: 'weatherkit',
        providerName: 'Apple Weather',
        attributionRequired: true,
        latitude: input.latitude,
        longitude: input.longitude,
        fetchedAt: input.hourlyStart.toISOString(),
        hours: [{ forecastStart: input.hourlyStart.toISOString(), temperatureC: 18 }],
      };
    },
  };
  return { provider, calls: () => calls };
}

test('weather configuration is disabled by default and requires complete server credentials when enabled', () => {
  const disabled = loadWeatherConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.provider, 'none');
  assert.deepEqual(validateWeatherConfig(disabled), []);

  const incomplete = loadWeatherConfig({ WEATHER_ENABLED: 'true', WEATHER_PROVIDER: 'weatherkit' });
  assert.equal(validateWeatherConfig(incomplete).length, 4);
});

test('weather stays gracefully unavailable when no provider is configured', async () => {
  const service = new WeatherService({ provider: null, cacheTtlMs: 60_000, cacheMaxEntries: 10 });
  assert.equal(service.isAvailable(), false);
  assert.equal(await service.getHourlyForecast({ latitude: 48.8566, longitude: 2.3522 }), null);
});

test('weather service requests only the next seven days and caches nearby coordinates', async () => {
  const fixedNow = new Date('2026-09-02T12:00:00.000Z');
  const { provider, calls } = makeProvider(async (input) => {
    assert.equal(input.hourlyEnd.getTime() - input.hourlyStart.getTime(), WEATHER_FORECAST_HORIZON_MS);
    assert.equal(input.timezone, 'UTC');
    assert.equal(input.language, 'en');
    return {
      provider: 'weatherkit',
      providerName: 'Apple Weather',
      attributionRequired: true,
      latitude: input.latitude,
      longitude: input.longitude,
      fetchedAt: fixedNow.toISOString(),
      hours: [{ forecastStart: fixedNow.toISOString(), temperatureC: 14 }],
    };
  });
  const service = new WeatherService({
    provider,
    cacheTtlMs: 15 * 60_000,
    cacheMaxEntries: 20,
    now: () => fixedNow,
  });

  const first = await service.getHourlyForecast({ latitude: 48.85661, longitude: 2.35221 });
  const second = await service.getHourlyForecast({ latitude: 48.85664, longitude: 2.35224 });
  assert.equal(first?.hours[0]?.temperatureC, 14);
  assert.equal(second?.hours[0]?.temperatureC, 14);
  assert.equal(calls(), 1);
});

test('provider failures return null and are not cached', async () => {
  const { provider, calls } = makeProvider(async () => { throw new Error('provider unavailable'); });
  const service = new WeatherService({ provider, cacheTtlMs: 60_000, cacheMaxEntries: 10 });

  assert.equal(await service.getHourlyForecast({ latitude: 40.7128, longitude: -74.006 }), null);
  assert.equal(await service.getHourlyForecast({ latitude: 40.7128, longitude: -74.006 }), null);
  assert.equal(calls(), 2);
});

test('temperature conversion keeps Celsius canonical and supports Fahrenheit', () => {
  assert.equal(convertTemperatureFromCelsius(20, 'celsius'), 20);
  assert.equal(convertTemperatureFromCelsius(20, 'fahrenheit'), 68);
  assert.equal(convertTemperatureFromCelsius(Number.NaN, 'fahrenheit'), null);
});
