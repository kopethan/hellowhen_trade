export const WEATHER_FORECAST_HORIZON_DAYS = 7;
export const WEATHER_FORECAST_HORIZON_MS = WEATHER_FORECAST_HORIZON_DAYS * 24 * 60 * 60 * 1000;

export type WeatherProviderId = 'weatherkit';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

export type WeatherHourlyPoint = {
  forecastStart: string;
  temperatureC: number;
};

export type WeatherAttribution = {
  serviceName: string;
  legalUrl: string;
  logoLightUrl: string;
  logoDarkUrl: string;
};

export type WeatherHourlyForecast = {
  provider: WeatherProviderId;
  providerName: string;
  attributionRequired: boolean;
  attribution?: WeatherAttribution;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  hours: WeatherHourlyPoint[];
};

export type WeatherProviderHourlyRequest = {
  latitude: number;
  longitude: number;
  hourlyStart: Date;
  hourlyEnd: Date;
  timezone: string;
  language: string;
};

export type WeatherProvider = {
  readonly id: WeatherProviderId;
  getHourlyForecast(input: WeatherProviderHourlyRequest): Promise<WeatherHourlyForecast | null>;
};

export function convertTemperatureFromCelsius(value: number, unit: TemperatureUnit) {
  if (!Number.isFinite(value)) return null;
  if (unit === 'celsius') return value;
  return (value * 9) / 5 + 32;
}
