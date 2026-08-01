import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canUseReusablePlaceInPlan,
  countOwnedPlanUsageByPlace,
  planPlaceSourceForOwner,
} from '../placeOwnershipPolicy.js';

test('plans can directly reference only their owner places or Hellowhen library places', () => {
  assert.equal(canUseReusablePlaceInPlan({ source: 'user', ownerId: 'user-a', visibility: 'private' }, 'user-a'), true);
  assert.equal(canUseReusablePlaceInPlan({ source: 'user', ownerId: 'user-a', visibility: 'public' }, 'user-b'), false);
  assert.equal(canUseReusablePlaceInPlan({ source: 'hellowhen_library', ownerId: null, visibility: 'library' }, 'user-b'), true);
});

test('legacy cross-owner references are not labelled as My Place', () => {
  assert.equal(planPlaceSourceForOwner({ placeId: 'place-a', sourcePlace: { source: 'user', ownerId: 'user-a' } }, 'user-a'), 'my_place');
  assert.equal(planPlaceSourceForOwner({ placeId: 'place-a', sourcePlace: { source: 'user', ownerId: 'user-a' } }, 'user-b'), 'custom');
  assert.equal(planPlaceSourceForOwner({ placeId: 'library-a', sourcePlace: { source: 'hellowhen_library', visibility: 'library' } }, 'user-b'), 'hellowhen_library');
});

test('user Place usage counts only distinct non-deleted Plans owned by that Place owner', () => {
  const counts = countOwnedPlanUsageByPlace(
    [{ id: 'place-a', source: 'user', ownerId: 'user-a' }],
    [
      { placeId: 'place-a', planId: 'plan-a', plan: { ownerId: 'user-a', deletedAt: null } },
      { placeId: 'place-a', planId: 'plan-a', plan: { ownerId: 'user-a', deletedAt: null } },
      { placeId: 'place-a', planId: 'plan-b', plan: { ownerId: 'user-b', deletedAt: null } },
      { placeId: 'place-a', planId: 'plan-deleted', plan: { ownerId: 'user-a', deletedAt: new Date() } },
    ],
  );

  assert.equal(counts.get('place-a'), 1);
});

test('library Place usage remains global while still counting distinct non-deleted Plans', () => {
  const counts = countOwnedPlanUsageByPlace(
    [{ id: 'library-a', source: 'hellowhen_library', ownerId: null, visibility: 'library' }],
    [
      { placeId: 'library-a', planId: 'plan-a', plan: { ownerId: 'user-a', deletedAt: null } },
      { placeId: 'library-a', planId: 'plan-b', plan: { ownerId: 'user-b', deletedAt: null } },
      { placeId: 'library-a', planId: 'plan-b', plan: { ownerId: 'user-b', deletedAt: null } },
    ],
  );

  assert.equal(counts.get('library-a'), 2);
});
