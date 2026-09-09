import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
  ACCOUNT_DELETION_GRACE_PERIOD_MS,
  accountDeletionScheduledFor,
  isAccountDeletionDue,
} from '../accountDeletion.lifecycle.js';

test('account deletion is scheduled exactly 30 days after the request', () => {
  const requestedAt = new Date('2026-09-09T08:00:00.000Z');
  const scheduledFor = accountDeletionScheduledFor(requestedAt);
  assert.equal(ACCOUNT_DELETION_GRACE_PERIOD_DAYS, 30);
  assert.equal(scheduledFor.getTime() - requestedAt.getTime(), ACCOUNT_DELETION_GRACE_PERIOD_MS);
  assert.equal(scheduledFor.toISOString(), '2026-10-09T08:00:00.000Z');
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
