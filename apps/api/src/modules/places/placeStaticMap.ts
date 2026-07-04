import { env } from '../../config/env.js';
import {
  getPlaceStaticMapTemplate,
  getPlaceStaticMapVariant,
  isPlaceStaticMapTemplateFamily,
} from './placeStaticMapTemplates.js';

const GOOGLE_STATIC_MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api/staticmap';
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const DEFAULT_SCALE = 2;
const DEFAULT_ZOOM = 14;

type StaticMapTheme = 'light' | 'dark';
type StaticMapSurface = 'detail' | 'list' | 'preview';
type StaticMapUnavailableReason = 'disabled' | 'anonymous_blocked' | 'soft_limit' | 'hard_limit' | 'unavailable';

type StaticMappablePlace = {
  mode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  addressPublicText?: string | null;
  areaLabel?: string | null;
  googlePlaceName?: string | null;
  staticMapTemplateFamily?: string | null;
  visualTemplateKey?: string | null;
  sourcePlace?: StaticMappablePlace | null;
};

type PlaceStaticMapBuildOptions = {
  viewerId?: string | null;
  estimatedRequestCount?: number;
  surface?: StaticMapSurface;
};

type StaticMapBudgetWindow = {
  key: string;
  count: number;
};

export type PlaceStaticMapBudgetSnapshot = {
  enabled: boolean;
  anonymousEnabled: boolean;
  dailySoftLimit: number;
  monthlySoftLimit: number;
  monthlyHardLimit: number;
  dailyIssued: number;
  monthlyIssued: number;
  state: 'available' | 'soft_limited' | 'hard_limited' | 'disabled';
};

export type PlaceStaticMapDto = {
  provider: 'google_static_maps';
  templateFamily: string;
  source: 'coordinates' | 'address';
  width: number;
  height: number;
  scale: number;
  zoom: number;
  lightUrl: string;
  darkUrl: string;
};

export type PlaceStaticMapStatusDto = {
  state: 'available' | 'unavailable';
  reason?: StaticMapUnavailableReason;
  surface?: StaticMapSurface;
  message?: string;
};

export type PlaceStaticMapBuildResult = {
  staticMap: PlaceStaticMapDto | null;
  staticMapStatus: PlaceStaticMapStatusDto;
};

