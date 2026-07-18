import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canUpdatePlaceLockedByPlan,
  isArchiveOnlyPlaceUpdate,
  isTranslationOnlyPlaceUpdate,
} from '../placeUpdatePolicy.js';

test('a locked Place can update manual translations only', () => {
  assert.equal(isTranslationOnlyPlaceUpdate({ translations: [] }), true);
  assert.equal(isTranslationOnlyPlaceUpdate({ translations: [{ languageCode: 'fr', title: 'Musée', description: 'Description' }] }), true);
  assert.equal(canUpdatePlaceLockedByPlan({ translations: [] }), true);
});

test('translation updates cannot include base Place changes', () => {
  assert.equal(isTranslationOnlyPlaceUpdate({ translations: [], title: 'Changed' }), false);
  assert.equal(isTranslationOnlyPlaceUpdate({ translations: [], mediaIds: [] }), false);
  assert.equal(isTranslationOnlyPlaceUpdate({ defaultLanguage: 'fr', translations: [] }), false);
  assert.equal(canUpdatePlaceLockedByPlan({ translations: [], addressPublicText: 'Changed' }), false);
});

test('archive-only updates remain allowed for locked Places', () => {
  assert.equal(isArchiveOnlyPlaceUpdate({ status: 'archived' }), true);
  assert.equal(canUpdatePlaceLockedByPlan({ status: 'archived' }), true);
  assert.equal(canUpdatePlaceLockedByPlan({ status: 'archived', translations: [] }), false);
});
