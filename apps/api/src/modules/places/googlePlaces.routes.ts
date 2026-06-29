import { Router } from 'express';
import {
  googleAddressValidationRequestSchema,
  googlePlaceDetailsQuerySchema,
  googlePlaceSearchQuerySchema,
  type GooglePlacePrediction,
  type GoogleResolvedPlace,
} from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';

export const googlePlacesRoutes = Router();

const placesAutocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete';
const placesDetailsBaseUrl = 'https://places.googleapis.com/v1/places';
const addressValidationUrl = 'https://addressvalidation.googleapis.com/v1:validateAddress';

const googlePlacesRateLimit = createRateLimiter({
  keyPrefix: 'google-places',
  windowMs: 60 * 1000,
  max: 45,
  message: 'Too many place searches. Please wait and try again.',
});

function disabledResponse(res: any, error: string, message: string, status = 404) {
  return res.status(status).json({ error, message });
}

function requireGooglePlacesReady(res: any) {
  if (!env.googlePlacesEnabled) {
    return disabledResponse(res, 'google_places_disabled', 'Google place search is disabled for this launch.');
  }
  if (!env.googleMapsServerApiKey) {
    return disabledResponse(res, 'google_places_not_configured', 'Google place search is not configured yet.', 503);
  }
  return null;
}

function requireAddressValidationReady(res: any) {
  if (!env.googleAddressValidationEnabled) {
    return disabledResponse(res, 'google_address_validation_disabled', 'Google address validation is disabled for this launch.');
  }
  if (!env.googleMapsServerApiKey) {
    return disabledResponse(res, 'google_places_not_configured', 'Google place search is not configured yet.', 503);
  }
  return null;
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'text' in value) return safeString((value as { text?: unknown }).text);
  return '';
}

function cleanLanguageCode(input?: string) {
  return input?.trim() || env.googlePlacesDefaultLanguage || 'en';
}

function cleanCountryCode(input?: string) {
  const value = input?.trim().toUpperCase();
  if (value && /^[A-Z]{2}$/.test(value)) return value;
  const fallback = env.googlePlacesCountryCodes[0];
  return fallback && /^[A-Z]{2}$/.test(fallback) ? fallback : undefined;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())));
}

function googleApiHeaders(fieldMask?: string) {
  return {
    'content-type': 'application/json',
    'x-goog-api-key': env.googleMapsServerApiKey,
    ...(fieldMask ? { 'x-goog-fieldmask': fieldMask } : {}),
  };
}