let dailyBudgetWindow: StaticMapBudgetWindow = { key: '', count: 0 };
let monthlyBudgetWindow: StaticMapBudgetWindow = { key: '', count: 0 };

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function utcMonthKey(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

function refreshBudgetWindows(now = new Date()) {
  const dayKey = utcDayKey(now);
  const monthKey = utcMonthKey(now);
  if (dailyBudgetWindow.key !== dayKey) dailyBudgetWindow = { key: dayKey, count: 0 };
  if (monthlyBudgetWindow.key !== monthKey) monthlyBudgetWindow = { key: monthKey, count: 0 };
}

function canUseAnonymousStaticMaps(options?: PlaceStaticMapBuildOptions | null) {
  return Boolean(options?.viewerId) || env.googleStaticMapsAnonymousEnabled;
}

function budgetUnavailableStatus(reason: StaticMapUnavailableReason, surface: StaticMapSurface): PlaceStaticMapStatusDto {
  return {
    state: 'unavailable',
    reason,
    surface,
    message: reason === 'hard_limit'
      ? 'Map preview paused. Open in Google Maps.'
      : 'Map preview limited. Open in Google Maps.',
  };
}

function reserveStaticMapBudget(options?: PlaceStaticMapBuildOptions | null): PlaceStaticMapStatusDto {
  const surface = options?.surface ?? 'detail';
  if (!canUseAnonymousStaticMaps(options)) return budgetUnavailableStatus('anonymous_blocked', surface);

  refreshBudgetWindows();
  const estimate = Math.max(1, Math.trunc(options?.estimatedRequestCount ?? 1));
  const dailySoftLimit = env.googleStaticMapsDailySoftLimit;
  const monthlySoftLimit = env.googleStaticMapsMonthlySoftLimit;
  const monthlyHardLimit = env.googleStaticMapsMonthlyHardLimit;
  if (dailySoftLimit <= 0 || monthlySoftLimit <= 0 || monthlyHardLimit <= 0) return budgetUnavailableStatus('disabled', surface);
  if (monthlyBudgetWindow.count + estimate > monthlyHardLimit) return budgetUnavailableStatus('hard_limit', surface);

  const softLimitReached = dailyBudgetWindow.count + estimate > dailySoftLimit
    || monthlyBudgetWindow.count + estimate > monthlySoftLimit;
  if (softLimitReached && surface !== 'detail') return budgetUnavailableStatus('soft_limit', surface);

  dailyBudgetWindow.count += estimate;
  monthlyBudgetWindow.count += estimate;
  return { state: 'available', surface };
}

export function getPlaceStaticMapBudgetSnapshot(now = new Date()): PlaceStaticMapBudgetSnapshot {
  refreshBudgetWindows(now);
  const softLimited = dailyBudgetWindow.count >= env.googleStaticMapsDailySoftLimit
    || monthlyBudgetWindow.count >= env.googleStaticMapsMonthlySoftLimit;
  const hardLimited = env.googleStaticMapsMonthlyHardLimit <= 0
    || monthlyBudgetWindow.count >= env.googleStaticMapsMonthlyHardLimit;
  return {
    enabled: env.googleStaticMapsEnabled,
    anonymousEnabled: env.googleStaticMapsAnonymousEnabled,
    dailySoftLimit: env.googleStaticMapsDailySoftLimit,
    monthlySoftLimit: env.googleStaticMapsMonthlySoftLimit,
    monthlyHardLimit: env.googleStaticMapsMonthlyHardLimit,
    dailyIssued: dailyBudgetWindow.count,
    monthlyIssued: monthlyBudgetWindow.count,
    state: !env.googleStaticMapsEnabled ? 'disabled' : hardLimited ? 'hard_limited' : softLimited ? 'soft_limited' : 'available',
  };
}

function normalizedText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizedText(value);
    if (normalized) return normalized;
  }
  return null;
}

function resolveCoordinates(place?: StaticMappablePlace | null) {
  const latitude = typeof place?.latitude === 'number' && Number.isFinite(place.latitude) ? place.latitude : null;
  const longitude = typeof place?.longitude === 'number' && Number.isFinite(place.longitude) ? place.longitude : null;
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  if (place?.sourcePlace) return resolveCoordinates(place.sourcePlace);
  return null;
}

function resolveAddress(place?: StaticMappablePlace | null) {
  const address = firstNonEmpty(
    place?.addressPublicText,
    place?.areaLabel,
    place?.formattedAddress,
    place?.googlePlaceName,
  );
  if (address) return address;
  if (place?.sourcePlace) return resolveAddress(place.sourcePlace);
  return null;
}

function resolveTemplateFamily(place?: StaticMappablePlace | null) {
  if (isPlaceStaticMapTemplateFamily(place?.staticMapTemplateFamily)) return place.staticMapTemplateFamily;
  if (isPlaceStaticMapTemplateFamily(place?.visualTemplateKey)) return place.visualTemplateKey;
  if (isPlaceStaticMapTemplateFamily(place?.sourcePlace?.staticMapTemplateFamily)) return place.sourcePlace.staticMapTemplateFamily;
  if (isPlaceStaticMapTemplateFamily(place?.sourcePlace?.visualTemplateKey)) return place.sourcePlace.visualTemplateKey;
  if (isPlaceStaticMapTemplateFamily(env.googleStaticMapsDefaultTemplate)) return env.googleStaticMapsDefaultTemplate;
  return 'clean_local';
}

