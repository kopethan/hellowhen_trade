import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
  ACCOUNT_DELETION_GRACE_PERIOD_MS,
  ACCOUNT_DELETION_PROCESS_INTERVAL_MS,
  ACCOUNT_DELETION_TEST_PROCESS_INTERVAL_MS,
  accountDeletionGracePeriodMs,
  accountDeletionProcessIntervalMs,
  accountDeletionScheduledFor,
  assertAccountDeletionRuntimeConfigSafe,
  isAccountDeletionDue,
} from '../accountDeletion.lifecycle.js';

const productionEnv = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
const developmentEnv = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;

test('production account deletion is scheduled exactly 30 days after the request', () => {
  const requestedAt = new Date('2026-09-09T08:00:00.000Z');
  const scheduledFor = accountDeletionScheduledFor(requestedAt, productionEnv);
  assert.equal(ACCOUNT_DELETION_GRACE_PERIOD_DAYS, 30);
  assert.equal(accountDeletionGracePeriodMs(productionEnv), ACCOUNT_DELETION_GRACE_PERIOD_MS);
  assert.equal(scheduledFor.getTime() - requestedAt.getTime(), ACCOUNT_DELETION_GRACE_PERIOD_MS);
  assert.equal(scheduledFor.toISOString(), '2026-10-09T08:00:00.000Z');
});

test('non-production can accelerate deletion with a bounded minute override', () => {
  const requestedAt = new Date('2026-09-09T08:00:00.000Z');
  const runtimeEnv = { NODE_ENV: 'development', ACCOUNT_DELETE_TEST_GRACE_MINUTES: '2' } as NodeJS.ProcessEnv;
  assert.equal(accountDeletionGracePeriodMs(runtimeEnv), 2 * 60 * 1000);
  assert.equal(accountDeletionScheduledFor(requestedAt, runtimeEnv).toISOString(), '2026-09-09T08:02:00.000Z');
  assert.equal(accountDeletionProcessIntervalMs(runtimeEnv), ACCOUNT_DELETION_TEST_PROCESS_INTERVAL_MS);
});

test('production refuses to start with the accelerated deletion override', () => {
  const runtimeEnv = { NODE_ENV: 'production', ACCOUNT_DELETE_TEST_GRACE_MINUTES: '2' } as NodeJS.ProcessEnv;
  assert.throws(
    () => assertAccountDeletionRuntimeConfigSafe(runtimeEnv),
    /test-only and must not be set when NODE_ENV=production/,
  );
});

test('invalid accelerated deletion values fail fast outside production', () => {
  for (const value of ['0', '-1', '1.5', '61', 'abc']) {
    const runtimeEnv = { NODE_ENV: 'development', ACCOUNT_DELETE_TEST_GRACE_MINUTES: value } as NodeJS.ProcessEnv;
    assert.throws(() => accountDeletionGracePeriodMs(runtimeEnv), /must be an integer from 1 to 60/, value);
  }
});

test('normal non-production lifecycle keeps the production grace period and polling cadence without an override', () => {
  assert.equal(accountDeletionGracePeriodMs(developmentEnv), ACCOUNT_DELETION_GRACE_PERIOD_MS);
  assert.equal(accountDeletionProcessIntervalMs(developmentEnv), ACCOUNT_DELETION_PROCESS_INTERVAL_MS);
});

test('requested and in-review deletions become due only at the scheduled instant', () => {
  const scheduledFor = '2026-10-09T08:00:00.000Z';
  assert.equal(isAccountDeletionDue({ status: 'requested', scheduledFor }, new Date('2026-10-09T07:59:59.999Z')), false);
  assert.equal(isAccountDeletionDue({ status: 'requested', scheduledFor }, new Date(scheduledFor)), true);
  assert.equal(isAccountDeletionDue({ status: 'in_review', scheduledFor }, new Date('2026-10-09T08:00:00.001Z')), true);
});

test('cancelled, processing, completed, and rejected requests are not claimed as due', () => {
  const scheduledFor = '2026-09-01T00:00:00.000Z';
  const now = new Date('2026-10-09T08:00:00.000Z');
  for (const status of ['cancelled', 'processing', 'completed', 'rejected']) {
    assert.equal(isAccountDeletionDue({ status, scheduledFor }, now), false, status);
  }
});
