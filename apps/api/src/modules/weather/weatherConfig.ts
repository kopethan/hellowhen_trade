import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
dotenv.config({ path: path.resolve(repoRoot, '.env') });

export type WeatherProviderName = 'none' | 'weatherkit';

export type WeatherRuntimeConfig = {
  enabled: boolean;
  provider: WeatherProviderName;
  requestTimeoutMs: number;
  cacheTtlMs: number;
  cacheMaxEntries: number;
  weatherKit: {
    teamId: string;
    serviceId: string;
    keyId: string;
    privateKey: string;
  };
};

type EnvSource = Record<string, string | undefined>;

function enabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function parseProvider(value: string | undefined): WeatherProviderName {
  return value?.trim().toLowerCase() === 'weatherkit' ? 'weatherkit' : 'none';
}

export function loadWeatherConfig(source: EnvSource = process.env): WeatherRuntimeConfig {
  return {
    enabled: enabled(source.WEATHER_ENABLED),
    provider: parseProvider(source.WEATHER_PROVIDER),
    requestTimeoutMs: boundedInt(source.WEATHER_REQUEST_TIMEOUT_MS, 4_500, 1_000, 15_000),
    cacheTtlMs: boundedInt(source.WEATHER_CACHE_TTL_SECONDS, 900, 60, 3_600) * 1_000,
    cacheMaxEntries: boundedInt(source.WEATHER_CACHE_MAX_ENTRIES, 500, 10, 10_000),
    weatherKit: {
      teamId: source.WEATHERKIT_TEAM_ID?.trim() ?? '',
      serviceId: source.WEATHERKIT_SERVICE_ID?.trim() ?? '',
      keyId: source.WEATHERKIT_KEY_ID?.trim() ?? '',
      privateKey: source.WEATHERKIT_PRIVATE_KEY ?? '',
    },
  };
}

export function validateWeatherConfig(config: WeatherRuntimeConfig) {
  if (!config.enabled) return [] as string[];

  const errors: string[] = [];
  if (config.provider === 'none') {
    errors.push('WEATHER_ENABLED=true requires WEATHER_PROVIDER=weatherkit.');
    return errors;
  }

  if (config.provider === 'weatherkit') {
    if (!config.weatherKit.teamId) errors.push('WEATHERKIT_TEAM_ID is required when WeatherKit is enabled.');
    if (!config.weatherKit.serviceId) errors.push('WEATHERKIT_SERVICE_ID is required when WeatherKit is enabled.');
    if (!config.weatherKit.keyId) errors.push('WEATHERKIT_KEY_ID is required when WeatherKit is enabled.');
    if (!config.weatherKit.privateKey.trim()) errors.push('WEATHERKIT_PRIVATE_KEY is required when WeatherKit is enabled.');
  }

  return errors;
}

export function assertWeatherConfig(config: WeatherRuntimeConfig) {
  const errors = validateWeatherConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid Hellowhen weather configuration:\n- ${errors.join('\n- ')}`);
  }
}
