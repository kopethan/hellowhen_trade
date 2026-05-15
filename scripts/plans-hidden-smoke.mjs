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
  const startsAt = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();

  const created = await request('/plans', {
    method: 'POST',
    headers: authHeaders(owner.token),
    body: JSON.stringify({
      title: `Hidden Plans smoke ${stamp}`,
      description: 'Internal smoke test for hidden Plans join and private place visibility.',
      category: 'Smoke test',
      mode: 'local',
      locationLabel: 'Paris test area',
      startsAt,
      maxParticipants: 2,
      joinApprovalMode: 'owner_approval',
      status: 'open',
      places: [
        {
          title: 'Public meeting area',
          note: 'Public note visible before approval.',
          addressPublicText: 'Paris area only',
          addressPrivateText: 'Exact smoke-test meeting point',
          startsAt,
          order: 0,
        },
      ],
    }),
  });

  const planId = created.plan?.id;
  assert(planId, 'Plan creation did not return a plan id.');
  assert(created.plan.places?.[0]?.addressPrivateText === 'Exact smoke-test meeting point', 'Owner should see private place detail after create.');

  const publicPlan = await request(`/plans/${planId}`);
  assert(publicPlan.plan?.places?.[0]?.addressPrivateText === null, 'Anonymous viewer should not see private place detail.');

  const helperBefore = await request(`/plans/${planId}`, { headers: authHeaders(helper.token) });
  assert(helperBefore.plan?.places?.[0]?.addressPrivateText === null, 'Non-participant should not see private place detail.');

  const join = await request(`/plans/${planId}/join-requests`, {
    method: 'POST',
    headers: authHeaders(helper.token),
    body: JSON.stringify({ message: 'I can join this hidden smoke test.' }),
  });
  assert(join.participant?.status === 'pending', 'Join request should be pending by default.');

  const requests = await request(`/plans/${planId}/join-requests`, { headers: authHeaders(owner.token) });
  const pending = requests.participants?.find((participant) => participant.userId === helper.userId);
  assert(pending?.id, 'Owner should see helper pending request.');

  await request(`/plans/${planId}/join-requests/${pending.id}`, {
    method: 'PATCH',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ status: 'accepted' }),
  });

  const helperAfter = await request(`/plans/${planId}`, { headers: authHeaders(helper.token) });
  assert(helperAfter.plan?.myParticipantStatus === 'accepted', 'Helper should be accepted after owner approval.');
  assert(helperAfter.plan?.places?.[0]?.addressPrivateText === 'Exact smoke-test meeting point', 'Accepted participant should see private place detail.');

  await request(`/plans/${planId}`, {
    method: 'PATCH',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ status: 'cancelled' }),
  });

  console.log(`Created, joined, accepted, privacy-checked, and cancelled Plan ${planId}: PASS`);
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
