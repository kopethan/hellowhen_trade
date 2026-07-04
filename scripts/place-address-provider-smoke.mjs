#!/usr/bin/env node

const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const ownerEmail = process.env.PLACE_OWNER_EMAIL || process.env.PLAN_OWNER_EMAIL || 'demo@hellowhen.app';
const ownerPassword = process.env.PLACE_OWNER_PASSWORD || process.env.PLAN_OWNER_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'password123';
const expectPlansEnabled = (process.env.EXPECT_PLANS_ENABLED || 'false').toLowerCase() === 'true';
const expectGoogleEnabled = (process.env.EXPECT_GOOGLE_PLACES_ENABLED || 'false').toLowerCase() === 'true';
const smokeQuery = process.env.GOOGLE_PLACE_SMOKE_QUERY || 'Eiffel Tower';
const smokeCountry = process.env.GOOGLE_PLACE_SMOKE_COUNTRY || 'FR';
const smokeLanguage = process.env.GOOGLE_PLACE_SMOKE_LANGUAGE || 'en';

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function login(email, password) {
  const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (result.requiresTwoFactor) throw new Error(`${email} requires two-step verification. Use a demo user without 2FA for this smoke test.`);
  if (!result.accessToken || !result.user?.id) throw new Error(`${email} login did not return a user/session.`);
  return { token: result.accessToken, userId: result.user.id };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectPlansDisabled() {
  try {
    await request('/plans/feed');
    throw new Error('/plans/feed unexpectedly succeeded while Plans are expected to be disabled.');
  } catch (error) {
    if (error.body?.error === 'plans_disabled') {
      console.log('Plans disabled gate: PASS');
      return;
    }
    throw error;
  }
}

async function expectInvalidOfflineBlocked(token) {
  try {
    await request('/places', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        title: 'Invalid offline address smoke',
        description: 'This should be blocked because manual text is not a provider-selected address.',
        mode: 'local',
        visibility: 'private',
        addressPublicText: 'Manual text should not pass.',
      }),
    });
    throw new Error('Invalid offline Place unexpectedly saved without provider-selected address data.');
  } catch (error) {
    if (error.body?.error === 'missing_offline_provider_address') {
      console.log('Invalid offline Place create is blocked: PASS');
      return;
    }
    throw error;
  }
}

async function expectOnlinePlaceWorks(token, stamp) {
  const created = await request('/places', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      title: `Address policy online smoke ${stamp}`,
      description: 'This verifies online Places remain allowed without an offline address.',
      mode: 'remote',
      visibility: 'private',
      onlineLabel: 'Smoke video link',
      onlineUrl: `https://meet.example/address-policy-${encodeURIComponent(stamp)}`,
    }),
  });

  const placeId = created.place?.id;
  assert(placeId, 'Online Place creation did not return a place id.');
  assert(created.place?.mode === 'remote', 'Online Place should store remote mode.');
  assert(created.place?.onlineUrl?.startsWith('https://meet.example/'), 'Online Place should store onlineUrl.');

  await request(`/places/${placeId}`, { method: 'DELETE', headers: authHeaders(token) });
  console.log('Online Place create/archive without offline address: PASS');
}

async function checkGoogleProviderOptional(token) {
  try {
    const result = await request(`/places/google/search?q=${encodeURIComponent(smokeQuery)}&country=${encodeURIComponent(smokeCountry)}&languageCode=${encodeURIComponent(smokeLanguage)}&take=1`, {
      headers: authHeaders(token),
    });
    const count = Array.isArray(result.predictions) ? result.predictions.length : 0;
    console.log(`Google provider appears enabled and returned ${count} prediction(s). Set EXPECT_GOOGLE_PLACES_ENABLED=true to run Google-backed offline create checks.`);
  } catch (error) {
    if (['google_places_disabled', 'google_places_not_configured'].includes(error.body?.error)) {
      console.log(`Google provider unavailable state (${error.body.error}): PASS`);
      return;
    }
    throw error;
  }
}

async function resolveGooglePlace(token) {
  const search = await request(`/places/google/search?q=${encodeURIComponent(smokeQuery)}&country=${encodeURIComponent(smokeCountry)}&languageCode=${encodeURIComponent(smokeLanguage)}&take=1`, {
    headers: authHeaders(token),
  });
  const prediction = search.predictions?.[0];
  assert(prediction?.placeId, `Google Places search returned no prediction for ${smokeQuery}.`);

  const details = await request(`/places/google/details?placeId=${encodeURIComponent(prediction.placeId)}&languageCode=${encodeURIComponent(smokeLanguage)}`, {
    headers: authHeaders(token),
  });
  const place = details.place;
  assert(place?.source === 'google_places', 'Google details should return source=google_places.');
  assert(place?.placeId, 'Google details should include placeId.');
  assert(place?.formattedAddress, 'Google details should include formattedAddress.');
  assert(typeof place?.latitude === 'number', 'Google details should include latitude.');
  assert(typeof place?.longitude === 'number', 'Google details should include longitude.');
  assert(place?.validationStatus === 'confirmed', 'Google details should be confirmed when formatted address and coordinates are present.');
  console.log(`Google Places search/details resolved ${place.formattedAddress}: PASS`);
  return place;
}

