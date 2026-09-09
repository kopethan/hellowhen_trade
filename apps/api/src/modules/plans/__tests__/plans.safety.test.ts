import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_PLAN_TIME_STATUSES,
  canReadPlan,
  findStopGapViolation,
  isRemoveIdempotent,
  isCancelOnlyUpdate,
  canOwnerEditPublishedPlan,
  rangesConflictWithRequiredGap,
  restoredPlanStatus,
} from '../plans.safety.testkit.js';
import { buildGeneratedPlanDisplay, isPlanJoinClosed, stripLegacyGeneratedPlanStartTime } from '@hellowhen/shared';
import { normalizedPlanLifecycleStatus } from '../plans.lifecycle.js';

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

test('owners can edit only future open Plans before any participant interaction', () => {
  const now = at(10);
  assert.equal(canOwnerEditPublishedPlan({ status: 'open', startsAt: at(12), participants: [] }, now), true);
  assert.equal(canOwnerEditPublishedPlan({ status: 'open', startsAt: at(12), participants: [{ status: 'pending' }] }, now), false);
  assert.equal(canOwnerEditPublishedPlan({ status: 'open', startsAt: at(12), participants: [{ status: 'left' }] }, now), false);
  assert.equal(canOwnerEditPublishedPlan({ status: 'started', startsAt: at(9), participants: [] }, now), false);
  assert.equal(canOwnerEditPublishedPlan({ status: 'open', startsAt: at(10), participants: [] }, now), false);
  assert.equal(canOwnerEditPublishedPlan({ status: 'open', startsAt: at(12), participants: [], deletedAt: new Date() }, now), false);
});

test('legacy deleted plans are hidden from public and owner detail access', () => {
  const deleted = { status: 'cancelled', deletedAt: new Date() };
  assert.equal(canReadPlan(deleted, false), false);
  assert.equal(canReadPlan(deleted, true), false);
});

test('removed plans are private to the owner and are not public', () => {
  const removed = { status: 'cancelled', deletedAt: null };
  assert.equal(canReadPlan(removed, true), true);
  assert.equal(canReadPlan(removed, false), false);
});

test('remove is idempotent for already removed and legacy deleted plans', () => {
  assert.equal(isRemoveIdempotent({ status: 'cancelled', deletedAt: null }), true);
  assert.equal(isRemoveIdempotent({ status: 'hidden', deletedAt: new Date() }), true);
  assert.equal(isRemoveIdempotent({ status: 'open', deletedAt: null }), false);
});

test('restore recalculates public status from date and capacity eligibility', () => {
  assert.equal(restoredPlanStatus({ startsAt: at(12), endsAt: at(13), maxParticipants: 2, acceptedCount: 0 }, at(10)), 'open');
  assert.equal(restoredPlanStatus({ startsAt: at(12), endsAt: at(13), maxParticipants: 2, acceptedCount: 2 }, at(10)), 'full');
  assert.equal(restoredPlanStatus({ startsAt: at(10), endsAt: at(13) }, at(11)), 'started');
  assert.equal(restoredPlanStatus({ startsAt: at(10), endsAt: at(11) }, at(11)), null);
});


test('plan lifecycle starts exactly at startsAt and completes exactly at endsAt', () => {
  const plan = { status: 'open', startsAt: at(10), endsAt: at(11) };
  assert.equal(normalizedPlanLifecycleStatus(plan, at(9, 59)), 'open');
  assert.equal(normalizedPlanLifecycleStatus(plan, at(10)), 'started');
  assert.equal(normalizedPlanLifecycleStatus(plan, at(10, 30)), 'started');
  assert.equal(normalizedPlanLifecycleStatus(plan, at(11)), 'completed');
});

test('full plans become started when their scheduled time begins', () => {
  const plan = { status: 'full', startsAt: at(10), endsAt: at(11) };
  assert.equal(normalizedPlanLifecycleStatus(plan, at(9, 59)), 'full');
  assert.equal(normalizedPlanLifecycleStatus(plan, at(10)), 'started');
});

