import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_PLAN_TIME_STATUSES,
  canReadPlan,
  findStopGapViolation,
  isCancelOnlyUpdate,
  rangesConflictWithRequiredGap,
} from '../plans.safety.testkit.js';

const at = (hour: number, minute = 0) => `2026-07-20T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;

test('active plans reserve the required one-hour scheduling gap', () => {
  assert.equal(rangesConflictWithRequiredGap({ startsAt: at(10), endsAt: at(11) }, { startsAt: at(12), endsAt: at(13) }), true);
  assert.equal(rangesConflictWithRequiredGap({ startsAt: at(10), endsAt: at(11) }, { startsAt: at(12, 1), endsAt: at(13) }), false);
});

test('only active statuses participate in owned-plan conflict checks', () => {
  assert.deepEqual(ACTIVE_PLAN_TIME_STATUSES, ['draft', 'open', 'full', 'started']);
  assert.equal(ACTIVE_PLAN_TIME_STATUSES.includes('cancelled' as never), false);
  assert.equal(ACTIVE_PLAN_TIME_STATUSES.includes('deleted' as never), false);
});

test('cancelled and deleted plans do not block future scheduling', () => {
  const blockingStatuses = new Set(ACTIVE_PLAN_TIME_STATUSES);
  assert.equal(blockingStatuses.has('cancelled' as never), false);
  assert.equal(blockingStatuses.has('deleted' as never), false);
});

test('stop starts less than 15 minutes apart are rejected', () => {
  assert.deepEqual(findStopGapViolation({ startsAt: at(10), places: [{ startsAt: at(10) }, { startsAt: at(10, 14) }] }), { previousIndex: 0, currentIndex: 1 });
});

test('exactly 15 minutes between stop starts is accepted', () => {
  assert.equal(findStopGapViolation({ startsAt: at(10), places: [{ startsAt: at(10) }, { startsAt: at(10, 15) }] }), null);
});

test('created plan content remains immutable while cancellation is allowed', () => {
  assert.equal(isCancelOnlyUpdate({ status: 'cancelled' }), true);
  assert.equal(isCancelOnlyUpdate({ title: 'Changed' }), false);
  assert.equal(isCancelOnlyUpdate({ status: 'cancelled', title: 'Changed' }), false);
  assert.equal(isCancelOnlyUpdate({ places: [] }), false);
});

test('deleted plans are hidden from public and owner detail access', () => {
  const deleted = { status: 'cancelled', deletedAt: new Date() };
  assert.equal(canReadPlan(deleted, false), false);
  assert.equal(canReadPlan(deleted, true), false);
});

test('owners can read non-public drafts while public viewers cannot', () => {
  const draft = { status: 'draft', deletedAt: null };
  assert.equal(canReadPlan(draft, true), true);
  assert.equal(canReadPlan(draft, false), false);
});
