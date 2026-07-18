import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveInventoryOriginalCopy,
  withResolvedInventoryDisplay,
  type InventoryTranslatableLike,
} from '@hellowhen/shared';

const englishOriginal: InventoryTranslatableLike & { id: string } = {
  id: 'place-1',
  title: 'Test place for time check',
  description: 'Useful details for this Place.',
  defaultLanguage: 'en',
  translations: [
    {
      languageCode: 'fr',
      title: 'Teste français',
      description: 'Test descriptin pur',
      source: 'creator',
    },
  ],
};

test('localized display payload retains explicit creator-authored source fields', () => {
  const localized = withResolvedInventoryDisplay(englishOriginal, 'fr', ['fr', 'en']);

  assert.equal(localized.title, 'Teste français');
  assert.equal(localized.description, 'Test descriptin pur');
  assert.equal(localized.originalTitle, 'Test place for time check');
  assert.equal(localized.originalDescription, 'Useful details for this Place.');

  const editorSource = resolveInventoryOriginalCopy(localized);
  assert.equal(editorSource.title, 'Test place for time check');
  assert.equal(editorSource.description, 'Useful details for this Place.');
  assert.equal(editorSource.defaultLanguage, 'en');
  assert.equal(editorSource.translations[0]?.languageCode, 'fr');
});

test('legacy localized payloads recover the original from display options', () => {
  const editorSource = resolveInventoryOriginalCopy({
    title: 'Teste français',
    description: 'Test descriptin pur',
    defaultLanguage: 'en',
    displayLanguage: {
      options: [
        {
          languageCode: 'en',
          title: 'Test place for time check',
          description: 'Useful details for this Place.',
          source: 'creator',
          isOriginal: true,
        },
        {
          languageCode: 'fr',
          title: 'Teste français',
          description: 'Test descriptin pur',
          source: 'creator',
          isOriginal: false,
        },
      ],
    },
  });

  assert.equal(editorSource.title, 'Test place for time check');
  assert.equal(editorSource.description, 'Useful details for this Place.');
  assert.deepEqual(editorSource.translations.map((translation) => translation.languageCode), ['fr']);
});

test('explicit original fields win over localized title and description', () => {
  const editorSource = resolveInventoryOriginalCopy({
    title: 'J’ai besoin d’accéder à une imprimante',
    description: 'Besoin d’une imprimante',
    originalTitle: 'I need access to a printer',
    originalDescription: 'Need a printer',
    defaultLanguage: 'en',
    translations: [
      {
        languageCode: 'fr',
        title: 'J’ai besoin d’accéder à une imprimante',
        description: 'Besoin d’une imprimante',
      },
    ],
  });

  assert.equal(editorSource.title, 'I need access to a printer');
  assert.equal(editorSource.description, 'Need a printer');
});