function providerPlacePayload(place) {
  return {
    googlePlaceId: place.placeId,
    googlePlaceName: place.name || undefined,
    formattedAddress: place.formattedAddress,
    googleMapsUri: place.googleMapsUri || undefined,
    latitude: place.latitude,
    longitude: place.longitude,
    locationSource: 'google_places',
    addressValidationStatus: 'confirmed',
  };
}

async function expectProviderOfflinePlaceWorks(token, stamp, place) {
  const created = await request('/places', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      title: `Address policy offline smoke ${stamp}`,
      description: 'This verifies provider-selected offline Places are accepted.',
      mode: 'local',
      visibility: 'private',
      addressPublicText: place.formattedAddress,
      ...providerPlacePayload(place),
    }),
  });

  const placeId = created.place?.id;
  assert(placeId, 'Provider-backed offline Place creation did not return a place id.');
  assert(created.place?.mode === 'local', 'Provider-backed Place should store local mode.');
  assert(created.place?.googlePlaceId === place.placeId, 'Provider-backed Place should store googlePlaceId.');
  assert(created.place?.locationSource === 'google_places', 'Provider-backed Place should store locationSource=google_places.');
  assert(created.place?.addressValidationStatus === 'confirmed', 'Provider-backed Place should store confirmed validation status.');

  await request(`/places/${placeId}`, { method: 'DELETE', headers: authHeaders(token) });
  console.log('Provider-backed offline Place create/archive: PASS');
}

async function expectProviderPlanPlaceWorks(token, stamp, place) {
  const start = new Date(Date.now() + 36 * 60 * 60 * 1000);
  start.setHours(13, 0, 0, 0);
  const startsAt = start.toISOString();
  const endsAt = new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const created = await request('/plans', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      title: `Address policy Plan smoke ${stamp}`,
      description: 'Internal smoke test for provider-selected offline Plan stops.',
      category: 'Smoke test',
      mode: 'local',
      startsAt,
      endsAt,
      joinApprovalMode: 'automatic',
      status: 'open',
      places: [
        {
          mode: 'local',
          title: 'Provider-backed meeting place',
          note: 'This stop verifies provider-selected offline PlanPlace validation.',
          addressPublicText: place.formattedAddress,
          startsAt,
          order: 0,
          ...providerPlacePayload(place),
        },
      ],
    }),
  });

  const planId = created.plan?.id;
  assert(planId, 'Provider-backed Plan creation did not return a plan id.');
  const firstPlace = created.plan?.places?.[0];
  assert(firstPlace?.mode === 'local', 'Provider-backed Plan stop should store local mode.');
  assert(firstPlace?.googlePlaceId === place.placeId, 'Provider-backed Plan stop should store googlePlaceId.');
  assert(firstPlace?.locationSource === 'google_places', 'Provider-backed Plan stop should store locationSource=google_places.');
  assert(firstPlace?.addressValidationStatus === 'confirmed', 'Provider-backed Plan stop should store confirmed validation status.');

  await request(`/plans/${planId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'cancelled' }),
  });
  console.log('Provider-backed offline Plan create/cancel: PASS');
}

async function runEnabledSmoke() {
  const owner = await login(ownerEmail, ownerPassword);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  await expectInvalidOfflineBlocked(owner.token);
  await expectOnlinePlaceWorks(owner.token, stamp);

  if (!expectGoogleEnabled) {
    await checkGoogleProviderOptional(owner.token);
    console.log('Set EXPECT_GOOGLE_PLACES_ENABLED=true with GOOGLE_PLACES_ENABLED=true and GOOGLE_MAPS_SERVER_API_KEY set to run Google-backed offline create checks.');
    return;
  }

  const place = await resolveGooglePlace(owner.token);
  await expectProviderOfflinePlaceWorks(owner.token, stamp, place);
  await expectProviderPlanPlaceWorks(owner.token, stamp, place);
}

async function main() {
  console.log(`Place address provider smoke: ${apiBase}`);
  if (!expectPlansEnabled) {
    await expectPlansDisabled();
    console.log('Set EXPECT_PLANS_ENABLED=true with PLANS_ENABLED=true on the API to run address validation smoke checks.');
    return;
  }

  await runEnabledSmoke();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error?.body) console.error(JSON.stringify(error.body, null, 2));
  process.exitCode = 1;
});