test('legacy plans without an end time complete at their start time', () => {
  const plan = { status: 'open', startsAt: at(10), endsAt: null };
  assert.equal(normalizedPlanLifecycleStatus(plan, at(9, 59)), 'open');
  assert.equal(normalizedPlanLifecycleStatus(plan, at(10)), 'completed');
});

test('terminal and non-public lifecycle statuses are not rewritten by time', () => {
  assert.equal(normalizedPlanLifecycleStatus({ status: 'completed', startsAt: at(10), endsAt: at(11) }, at(12)), 'completed');
  assert.equal(normalizedPlanLifecycleStatus({ status: 'cancelled', startsAt: at(10), endsAt: at(11) }, at(12)), 'cancelled');
  assert.equal(normalizedPlanLifecycleStatus({ status: 'hidden', startsAt: at(10), endsAt: at(11) }, at(12)), 'hidden');
  assert.equal(normalizedPlanLifecycleStatus({ status: 'draft', startsAt: at(10), endsAt: at(11) }, at(12)), 'draft');
});

test('owners can read non-public drafts while public viewers cannot', () => {
  const draft = { status: 'draft', deletedAt: null };
  assert.equal(canReadPlan(draft, true), true);
  assert.equal(canReadPlan(draft, false), false);
});

test('Plan join deadline is still open only while its effective deadline is in the future', () => {
  assert.equal(isPlanJoinClosed({ startsAt: at(12) }, at(11, 59)), false);
  assert.equal(isPlanJoinClosed({ startsAt: at(12) }, at(12)), true);
  assert.equal(isPlanJoinClosed({ startsAt: at(14), joinClosesAt: at(13) }, at(12, 59)), false);
  assert.equal(isPlanJoinClosed({ startsAt: at(14), joinClosesAt: at(13) }, at(13)), true);
});

test('generated Plan descriptions never persist viewer-formatted start times', () => {
  const display = buildGeneratedPlanDisplay({
    places: [{ title: 'Jardins du Trocadéro', mode: 'local' }],
    startsAt: '2026-01-01T13:00:00.000Z',
    mode: 'local',
    joinApprovalMode: 'automatic',
  });

  assert.deepEqual(display.summaryParts, ['1 place', 'Local plan', 'Free join']);
  assert.equal(display.description, '1 place · Local plan · Free join');
  assert.equal(display.description.includes('13:00'), false);
  assert.equal(display.description.includes('Starts'), false);
});

test('generated Plan descriptions call mixed Place/custom-stop routes stops', () => {
  const display = buildGeneratedPlanDisplay({
    places: [
      { kind: 'place', title: 'Pont Alexandre III', mode: 'local' },
      { kind: 'pause', title: 'Pause', mode: 'local' },
      { kind: 'place', title: 'Parc des Buttes-Chaumont', mode: 'local' },
    ],
    mode: 'local',
    joinApprovalMode: 'automatic',
  });

  assert.equal(display.title, 'Pont Alexandre III → Parc des Buttes-Chaumont');
  assert.deepEqual(display.summaryParts, ['3 stops', 'Local plan', 'Free join']);
});

test('legacy generated Plan descriptions drop only the frozen start-time segment', () => {
  assert.equal(
    stripLegacyGeneratedPlanStartTime('1 place · Starts Jan 1, 1:00 PM · Local plan · Free join'),
    '1 place · Local plan · Free join',
  );
  assert.equal(
    stripLegacyGeneratedPlanStartTime('2 places · Starts 1 Jan, 13:00 · Mixed plan'),
    '2 places · Mixed plan',
  );
  assert.equal(
    stripLegacyGeneratedPlanStartTime('Meet by the fountain · Starts after lunch · Bring a jacket'),
    'Meet by the fountain · Starts after lunch · Bring a jacket',
  );
});
