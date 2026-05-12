#!/usr/bin/env node

const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const email = process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@hellowhen.app';
const password = process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'password123';

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || body?.error || `${response.status} ${response.statusText}`;
    throw new Error(`${path}: ${message}`);
  }
  return body;
}

async function main() {
  console.log(`Admin launch smoke: ${apiBase}`);
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (login.requiresTwoFactor) {
    throw new Error('Admin login requires two-step verification. Use the /admin browser flow after enabling 2FA, or disable ADMIN_REQUIRE_TWO_FACTOR only for local smoke tests.');
  }

  const token = login.accessToken;
  if (!token) throw new Error('Login did not return an access token.');
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [overview, smoke, checklist, runtimeQa] = await Promise.all([
    request('/admin/overview', { headers: authHeaders }),
    request('/admin/moderation-smoke', { headers: authHeaders }),
    request('/admin/launch-checklist', { headers: authHeaders }),
    request('/admin/runtime-qa', { headers: authHeaders }),
  ]);

  const leakCount = smoke.counts.feedEligibleRestrictedOwnerTrades + smoke.counts.feedEligibleClosedNeedTrades + smoke.counts.feedEligibleClosedOfferTrades;
  console.log(`Users: ${overview.summary.users.total} total, ${overview.summary.users.restricted} restricted`);
  console.log(`Reports: ${overview.summary.reports.pending} pending, ${overview.summary.reports.reviewing} reviewing`);
  console.log(`Support: ${overview.summary.support.open} open, ${overview.summary.support.urgent} urgent/high`);
  console.log(`Moderation smoke leaks: ${leakCount}`);
  console.log(`Launch checklist: ${checklist.overallStatus} (${checklist.summary.pass} pass, ${checklist.summary.warning} warning, ${checklist.summary.fail} fail)`);
  console.log(`Runtime QA: ${runtimeQa.overallStatus} (${runtimeQa.summary.pass} pass, ${runtimeQa.summary.warning} warning, ${runtimeQa.summary.fail} fail)`);
  console.log(`Restricted open sessions: ${runtimeQa.counts.restrictedUsersWithOpenSessions}`);

  if (leakCount > 0 || checklist.overallStatus === 'fail' || runtimeQa.overallStatus === 'fail') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
