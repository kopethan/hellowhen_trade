import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const allowRemote = (process.env.ACCOUNT_DELETE_ALLOW_REMOTE_SMOKE || 'false').toLowerCase() === 'true';
const testGraceMinutes = Number(process.env.ACCOUNT_DELETE_TEST_GRACE_MINUTES || '');
const apiUrl = new URL(apiBase);
const isLocalApi = ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (!isLocalApi && !allowRemote) {
  throw new Error('Accelerated account-deletion smoke refuses to target a non-local API. Set ACCOUNT_DELETE_ALLOW_REMOTE_SMOKE=true only for an intentional disposable QA environment.');
}
if (!Number.isInteger(testGraceMinutes) || testGraceMinutes < 1 || testGraceMinutes > 60) {
  throw new Error('Set ACCOUNT_DELETE_TEST_GRACE_MINUTES to an integer from 1 to 60 before running the accelerated deletion smoke.');
}
if ((process.env.NODE_ENV || 'development').toLowerCase() === 'production') {
  throw new Error('Accelerated account-deletion smoke must never run with NODE_ENV=production.');
}

async function request(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
  }
  return { response, body };
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

async function register(email, password) {
  const { response, body } = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      confirmPassword: password,
      displayName: 'Deletion Smoke',
      countryCode: 'FR',
      preferredCurrency: 'eur',
      acceptedTerms: true,
      ageConfirmed: true,
      declaredAgeBucket: '18_plus',
    }),
  });
  assert(response.status === 201, `Smoke account registration failed (${response.status}): ${JSON.stringify(body)}`);
  assert(body?.accessToken, 'Smoke account registration did not return an access token.');
  return body;
}

async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function createDeletion(token) {
  const before = Date.now();
  const { response, body } = await request('/account/deletion-request', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason: 'other', details: 'Accelerated deletion lifecycle smoke test.' }),
  });
  assert(response.status === 201, `Deletion request failed (${response.status}): ${JSON.stringify(body)}`);
  const scheduledMs = Date.parse(body?.request?.scheduledFor || '');
  assert(Number.isFinite(scheduledMs), 'Deletion request did not return a valid scheduledFor timestamp.');
  const expectedDelayMs = testGraceMinutes * 60 * 1000;
  const actualDelayMs = scheduledMs - before;
  assert(
    actualDelayMs >= expectedDelayMs - 5_000 && actualDelayMs <= expectedDelayMs + 15_000,
    `API is not using the accelerated grace period. Expected about ${testGraceMinutes} minute(s), got ${Math.round(actualDelayMs / 1000)} seconds. Restart the API with ACCOUNT_DELETE_TEST_GRACE_MINUTES=${testGraceMinutes}.`,
  );
  return body.request;
}

async function waitUntil(timestampMs) {
  const remaining = timestampMs - Date.now();
  if (remaining > 0) {
    console.log(`Waiting ${Math.ceil(remaining / 1000)} second(s) for the accelerated deletion deadline...`);
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  await new Promise((resolve) => setTimeout(resolve, 1_500));
}

function processDueNow() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'account-deletion:process-due'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  assert(result.status === 0, `account-deletion:process-due exited with code ${result.status}.`);
}

async function main() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `account-delete-smoke-${stamp}@example.com`;
  const password = `Smoke-${stamp}!`;

  console.log(`Accelerated account deletion smoke: ${apiBase}`);
  console.log(`Disposable smoke account: ${email}`);

  const registered = await register(email, password);

  const first = await createDeletion(registered.accessToken);
  const cancelled = await request('/account/deletion-request/cancel', {
    method: 'PATCH',
    headers: authHeaders(registered.accessToken),
    body: JSON.stringify({}),
  });
  assert(cancelled.response.status === 200, `Deletion cancellation failed (${cancelled.response.status}): ${JSON.stringify(cancelled.body)}`);
  assert(cancelled.body?.request?.status === 'cancelled', 'Cancelled deletion request did not return cancelled status.');

  const afterCancelLogin = await login(email, password);
  assert(afterCancelLogin.response.status === 200, 'Smoke account could not log in after cancelling deletion.');
  assert(afterCancelLogin.body?.accessToken, 'Login after cancellation did not return an access token.');
  console.log('Request -> cancel -> account survives: PASS');

  const second = await createDeletion(afterCancelLogin.body.accessToken);
  await waitUntil(Date.parse(second.scheduledFor));
  processDueNow();

  const afterDeletionLogin = await login(email, password);
  assert(afterDeletionLogin.response.status === 401, `Deleted smoke account unexpectedly logged in (${afterDeletionLogin.response.status}).`);
  assert(afterDeletionLogin.body?.error === 'invalid_credentials', `Expected invalid_credentials after deletion, got ${JSON.stringify(afterDeletionLogin.body)}.`);
  console.log('Request -> due sweep -> login removed: PASS');
  console.log(`Accelerated ${testGraceMinutes}-minute account deletion lifecycle: PASS`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