async function fetchGoogleJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.googlePlacesRequestTimeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const json = await response.json().catch(() => null) as any;
    if (!response.ok) {
      const message = safeString(json?.error?.message) || safeString(json?.error_message) || 'Google place lookup failed.';
      throw Object.assign(new Error(message), { statusCode: response.status, publicMessage: 'Google place lookup failed. Please try again.', providerMessage: message });
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePrediction(suggestion: any): GooglePlacePrediction | null {
  const prediction = suggestion?.placePrediction;
  const placeId = safeString(prediction?.placeId);
  if (!placeId) return null;

  const structured = prediction?.structuredFormat;
  const mainText = pickText(structured?.mainText) || pickText(prediction?.text) || placeId;
  const secondaryText = pickText(structured?.secondaryText) || null;
  const description = pickText(prediction?.text) || [mainText, secondaryText].filter(Boolean).join(', ');

  return {
    placeId,
    description,
    mainText,
    secondaryText,
    types: uniqueStrings(prediction?.types),
  };
}

function normalizeViewport(value: any) {
  if (!value || typeof value !== 'object') return null;
  const low = value.low;
  const high = value.high;
  return {
    ...(typeof low?.latitude === 'number' && typeof low?.longitude === 'number' ? { low: { latitude: low.latitude, longitude: low.longitude } } : {}),
    ...(typeof high?.latitude === 'number' && typeof high?.longitude === 'number' ? { high: { latitude: high.latitude, longitude: high.longitude } } : {}),
  };
}

function normalizeAddressComponents(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((component) => {
    const item = component as any;
    return {
      longText: safeString(item.longText) || null,
      shortText: safeString(item.shortText) || null,
      types: uniqueStrings(item.types),
      languageCode: safeString(item.languageCode) || null,
    };
  });
}

function validationStatusFor(place: { formattedAddress?: string | null; latitude?: number | null; longitude?: number | null }) {
  if (place.formattedAddress && typeof place.latitude === 'number' && typeof place.longitude === 'number') return 'confirmed' as const;
  if (typeof place.latitude === 'number' && typeof place.longitude === 'number') return 'needs_review' as const;
  return 'unsupported' as const;
}

function normalizePlace(place: any, fallbackPlaceId?: string): GoogleResolvedPlace {
  const placeId = safeString(place?.id) || safeString(fallbackPlaceId) || safeString(place?.name).replace(/^places\//, '');
  const location = place?.location;
  const normalized = {
    source: 'google_places' as const,
    placeId,
    name: pickText(place?.displayName) || null,
    formattedAddress: safeString(place?.formattedAddress) || safeString(place?.postalAddress?.formattedAddress) || null,
    latitude: typeof location?.latitude === 'number' ? location.latitude : null,
    longitude: typeof location?.longitude === 'number' ? location.longitude : null,
    googleMapsUri: safeString(place?.googleMapsUri) || null,
    types: uniqueStrings(place?.types),
    addressComponents: normalizeAddressComponents(place?.addressComponents),
    viewport: normalizeViewport(place?.viewport),
    validationStatus: 'unsupported' as const,
  };
  return { ...normalized, validationStatus: validationStatusFor(normalized) };
}

googlePlacesRoutes.use(requireAuth, requireActiveAccount, googlePlacesRateLimit);

googlePlacesRoutes.get('/search', asyncRoute(async (req, res) => {
  const disabled = requireGooglePlacesReady(res);
  if (disabled) return disabled;

  const input = googlePlaceSearchQuerySchema.parse(req.query ?? {});
  const country = cleanCountryCode(input.country);
  const body = {
    input: input.q,
    languageCode: cleanLanguageCode(input.languageCode),
    ...(country ? { includedRegionCodes: [country] } : {}),
    ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
  };

  const json = await fetchGoogleJson(placesAutocompleteUrl, {
    method: 'POST',
    headers: googleApiHeaders('suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types'),
    body: JSON.stringify(body),
  });

  const predictions = Array.isArray(json?.suggestions)
    ? json.suggestions.map(normalizePrediction).filter((item: GooglePlacePrediction | null): item is GooglePlacePrediction => Boolean(item)).slice(0, input.take ?? 5)
    : [];

  res.json({ predictions });
}));

googlePlacesRoutes.get('/details', asyncRoute(async (req, res) => {
  const disabled = requireGooglePlacesReady(res);
  if (disabled) return disabled;

  const input = googlePlaceDetailsQuerySchema.parse(req.query ?? {});
  const placeId = input.placeId.replace(/^places\//, '');
  const url = new URL(`${placesDetailsBaseUrl}/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', cleanLanguageCode(input.languageCode));
  if (input.sessionToken) url.searchParams.set('sessionToken', input.sessionToken);

  const json = await fetchGoogleJson(url.toString(), {
    method: 'GET',
    headers: googleApiHeaders('id,displayName,formattedAddress,location,viewport,addressComponents,types,googleMapsUri'),
  });

  res.json({ place: normalizePlace(json, placeId) });
}));

googlePlacesRoutes.post('/validate-address', asyncRoute(async (req, res) => {
  const disabled = requireAddressValidationReady(res);
  if (disabled) return disabled;

  const input = googleAddressValidationRequestSchema.parse(req.body ?? {});
  const regionCode = cleanCountryCode(input.regionCode);
  const json = await fetchGoogleJson(`${addressValidationUrl}?key=${encodeURIComponent(env.googleMapsServerApiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      address: {
        addressLines: [input.address],
        ...(regionCode ? { regionCode } : {}),
        languageCode: cleanLanguageCode(input.languageCode),
      },
    }),
  });

  const result = json?.result;
  const geocode = result?.geocode;
  const location = geocode?.location;
  const place = location
    ? normalizePlace({
      id: safeString(geocode.placeId),
      formattedAddress: safeString(result?.address?.formattedAddress) || input.address,
      location,
      addressComponents: result?.address?.addressComponents,
    }, safeString(geocode.placeId))
    : null;

  res.json({ place, validationStatus: place?.validationStatus ?? 'unsupported' });
}));
