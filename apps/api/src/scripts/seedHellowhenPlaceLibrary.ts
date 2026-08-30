import {
  InventoryTranslationTargetType,
  PlaceAddressValidationStatus,
  PlaceLocationSource,
  PlaceSource,
  PlaceStatus,
  PlaceVisibility,
  PlanPlaceMode,
  PrismaClient,
} from '@prisma/client';
import { env } from '../config/env.js';
import { reserveGooglePlacesBudget } from '../modules/places/googlePlacesBudget.js';
import {
  HELLOWHEN_PLACE_LIBRARY_PACK,
  googlePredictionMatchesEntry,
  hellowhenPlaceLibrarySeedEntries,
  type HellowhenPlaceLibrarySeedEntry,
} from '../modules/places/hellowhenPlaceLibrarySeed.js';
import { placeStaticMapTemplateFamilyForSeed } from '../modules/places/placeStaticMapTemplates.js';

const prisma = new PrismaClient();
const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete';
const detailsBaseUrl = 'https://places.googleapis.com/v1/places';

function parseOnlyKeys(argv: string[]) {
  const option = argv.find((arg) => arg.startsWith('--only='));
  if (!option) return null;
  const values = option.slice('--only='.length).split(',').map((value) => value.trim()).filter(Boolean);
  return values.length ? new Set(values) : null;
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'text' in value) return safeString((value as { text?: unknown }).text);
  return '';
}

