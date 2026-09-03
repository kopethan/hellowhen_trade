import {
  WEATHER_FORECAST_HORIZON_MS,
  type WeatherHourlyForecast,
  type WeatherProvider,
} from './weatherTypes.js';

type WeatherServiceOptions = {
  provider: WeatherProvider | null;
  cacheTtlMs: number;
  cacheMaxEntries: number;
  now?: () => Date;
};

export type HourlyWeatherLookup = {
  latitude: number;
  longitude: number;
  timezone?: string;
  language?: string;
};

type CacheEntry = {
  value: WeatherHourlyForecast;
  expiresAtMs: number;
};

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function normalizeLanguage(value: string | undefined) {
  const language = (value ?? 'en').trim();
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language) ? language : 'en';
}

function normalizeTimezone(value: string | undefined) {
  const timezone = (value ?? 'UTC').trim();
  return timezone.length > 0 && timezone.length <= 100 ? timezone : 'UTC';
}

function cacheCoordinate(value: number) {
  return value.toFixed(3);
}

export class WeatherService {
  private readonly provider: WeatherProvider | null;
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;
  private readonly now: () => Date;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<WeatherHourlyForecast | null>>();

  constructor(options: WeatherServiceOptions) {
    this.provider = options.provider;
    this.cacheTtlMs = Math.max(0, options.cacheTtlMs);
    this.cacheMaxEntries = Math.max(1, Math.trunc(options.cacheMaxEntries));
    this.now = options.now ?? (() => new Date());
  }

  isAvailable() {
    return this.provider !== null;
  }

  async getHourlyForecast(input: HourlyWeatherLookup): Promise<WeatherHourlyForecast | null> {
    if (!this.provider || !isValidCoordinate(input.latitude, input.longitude)) return null;

    const normalized = {
      ...input,
      timezone: normalizeTimezone(input.timezone),
      language: normalizeLanguage(input.language),
    };
    const key = this.makeCacheKey(normalized);
    const now = this.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAtMs > now.getTime()) return cached.value;
    if (cached) this.cache.delete(key);

    const existingRequest = this.inFlight.get(key);
    if (existingRequest) return existingRequest;

    const request = this.loadForecast(normalized, now, key)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async loadForecast(
    input: HourlyWeatherLookup & { timezone: string; language: string },
    now: Date,
    cacheKey: string,
  ): Promise<WeatherHourlyForecast | null> {
    try {
      const forecast = await this.provider!.getHourlyForecast({
        latitude: input.latitude,
        longitude: input.longitude,
        hourlyStart: now,
        hourlyEnd: new Date(now.getTime() + WEATHER_FORECAST_HORIZON_MS),
        timezone: input.timezone,
        language: input.language,
      });
      if (!forecast) return null;
      this.writeCache(cacheKey, forecast, now.getTime());
      return forecast;
    } catch {
      // Weather is optional Plan metadata. Provider failures must never make a
      // Plan or Place fail to load; callers receive no weather instead.
      return null;
    }
  }

  private makeCacheKey(input: HourlyWeatherLookup & { timezone: string; language: string }) {
    return [
      this.provider!.id,
      cacheCoordinate(input.latitude),
      cacheCoordinate(input.longitude),
      input.timezone,
      input.language,
    ].join(':');
  }

  private writeCache(key: string, value: WeatherHourlyForecast, nowMs: number) {
    if (this.cacheTtlMs <= 0) return;

    for (const [existingKey, entry] of this.cache) {
      if (entry.expiresAtMs <= nowMs) this.cache.delete(existingKey);
    }
    while (this.cache.size >= this.cacheMaxEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, expiresAtMs: nowMs + this.cacheTtlMs });
  }
}
