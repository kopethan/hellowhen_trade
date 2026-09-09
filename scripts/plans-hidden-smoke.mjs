#!/usr/bin/env node

const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const ownerEmail = process.env.PLAN_OWNER_EMAIL || 'demo@hellowhen.app';
const helperEmail = process.env.PLAN_HELPER_EMAIL || 'helper@hellowhen.app';
const ownerPassword = process.env.PLAN_OWNER_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'password123';
const helperPassword = process.env.PLAN_HELPER_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'password123';
const expectEnabled = (process.env.EXPECT_PLANS_ENABLED ?? 'true').toLowerCase() === 'true';

const smokePlanTitlePrefixes = ['Hidden Plans simplified smoke ', 'Edited Plans smoke '];
const planConflictBlockingStatuses = new Set(['draft', 'open', 'full', 'started']);
const smokePlanMinimumLeadMs = 36 * 60 * 60 * 1000;
const smokePlanConflictBufferMs = 2 * 60 * 60 * 1000;

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

async function expectRequestError(path, options, expectedStatus, expectedCode, label) {
  try {
    await request(path, options);
    throw new Error(`${label} unexpectedly succeeded.`);
  } catch (error) {
    if (error.status === expectedStatus && error.body?.error === expectedCode) {
      console.log(`${label}: PASS`);
      return;
    }
    throw error;
  }
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

async function prepareSmokeSchedule(owner) {
  const mine = await request('/plans/mine', { headers: authHeaders(owner.token) });
  const plans = Array.isArray(mine.plans) ? mine.plans : [];
  const staleSmokePlans = plans.filter((plan) => (
    planConflictBlockingStatuses.has(plan.status)
    && smokePlanTitlePrefixes.some((prefix) => String(plan.title ?? '').startsWith(prefix))
  ));

  for (const plan of staleSmokePlans) {
    await request(`/plans/${plan.id}`, {
      method: 'PATCH',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ status: 'cancelled' }),
    });
  }
  if (staleSmokePlans.length > 0) {
    console.log(`Stale smoke Plan cleanup: PASS (${staleSmokePlans.length} cancelled)`);
  }

  const activeNonSmokePlans = plans.filter((plan) => (
    planConflictBlockingStatuses.has(plan.status)
    && !staleSmokePlans.some((stale) => stale.id === plan.id)
  ));
  const latestBlockingEndMs = activeNonSmokePlans.reduce((latest, plan) => {
    const endMs = Date.parse(plan.endsAt ?? plan.startsAt ?? '');
    return Number.isFinite(endMs) ? Math.max(latest, endMs) : latest;
  }, 0);
  const earliestStartMs = Date.now() + smokePlanMinimumLeadMs;
  const afterExistingPlansMs = latestBlockingEndMs > 0
    ? latestBlockingEndMs + smokePlanConflictBufferMs
    : 0;
  const firstStopMs = Math.ceil(Math.max(earliestStartMs, afterExistingPlansMs) / (60 * 60 * 1000)) * 60 * 60 * 1000;
  return new Date(firstStopMs);
}

