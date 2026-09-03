import { assertWeatherConfig, loadWeatherConfig, type WeatherRuntimeConfig } from './weatherConfig.js';
import { WeatherKitProvider } from './weatherKitProvider.js';
import { WeatherService } from './weatherService.js';
import type { WeatherProvider } from './weatherTypes.js';

export function createWeatherService(config: WeatherRuntimeConfig = loadWeatherConfig()) {
  if (!config.enabled) {
    return new WeatherService({
      provider: null,
      cacheTtlMs: config.cacheTtlMs,
      cacheMaxEntries: config.cacheMaxEntries,
    });
  }

  assertWeatherConfig(config);
  let provider: WeatherProvider | null = null;

  if (config.provider === 'weatherkit') {
    provider = new WeatherKitProvider({
      credentials: config.weatherKit,
      requestTimeoutMs: config.requestTimeoutMs,
    });
  }

  return new WeatherService({
    provider,
    cacheTtlMs: config.cacheTtlMs,
    cacheMaxEntries: config.cacheMaxEntries,
  });
}

export const weatherService = createWeatherService();
