#!/usr/bin/env node

const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const ownerEmail = process.env.PLAN_OWNER_EMAIL || 'demo@hellowhen.app';
const helperEmail = process.env.PLAN_HELPER_EMAIL || 'helper@hellowhen.app';
const ownerPassword = process.env.PLAN_OWNER_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'password123';
const helperPassword = process.env.PLAN_HELPER_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'password123';
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
  if (result.requiresTwoFactor) throw new Error(`${email} requires two-step verification. Use demo users without 2FA for this smoke test.`);
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

async function runEnabledSmoke() {
  const owner = await login(ownerEmail, ownerPassword);
  const helper = await login(helperEmail, helperPassword);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const firstStopDate = new Date(Date.now() + 36 * 60 * 60 * 1000);
  firstStopDate.setHours(13, 0, 0, 0);
  const firstStopAt = firstStopDate.toISOString();
  const secondStopDate = new Date(firstStopDate.getTime() + 2 * 60 * 60 * 1000);
  const secondStopAt = secondStopDate.toISOString();
  const remoteStopAt = new Date(firstStopDate.getTime() + 4 * 60 * 60 * 1000).toISOString();

  const created = await request('/plans', {
    method: 'POST',
    headers: authHeaders(owner.token),
    body: JSON.stringify({
      title: `Hidden Plans simplified smoke ${stamp}`,
      description: 'Internal smoke test for simplified hidden Plans instant join and place timeline.',
      category: 'Smoke test',
      mode: 'hybrid',
      startsAt: firstStopAt,
      endsAt: secondStopAt,
      joinApprovalMode: 'automatic',
      status: 'open',
      places: [
        {
          mode: 'remote',
          title: 'Opening video call',
          note: 'Meet and align before moving to the next stop.',
          onlineLabel: 'Smoke video link',
          onlineUrl: `https://meet.example/plan-opening-${encodeURIComponent(stamp)}`,
          startsAt: firstStopAt,
          order: 0,
        },
        {
          mode: 'remote',
          title: 'Second smoke stop',
          note: 'Second public note.',
          onlineLabel: 'Second smoke link',
          onlineUrl: `https://meet.example/plan-second-${encodeURIComponent(stamp)}`,
          startsAt: secondStopAt,
          order: 1,
        },
      ],
    }),
  });

  const planId = created.plan?.id;
  assert(planId, 'Plan creation did not return a plan id.');
  assert(created.plan.joinApprovalMode === 'automatic', 'Simplified Plans should default to automatic join.');
  assert(created.plan.status === 'open', 'Simplified Plans should be open after create.');
  assert(created.plan.places?.length === 2, 'Plan should include the created places.');
  assert(created.plan.places?.[0]?.mode === 'remote', 'First place should store remote mode.');
  assert(created.plan.places?.[1]?.mode === 'remote', 'Second place should store remote mode.');

  const publicPlan = await request(`/plans/${planId}`);
  assert(publicPlan.plan?.places?.[0]?.onlineUrl?.startsWith('https://meet.example/plan-opening-'), 'Anonymous viewer should see the public online destination.');

  const join = await request(`/plans/${planId}/join`, {
    method: 'POST',
    headers: authHeaders(helper.token),
    body: JSON.stringify({}),
  });
  assert(join.participant?.status === 'accepted', 'Simplified join should accept immediately.');

  const helperAfter = await request(`/plans/${planId}`, { headers: authHeaders(helper.token) });
  assert(helperAfter.plan?.myParticipantStatus === 'accepted', 'Helper should be accepted immediately after joining.');
  assert(helperAfter.plan?.participantCount === 1, 'Participant count should increase after instant join.');

  const joinedPlans = await request('/plans/joined', { headers: authHeaders(helper.token) });
  assert(joinedPlans.plans?.some((plan) => plan.id === planId), 'Joined plans should include the plan after free join.');

  await request(`/plans/${planId}`, {
    method: 'PATCH',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ title: `Hidden Plans edited ${stamp}`, mode: 'hybrid', endsAt: remoteStopAt, joinApprovalMode: 'automatic', maxParticipants: null, status: 'open', locationLabel: null }),
  });

  const firstPlaceId = helperAfter.plan?.places?.[0]?.id;
  assert(firstPlaceId, 'Created Plan should include a first place id.');

  await request(`/plans/${planId}/places/${firstPlaceId}`, {
    method: 'PATCH',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ mode: 'remote', onlineLabel: 'Edited smoke link', onlineUrl: `https://meet.example/plan-edited-${encodeURIComponent(stamp)}`, order: 1, startsAt: secondStopAt }),
  });

  await request(`/plans/${planId}/places`, {
    method: 'POST',
    headers: authHeaders(owner.token),
    body: JSON.stringify({
      mode: 'remote',
      title: 'Remote smoke stop',
      note: 'This stop verifies per-place remote mode and explicit date/time scheduling.',
      onlineLabel: 'Remote smoke link',
      onlineUrl: `https://meet.example/remote-smoke-${encodeURIComponent(stamp)}`,
      startsAt: remoteStopAt,
      order: 2,
    }),
  });

  const helperAfterEdit = await request(`/plans/${planId}`, { headers: authHeaders(helper.token) });
  assert(helperAfterEdit.plan?.title?.startsWith('Hidden Plans edited'), 'Owner should be able to edit Plan details.');
  assert(helperAfterEdit.plan?.places?.some((place) => place.onlineUrl?.startsWith('https://meet.example/plan-edited-')), 'Edited remote place URL should be visible.');
  assert(helperAfterEdit.plan?.places?.some((place) => place.title === 'Remote smoke stop' && place.mode === 'remote'), 'Owner should be able to add another remote place.');

  await request(`/plans/${planId}/leave`, {
    method: 'POST',
    headers: authHeaders(helper.token),
  });

  const ownerAfterLeave = await request(`/plans/${planId}`, { headers: authHeaders(owner.token) });
  assert(ownerAfterLeave.plan?.participantCount === 0, 'Participant count should drop when helper leaves.');

  await request(`/plans/${planId}`, {
    method: 'PATCH',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ status: 'cancelled' }),
  });

  console.log(`Created, instantly joined, edited, place-updated, left, and cancelled simplified Plan ${planId}: PASS`);
}

async function main() {
  console.log(`Hidden Plans smoke: ${apiBase}`);
  if (!expectEnabled) {
    await expectPlansDisabled();
    console.log('Set EXPECT_PLANS_ENABLED=true with PLANS_ENABLED=true on the API to run the full create/join smoke test.');
    return;
  }

  await runEnabledSmoke();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
