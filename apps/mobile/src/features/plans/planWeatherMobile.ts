import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlanPlaceDto } from '@hellowhen/contracts';
import { API_URL, refreshMobileSession } from '../../lib/api';
import { getAccessToken } from '../../lib/tokenStore';
import {
  isPlanPlaceWeatherClientEligible,
  nextPlanTemperatureUnit,
  parsePlanPlaceWeatherResponse,
  type PlanPlaceWeatherSnapshot,
  type PlanTemperatureUnit,
} from './planWeatherModel';

const PLAN_WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;
const PLAN_TEMPERATURE_UNIT_STORAGE_KEY = 'hellowhen_plan_temperature_unit_v1';

type CachedWeather = { value: PlanPlaceWeatherSnapshot | null; expiresAt: number };
const weatherCache = new Map<string, CachedWeather>();
const weatherInFlight = new Map<string, Promise<PlanPlaceWeatherSnapshot | null>>();

let temperatureUnit: PlanTemperatureUnit = 'celsius';
let temperatureUnitHydrated = false;
let temperatureUnitHydration: Promise<void> | null = null;
const temperatureUnitListeners = new Set<(unit: PlanTemperatureUnit) => void>();

function weatherCacheKey(viewerId: string, planId: string, planPlaceId: string) {
  return `${viewerId}:${planId}:${planPlaceId}`;
}

function cachedWeatherValue(key: string) {
  const cached = weatherCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    weatherCache.delete(key);
    return undefined;
  }
  return cached.value;
}

async function requestPlanPlaceWeather(planId: string, planPlaceId: string, retryUnauthorized = true): Promise<PlanPlaceWeatherSnapshot | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`${API_URL}/plans/${encodeURIComponent(planId)}/places/${encodeURIComponent(planPlaceId)}/weather`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401 && retryUnauthorized) {
    const refreshed = await refreshMobileSession().catch(() => null);
    if (!refreshed) return null;
    return requestPlanPlaceWeather(planId, planPlaceId, false);
  }
  if (!response.ok) return null;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return parsePlanPlaceWeatherResponse(body);
}

async function loadPlanPlaceWeather(viewerId: string, planId: string, planPlaceId: string) {
  const key = weatherCacheKey(viewerId, planId, planPlaceId);
  const cached = cachedWeatherValue(key);
  if (cached !== undefined) return cached;

  const existing = weatherInFlight.get(key);
  if (existing) return existing;

  const request = requestPlanPlaceWeather(planId, planPlaceId)
    .catch(() => null)
    .then((value) => {
      weatherCache.set(key, { value, expiresAt: Date.now() + PLAN_WEATHER_CACHE_TTL_MS });
      return value;
    })
    .finally(() => weatherInFlight.delete(key));
  weatherInFlight.set(key, request);
  return request;
}

function emitTemperatureUnit() {
  for (const listener of temperatureUnitListeners) listener(temperatureUnit);
}

function hydrateTemperatureUnit() {
  if (temperatureUnitHydrated) return Promise.resolve();
  if (temperatureUnitHydration) return temperatureUnitHydration;

  temperatureUnitHydration = AsyncStorage.getItem(PLAN_TEMPERATURE_UNIT_STORAGE_KEY)
    .then((stored) => {
      if (stored === 'fahrenheit' || stored === 'celsius') temperatureUnit = stored;
      temperatureUnitHydrated = true;
      emitTemperatureUnit();
    })
    .catch(() => {
      temperatureUnitHydrated = true;
    })
    .finally(() => {
      temperatureUnitHydration = null;
    });
  return temperatureUnitHydration;
}

export function useTemperatureUnitPreference() {
  const [unit, setUnit] = useState<PlanTemperatureUnit>(temperatureUnit);

  useEffect(() => {
    const listener = (nextUnit: PlanTemperatureUnit) => setUnit(nextUnit);
    temperatureUnitListeners.add(listener);
    void hydrateTemperatureUnit();
    return () => { temperatureUnitListeners.delete(listener); };
  }, []);

  const toggleUnit = useCallback(async () => {
    await hydrateTemperatureUnit();
    temperatureUnit = nextPlanTemperatureUnit(temperatureUnit);
    emitTemperatureUnit();
    await AsyncStorage.setItem(PLAN_TEMPERATURE_UNIT_STORAGE_KEY, temperatureUnit).catch(() => undefined);
  }, []);

  return { unit, toggleUnit };
}

export function usePlanPlaceWeather(planId: string, place: PlanPlaceDto | undefined, viewerId: string | undefined, enabled = true) {
  const cacheKey = useMemo(() => place && viewerId ? weatherCacheKey(viewerId, planId, place.id) : '', [viewerId, planId, place?.id]);
  const [weather, setWeather] = useState<PlanPlaceWeatherSnapshot | null>(() => cacheKey ? cachedWeatherValue(cacheKey) ?? null : null);

  useEffect(() => {
    let active = true;
    if (!enabled || !viewerId || !place || !isPlanPlaceWeatherClientEligible(place)) {
      setWeather(null);
      return () => { active = false; };
    }

    const cached = cachedWeatherValue(weatherCacheKey(viewerId, planId, place.id));
    if (cached !== undefined) {
      setWeather(cached);
      return () => { active = false; };
    }

    void loadPlanPlaceWeather(viewerId, planId, place.id).then((value) => {
      if (active) setWeather(value);
    });
    return () => { active = false; };
  }, [enabled, viewerId, planId, place?.id, place?.mode, place?.startsAt]);

  return weather;
}