async function runEnabledSmoke() {
  const owner = await login(ownerEmail, ownerPassword);
  const helper = await login(helperEmail, helperPassword);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const firstStopDate = await prepareSmokeSchedule(owner);
  const firstStopAt = firstStopDate.toISOString();
  const customStopAt = new Date(firstStopDate.getTime() + 60 * 60 * 1000).toISOString();
  const secondStopDate = new Date(firstStopDate.getTime() + 2 * 60 * 60 * 1000);
  const secondStopAt = secondStopDate.toISOString();
  const remoteStopAt = new Date(firstStopDate.getTime() + 4 * 60 * 60 * 1000).toISOString();

  const initialPlanPayload = {
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
        kind: 'pause',
        mode: 'local',
        title: 'Smoke pause',
        note: 'A custom non-location period should not require an address.',
        startsAt: customStopAt,
        order: 1,
      },
      {
        mode: 'remote',
        title: 'Second smoke stop',
        note: 'Second public note.',
        onlineLabel: 'Second smoke link',
        onlineUrl: `https://meet.example/plan-second-${encodeURIComponent(stamp)}`,
        startsAt: secondStopAt,
        order: 2,
      },
    ],
  };

  const created = await request('/plans', {
    method: 'POST',
    headers: authHeaders(owner.token),
    body: JSON.stringify(initialPlanPayload),
  });

  const planId = created.plan?.id;
  assert(planId, 'Plan creation did not return a plan id.');
  assert(created.plan.joinApprovalMode === 'automatic', 'Simplified Plans should default to automatic join.');
  assert(created.plan.status === 'open', 'Simplified Plans should be open after create.');
  assert(created.plan.places?.length === 3, 'Plan should include the created Places and custom stop.');
  assert(created.plan.places?.[0]?.mode === 'remote', 'First place should store remote mode.');
  assert(created.plan.places?.[1]?.kind === 'pause', 'Custom pause should persist its stop kind.');
  assert(!created.plan.places?.[1]?.formattedAddress, 'Custom pause should not require or persist an address.');
  assert(created.plan.places?.[2]?.mode === 'remote', 'Second real place should store remote mode.');
  assert(created.plan.ownerCanEdit === true, 'Owner should be able to edit a future Plan before participant interaction.');

  const editedTitle = `Edited Plans smoke ${stamp}`;
  const edited = await request(`/plans/${planId}`, {
    method: 'PUT',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ ...initialPlanPayload, title: editedTitle }),
  });
  assert(edited.plan?.title === editedTitle, 'Owner edit should update Plan details before anyone joins.');
  assert(edited.plan?.places?.length === 3, 'Owner edit should preserve the submitted route.');
  assert(edited.plan?.ownerCanEdit === true, 'Plan should remain editable until participant interaction begins.');
  console.log('Plan owner pre-join edit: PASS');

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

  const ownerAfterJoin = await request(`/plans/${planId}`, { headers: authHeaders(owner.token) });
  assert(ownerAfterJoin.plan?.ownerCanEdit === false, 'Owner edit should lock after the first participant interaction.');
  await expectRequestError(
    `/plans/${planId}`,
    {
      method: 'PUT',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ ...initialPlanPayload, title: `Blocked edit ${stamp}` }),
    },
    409,
    'plan_edit_locked',
    'Plan owner edit lock after join',
  );

  const joinedPlans = await request('/plans/joined', { headers: authHeaders(helper.token) });
  assert(joinedPlans.plans?.some((plan) => plan.id === planId), 'Joined plans should include the plan after free join.');

  assert(created.plan.joinClosesAt === firstStopAt, 'Default join deadline should match the Plan start.');

  const firstPlaceId = helperAfter.plan?.places?.[0]?.id;
  assert(firstPlaceId, 'Created Plan should include a first place id.');

  await expectRequestError(
    `/plans/${planId}`,
    {
      method: 'PATCH',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ title: `Locked Plan edit ${stamp}` }),
    },
    409,
    'plan_locked_after_creation',
    'Plan content lock',
  );

  await expectRequestError(
    `/plans/${planId}/places/${firstPlaceId}`,
    {
      method: 'PATCH',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ startsAt: secondStopAt }),
    },
    409,
    'plan_locked_after_creation',
    'Plan place edit lock',
  );

  await expectRequestError(
    `/plans/${planId}/places`,
    {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({
        mode: 'remote',
        title: 'Locked smoke stop',
        onlineLabel: 'Locked smoke link',
        onlineUrl: `https://meet.example/locked-smoke-${encodeURIComponent(stamp)}`,
        startsAt: remoteStopAt,
        order: 2,
      }),
    },
    409,
    'plan_locked_after_creation',
    'Plan place add lock',
  );

  await expectRequestError(
    `/plans/${planId}/places/${firstPlaceId}`,
    { method: 'DELETE', headers: authHeaders(owner.token) },
    409,
    'plan_locked_after_creation',
    'Plan place delete lock',
  );

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

  console.log(`Created, joined, lock-checked, left, and cancelled Plan ${planId}: PASS`);
}

async function main() {
  console.log(`Plans smoke: ${apiBase}`);
  if (!expectEnabled) {
    await expectPlansDisabled();
    console.log('Plans disabled gate was explicitly requested with EXPECT_PLANS_ENABLED=false.');
    return;
  }

  await runEnabledSmoke();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