async function fetchGoogleJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.googlePlacesRequestTimeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const json = await response.json().catch(() => null) as any;
    if (!response.ok) {
      const providerMessage = safeString(json?.error?.message) || safeString(json?.error_message) || `Google Places request failed with HTTP ${response.status}.`;
      throw new Error(providerMessage);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function googleHeaders(fieldMask?: string) {
  return {
    'content-type': 'application/json',
    'x-goog-api-key': env.googleMapsServerApiKey,
    ...(fieldMask ? { 'x-goog-fieldmask': fieldMask } : {}),
  };
}

async function resolveGooglePlace(entry: HellowhenPlaceLibrarySeedEntry) {
  const autocompleteBudget = reserveGooglePlacesBudget('autocomplete');
  if (!autocompleteBudget.ok) throw new Error(autocompleteBudget.message);

  const autocomplete = await fetchGoogleJson(autocompleteUrl, {
    method: 'POST',
    headers: googleHeaders('suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'),
    body: JSON.stringify({
      input: entry.googleQuery,
      languageCode: 'en',
      includedRegionCodes: [entry.countryCode],
    }),
  });

  const predictions = Array.isArray(autocomplete?.suggestions)
    ? autocomplete.suggestions.map((suggestion: any) => suggestion?.placePrediction).filter(Boolean)
    : [];
  const prediction = predictions.find((candidate: any) => {
    const text = [pickText(candidate?.structuredFormat?.mainText), pickText(candidate?.structuredFormat?.secondaryText), pickText(candidate?.text)].filter(Boolean).join(' ');
    return safeString(candidate?.placeId) && googlePredictionMatchesEntry(entry, text);
  });

  const placeId = safeString(prediction?.placeId);
  if (!placeId) {
    const candidates = predictions.map((candidate: any) => pickText(candidate?.text)).filter(Boolean).slice(0, 5);
    throw new Error(`No safe Google Places match for ${entry.key}. Candidates: ${candidates.join(' | ') || 'none'}`);
  }

  const detailsBudget = reserveGooglePlacesBudget('details');
  if (!detailsBudget.ok) throw new Error(detailsBudget.message);

  const url = new URL(`${detailsBaseUrl}/${encodeURIComponent(placeId.replace(/^places\//, ''))}`);
  url.searchParams.set('languageCode', 'en');
  const details = await fetchGoogleJson(url.toString(), {
    method: 'GET',
    headers: googleHeaders('id,displayName,formattedAddress,location,googleMapsUri'),
  });

  const resolvedId = safeString(details?.id) || placeId.replace(/^places\//, '');
  const formattedAddress = safeString(details?.formattedAddress);
  const latitude = details?.location?.latitude;
  const longitude = details?.location?.longitude;
  if (!resolvedId || !formattedAddress || typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error(`Google Places returned incomplete provider data for ${entry.key}.`);
  }

  return {
    googlePlaceId: resolvedId,
    googlePlaceName: pickText(details?.displayName) || entry.copy.en.title,
    formattedAddress,
    googleMapsUri: safeString(details?.googleMapsUri) || null,
    latitude,
    longitude,
  };
}

async function upsertLibraryPlace(entry: HellowhenPlaceLibrarySeedEntry) {
  const resolved = await resolveGooglePlace(entry);
  const seed = `hellowhen-library:${HELLOWHEN_PLACE_LIBRARY_PACK}:${entry.key}`;
  const existing = await prisma.place.findFirst({
    where: {
      source: PlaceSource.hellowhen_library,
      OR: [
        { googlePlaceId: resolved.googlePlaceId },
        { title: entry.copy.en.title },
      ],
    },
    select: { id: true },
  });

  const data = {
    ownerId: null,
    source: PlaceSource.hellowhen_library,
    status: PlaceStatus.active,
    visibility: PlaceVisibility.library,
    mode: PlanPlaceMode.local,
    title: entry.copy.en.title,
    description: entry.copy.en.description,
    defaultLanguage: 'en',
    category: entry.category,
    tags: Array.from(new Set([...entry.tags, 'popular'])),
    areaLabel: entry.areaLabel,
    addressPublicText: resolved.formattedAddress,
    addressPrivateText: null,
    googlePlaceId: resolved.googlePlaceId,
    googlePlaceName: resolved.googlePlaceName,
    formattedAddress: resolved.formattedAddress,
    googleMapsUri: resolved.googleMapsUri,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    locationSource: PlaceLocationSource.google_places,
    addressValidationStatus: PlaceAddressValidationStatus.confirmed,
    onlineLabel: null,
    onlineUrl: null,
    defaultDurationMinutes: entry.defaultDurationMinutes,
    defaultNote: null,
    defaultMeetingInstructions: null,
    staticMapTemplateFamily: placeStaticMapTemplateFamilyForSeed(seed),
    staticMapTemplateSeed: seed,
    archivedAt: null,
  };

  const place = await prisma.$transaction(async (tx) => {
    const stored = existing
      ? await tx.place.update({ where: { id: existing.id }, data })
      : await tx.place.create({ data });

    for (const languageCode of ['fr', 'es'] as const) {
      const copy = entry.copy[languageCode];
      await tx.inventoryTranslation.upsert({
        where: {
          targetType_targetId_languageCode: {
            targetType: InventoryTranslationTargetType.place,
            targetId: stored.id,
            languageCode,
          },
        },
        update: { title: copy.title, description: copy.description },
        create: {
          targetType: InventoryTranslationTargetType.place,
          targetId: stored.id,
          languageCode,
          title: copy.title,
          description: copy.description,
          createdById: null,
        },
      });
    }

    return stored;
  });

  return { place, resolved, created: !existing };
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const onlyKeys = parseOnlyKeys(argv);
  const selected = onlyKeys
    ? hellowhenPlaceLibrarySeedEntries.filter((entry) => onlyKeys.has(entry.key))
    : hellowhenPlaceLibrarySeedEntries;

  if (onlyKeys) {
    const unknown = [...onlyKeys].filter((key) => !hellowhenPlaceLibrarySeedEntries.some((entry) => entry.key === key));
    if (unknown.length) throw new Error(`Unknown Hellowhen Place Library key(s): ${unknown.join(', ')}`);
  }
  if (!selected.length) throw new Error('No Hellowhen Place Library entries selected.');

  console.log(`Hellowhen Place Library pack: ${HELLOWHEN_PLACE_LIBRARY_PACK}`);
  console.log(`Selected ${selected.length} curated place(s): ${selected.map((entry) => entry.key).join(', ')}`);

  if (!apply) {
    console.log('Dry run only. No Google Places requests or database writes were made. Re-run with --apply to resolve provider data and upsert the library.');
    return;
  }

  if (!env.googleMapsServerApiKey) {
    throw new Error('GOOGLE_MAPS_SERVER_API_KEY (or GOOGLE_PLACES_SERVER_API_KEY) is required to seed provider-confirmed offline places.');
  }
  if (env.nodeEnv === 'production' && process.env.HELLOWHEN_PLACE_LIBRARY_ALLOW_PRODUCTION?.trim().toLowerCase() !== 'true') {
    throw new Error('Refusing to seed the production Place Library. Set HELLOWHEN_PLACE_LIBRARY_ALLOW_PRODUCTION=true only for the intended production run.');
  }

  let created = 0;
  let updated = 0;
  const failures: Array<{ key: string; message: string }> = [];

  for (const entry of selected) {
    try {
      const result = await upsertLibraryPlace(entry);
      if (result.created) created += 1;
      else updated += 1;
      console.log(`${result.created ? 'created' : 'updated'} ${entry.key}: ${result.place.title} -> ${result.resolved.formattedAddress}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ key: entry.key, message });
      console.error(`failed ${entry.key}: ${message}`);
    }
  }

  console.log(`Hellowhen Place Library seed complete: ${created} created, ${updated} updated, ${failures.length} failed.`);
  if (failures.length) {
    throw new Error(`Hellowhen Place Library seed finished with ${failures.length} failure(s): ${failures.map((failure) => failure.key).join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
