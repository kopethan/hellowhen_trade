#!/usr/bin/env node

const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const ownerEmail = process.env.PLACE_OWNER_EMAIL || 'demo@hellowhen.app';
const ownerPassword = process.env.PLACE_OWNER_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'password123';
const expectEnabled = (process.env.EXPECT_PLANS_ENABLED || 'false').toLowerCase() === 'true';

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

async function expectPlacesDisabled() {
  try {
    await request('/places/library');
    throw new Error('/places/library unexpectedly succeeded while Plans/Places are expected to be disabled.');
  } catch (error) {
    if (error.body?.error === 'plans_disabled') {
      console.log('Place Library disabled gate: PASS');
      return;
    }
    throw error;
  }
}

async function expectLibraryCreateBlocked(token) {
  try {
    await request('/places', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        source: 'hellowhen_library',
        title: 'Blocked normal-user library place',
        description: 'Normal users should not be able to create Hellowhen library places.',
      }),
    });
    throw new Error('Normal user unexpectedly created a Hellowhen library place.');
  } catch (error) {
    if (error.status === 403 && error.body?.error === 'library_place_admin_required') return;
    throw error;
  }
}

async function runEnabledSmoke() {
  const owner = await login(ownerEmail, ownerPassword);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const created = await request('/places', {
    method: 'POST',
    headers: authHeaders(owner.token),
    body: JSON.stringify({
      title: `Hidden Place Library smoke ${stamp}`,
      description: 'Internal smoke test for reusable My Places.',
      mode: 'local',
      visibility: 'private',
      areaLabel: 'Paris area',
      addressPublicText: 'Public meeting area',
      addressPrivateText: 'Private details only owner should see',
      defaultDurationMinutes: 60,
      defaultNote: 'Reusable place smoke note.',
      defaultMeetingInstructions: 'Owner-only smoke meeting instruction.',
    }),
  });

  const placeId = created.place?.id;
  assert(placeId, 'Place creation did not return a place id.');
  assert(created.place.source === 'user', 'Normal place should use user source.');
  assert(created.place.visibility === 'private', 'Normal place should keep private visibility.');
  assert(created.place.addressPrivateText, 'Owner response should include private address text.');

  const mine = await request('/places/mine', { headers: authHeaders(owner.token) });
  assert(mine.places?.some((place) => place.id === placeId), 'Created place should appear in /places/mine.');

  const updated = await request(`/places/${placeId}`, {
    method: 'PATCH',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ title: `Hidden Place Library edited ${stamp}`, visibility: 'public' }),
  });
  assert(updated.place?.title?.startsWith('Hidden Place Library edited'), 'Owner should be able to update their reusable place.');

  const publicPlace = await request(`/places/${placeId}`);
  assert(publicPlace.place?.id === placeId, 'Public active place should be readable after owner makes it public.');
  assert(publicPlace.place?.addressPrivateText === null, 'Anonymous place detail should hide private address text.');

  await expectLibraryCreateBlocked(owner.token);

  const archived = await request(`/places/${placeId}`, { method: 'DELETE', headers: authHeaders(owner.token) });
  assert(archived.place?.status === 'archived', 'DELETE should archive the reusable place.');

  console.log(`Created, listed, updated, public-read, admin-gated, and archived reusable Place ${placeId}: PASS`);
}

async function main() {
  console.log(`Hidden Place Library smoke: ${apiBase}`);
  if (!expectEnabled) {
    await expectPlacesDisabled();
    console.log('Set EXPECT_PLANS_ENABLED=true with PLANS_ENABLED=true on the API to run the full Place Library smoke test.');
    return;
  }

  await runEnabledSmoke();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
