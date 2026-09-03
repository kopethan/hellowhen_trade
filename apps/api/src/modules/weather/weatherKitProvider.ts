import { createPrivateKey, sign as signPayload } from 'node:crypto';
import type {
  WeatherAttribution,
  WeatherHourlyForecast,
  WeatherHourlyPoint,
  WeatherProvider,
  WeatherProviderHourlyRequest,
} from './weatherTypes.js';

const WEATHERKIT_BASE_URL = 'https://weatherkit.apple.com';
const WEATHERKIT_TOKEN_TTL_SECONDS = 45 * 60;
const WEATHERKIT_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

export type WeatherKitCredentials = {
  teamId: string;
  serviceId: string;
  keyId: string;
  privateKey: string;
};

type WeatherKitProviderOptions = {
  credentials: WeatherKitCredentials;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type WeatherKitHourlyResponse = {
  forecastHourly?: {
    metadata?: {
      attributionURL?: unknown;
      providerName?: unknown;
    };
    hours?: Array<{
      forecastStart?: unknown;
      temperature?: unknown;
    }>;
  };
};

type WeatherKitAttributionResponse = {
  serviceName?: unknown;
  'logoDark@1x'?: unknown;
  'logoDark@2x'?: unknown;
  'logoDark@3x'?: unknown;
  'logoLight@1x'?: unknown;
  'logoLight@2x'?: unknown;
  'logoLight@3x'?: unknown;
};

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function normalizeWeatherKitPrivateKey(value: string) {
  return value.trim().replace(/\\n/g, '\n');
}

export function createWeatherKitDeveloperToken(credentials: WeatherKitCredentials, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = {
    alg: 'ES256',
    kid: credentials.keyId,
    id: `${credentials.teamId}.${credentials.serviceId}`,
  };
  const payload = {
    iss: credentials.teamId,
    iat: issuedAt,
    exp: issuedAt + WEATHERKIT_TOKEN_TTL_SECONDS,
    sub: credentials.serviceId,
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const privateKey = createPrivateKey(normalizeWeatherKitPrivateKey(credentials.privateKey));
  const signature = signPayload('sha256', Buffer.from(signingInput, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${signature.toString('base64url')}`;
}

function parseHourlyPoints(response: WeatherKitHourlyResponse): WeatherHourlyPoint[] {
  const hours = response.forecastHourly?.hours;
  if (!Array.isArray(hours)) return [];

  return hours.flatMap((hour) => {
    const forecastStart = typeof hour.forecastStart === 'string' ? hour.forecastStart : '';
    const temperatureC = typeof hour.temperature === 'number' ? hour.temperature : Number.NaN;
    if (!forecastStart || !Number.isFinite(Date.parse(forecastStart)) || !Number.isFinite(temperatureC)) return [];
    return [{ forecastStart, temperatureC }];
  });
}

function absoluteWeatherKitAssetUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value, WEATHERKIT_BASE_URL).toString();
  } catch {
    return null;
  }
}

function parseWeatherKitAttribution(response: WeatherKitAttributionResponse, legalUrl: unknown): WeatherAttribution | null {
  if (typeof legalUrl !== 'string' || !legalUrl.trim()) return null;
  let parsedLegalUrl: string;
  try {
    const parsed = new URL(legalUrl);
    if (parsed.protocol !== 'https:') return null;
    parsedLegalUrl = parsed.toString();
  } catch {
    return null;
  }

  const logoLightUrl = absoluteWeatherKitAssetUrl(response['logoLight@2x'] ?? response['logoLight@1x'] ?? response['logoLight@3x']);
  const logoDarkUrl = absoluteWeatherKitAssetUrl(response['logoDark@2x'] ?? response['logoDark@1x'] ?? response['logoDark@3x']);
  if (!logoLightUrl || !logoDarkUrl) return null;

  return {
    serviceName: typeof response.serviceName === 'string' && response.serviceName.trim() ? response.serviceName.trim() : 'Apple Weather',
    legalUrl: parsedLegalUrl,
    logoLightUrl,
    logoDarkUrl,
  };
}

export class WeatherKitProvider implements WeatherProvider {
  readonly id = 'weatherkit' as const;
  private readonly credentials: WeatherKitCredentials;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private cachedToken: { value: string; refreshAfterMs: number } | null = null;
  private readonly attributionByLanguage = new Map<string, Promise<WeatherKitAttributionResponse | null>>();

  constructor(options: WeatherKitProviderOptions) {
    this.credentials = options.credentials;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  private getDeveloperToken() {
    const now = this.now();
    if (this.cachedToken && now.getTime() < this.cachedToken.refreshAfterMs) return this.cachedToken.value;

    const value = createWeatherKitDeveloperToken(this.credentials, now);
    this.cachedToken = {
      value,
      refreshAfterMs: now.getTime() + WEATHERKIT_TOKEN_TTL_SECONDS * 1000 - WEATHERKIT_TOKEN_REFRESH_SKEW_MS,
    };
    return value;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.getDeveloperToken()}`,
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`WeatherKit request failed with status ${response.status}.`);
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getAttributionAssets(language: string) {
    const normalizedLanguage = language.trim().toLowerCase() || 'en';
    const cached = this.attributionByLanguage.get(normalizedLanguage);
    if (cached) return cached;

    const request = this.fetchJson<WeatherKitAttributionResponse>(
      new URL(`/attribution/${encodeURIComponent(normalizedLanguage)}`, WEATHERKIT_BASE_URL),
    ).catch(() => {
      this.attributionByLanguage.delete(normalizedLanguage);
      return null;
    });
    this.attributionByLanguage.set(normalizedLanguage, request);
    return request;
  }

  async getHourlyForecast(input: WeatherProviderHourlyRequest): Promise<WeatherHourlyForecast | null> {
    const url = new URL(
      `/api/v1/weather/${encodeURIComponent(input.language)}/${input.latitude}/${input.longitude}`,
      WEATHERKIT_BASE_URL,
    );
    url.searchParams.set('dataSets', 'forecastHourly');
    url.searchParams.set('timezone', input.timezone);
    url.searchParams.set('hourlyStart', input.hourlyStart.toISOString());
    url.searchParams.set('hourlyEnd', input.hourlyEnd.toISOString());

    const body = await this.fetchJson<WeatherKitHourlyResponse>(url);
    const hours = parseHourlyPoints(body);
    if (hours.length === 0) return null;

    const attributionAssets = await this.getAttributionAssets(input.language);
    const attribution = attributionAssets
      ? parseWeatherKitAttribution(attributionAssets, body.forecastHourly?.metadata?.attributionURL)
      : null;
    if (!attribution) return null;

    return {
      provider: this.id,
      providerName: typeof body.forecastHourly?.metadata?.providerName === 'string' && body.forecastHourly.metadata.providerName.trim()
        ? body.forecastHourly.metadata.providerName.trim()
        : attribution.serviceName,
      attributionRequired: true,
      attribution,
      latitude: input.latitude,
      longitude: input.longitude,
      fetchedAt: this.now().toISOString(),
      hours,
    };
  }
}