function mapIdForTheme(theme: StaticMapTheme) {
  if (theme === 'dark') return env.googleStaticMapsDarkMapId || env.googleStaticMapsDefaultMapId || '';
  return env.googleStaticMapsLightMapId || env.googleStaticMapsDefaultMapId || '';
}

function buildThemeUrl(place: StaticMappablePlace, source: 'coordinates' | 'address', theme: StaticMapTheme, templateFamily: ReturnType<typeof resolveTemplateFamily>) {
  const apiKey = env.googleStaticMapsApiKey || env.googleMapsServerApiKey;
  if (!apiKey) return null;

  const template = getPlaceStaticMapTemplate(templateFamily);
  const variant = getPlaceStaticMapVariant(template, theme);
  const zoom = variant.zoom ?? DEFAULT_ZOOM;
  const mapType = variant.mapType ?? 'roadmap';

  const params = new URLSearchParams();
  params.set('size', `${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}`);
  params.set('scale', String(DEFAULT_SCALE));
  params.set('zoom', String(zoom));
  params.set('maptype', mapType);
  params.set('key', apiKey);
  const mapId = mapIdForTheme(theme);
  if (mapId) params.set('map_id', mapId);

  if (source === 'coordinates') {
    const coordinates = resolveCoordinates(place);
    if (!coordinates) return null;
    const coordinateString = `${coordinates.latitude},${coordinates.longitude}`;
    params.set('center', coordinateString);
    params.append('markers', `size:mid|color:${variant.markerColor}|${coordinateString}`);
  } else {
    const address = resolveAddress(place);
    if (!address) return null;
    params.set('center', address);
    params.append('markers', `size:mid|color:${variant.markerColor}|${address}`);
  }

  if (!mapId) {
    for (const style of variant.styles) params.append('style', style);
  }

  return { url: `${GOOGLE_STATIC_MAPS_BASE_URL}?${params.toString()}`, zoom };
}

export function buildPlaceStaticMapResult(place?: StaticMappablePlace | null, options?: PlaceStaticMapBuildOptions | null): PlaceStaticMapBuildResult {
  const surface = options?.surface ?? 'detail';
  if (!env.googleStaticMapsEnabled) {
    return { staticMap: null, staticMapStatus: budgetUnavailableStatus('disabled', surface) };
  }
  if (!place || place.mode === 'remote') {
    return { staticMap: null, staticMapStatus: budgetUnavailableStatus('unavailable', surface) };
  }

  const coordinates = resolveCoordinates(place);
  const source: 'coordinates' | 'address' | null = coordinates
    ? 'coordinates'
    : (resolveAddress(place) ? 'address' : null);
  if (!source) return { staticMap: null, staticMapStatus: budgetUnavailableStatus('unavailable', surface) };
  if (!env.googleStaticMapsApiKey && !env.googleMapsServerApiKey) {
    return { staticMap: null, staticMapStatus: budgetUnavailableStatus('unavailable', surface) };
  }

  const budgetStatus = reserveStaticMapBudget(options);
  if (budgetStatus.state !== 'available') return { staticMap: null, staticMapStatus: budgetStatus };

  const templateFamily = resolveTemplateFamily(place);
  const light = buildThemeUrl(place, source, 'light', templateFamily);
  const dark = buildThemeUrl(place, source, 'dark', templateFamily);
  if (!light || !dark) return { staticMap: null, staticMapStatus: budgetUnavailableStatus('unavailable', surface) };

  return {
    staticMap: {
      provider: 'google_static_maps',
      templateFamily,
      source,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      scale: DEFAULT_SCALE,
      zoom: light.zoom,
      lightUrl: light.url,
      darkUrl: dark.url,
    },
    staticMapStatus: { state: 'available', surface },
  };
}

export function buildPlaceStaticMap(place?: StaticMappablePlace | null, options?: PlaceStaticMapBuildOptions | null): PlaceStaticMapDto | null {
  return buildPlaceStaticMapResult(place, options).staticMap;
}
