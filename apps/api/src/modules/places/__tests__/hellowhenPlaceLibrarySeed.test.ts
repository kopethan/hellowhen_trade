import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HELLOWHEN_PLACE_LIBRARY_PACK,
  googlePredictionMatchesEntry,
  hellowhenPlaceLibrarySeedEntries,
  normalizeHellowhenPlaceMatchText,
} from '../hellowhenPlaceLibrarySeed.js';

test('initial Hellowhen Place Library pack is a focused, complete Paris set', () => {
  assert.equal(HELLOWHEN_PLACE_LIBRARY_PACK, 'paris-popular-v1');
  assert.ok(hellowhenPlaceLibrarySeedEntries.length >= 12);

  const keys = new Set<string>();
  const englishTitles = new Set<string>();
  for (const entry of hellowhenPlaceLibrarySeedEntries) {
    assert.equal(entry.city, 'Paris');
    assert.equal(entry.countryCode, 'FR');
    assert.equal(entry.areaLabel, 'Paris, France');
    assert.ok(entry.key.length >= 3);
    assert.ok(entry.googleQuery.toLowerCase().includes('paris'));
    assert.ok(entry.matchTokens.length >= 1);
    assert.ok(entry.tags.length >= 2 && entry.tags.length <= 8);
    assert.ok(entry.defaultDurationMinutes >= 5 && entry.defaultDurationMinutes <= 24 * 60);

    assert.equal(keys.has(entry.key), false, `duplicate key: ${entry.key}`);
    keys.add(entry.key);
    assert.equal(englishTitles.has(entry.copy.en.title), false, `duplicate English title: ${entry.copy.en.title}`);
    englishTitles.add(entry.copy.en.title);

    for (const languageCode of ['en', 'fr', 'es'] as const) {
      assert.ok(entry.copy[languageCode].title.trim().length >= 3, `${entry.key} missing ${languageCode} title`);
      assert.ok(entry.copy[languageCode].description.trim().length >= 20, `${entry.key} missing ${languageCode} description`);
    }
  }
});

test('prediction matching ignores accents, punctuation, and case', () => {
  const sacreCoeur = hellowhenPlaceLibrarySeedEntries.find((entry) => entry.key === 'sacre-coeur');
  assert.ok(sacreCoeur);
  assert.equal(googlePredictionMatchesEntry(sacreCoeur, 'Basilique du Sacré-Cœur de Montmartre, Paris'), true);
  assert.equal(googlePredictionMatchesEntry(sacreCoeur, 'Louvre Museum, Paris'), false);
  assert.equal(normalizeHellowhenPlaceMatchText('Musée d’Orsay'), 'musee d orsay');
});
