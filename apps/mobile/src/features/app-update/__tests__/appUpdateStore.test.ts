import assert from 'node:assert/strict';
import test from 'node:test';
import { getAppUpdateStoreUrls, openAppUpdateStore } from '../appUpdateStore.js';

test('store URLs are pinned to the production Hellowhen identifiers', () => {
  assert.deepEqual(getAppUpdateStoreUrls('ios'), [
    'itms-apps://apps.apple.com/app/id6781399122',
    'https://apps.apple.com/app/id6781399122',
  ]);
  assert.deepEqual(getAppUpdateStoreUrls('android'), [
    'market://details?id=com.hellowhen.app',
    'https://play.google.com/store/apps/details?id=com.hellowhen.app',
  ]);
});

test('store opener stops after the native store URL succeeds', async () => {
  const opened: string[] = [];
  await openAppUpdateStore('ios', async (url) => {
    opened.push(url);
  });
  assert.deepEqual(opened, ['itms-apps://apps.apple.com/app/id6781399122']);
});

test('store opener falls back to HTTPS when the native store URL fails', async () => {
  const opened: string[] = [];
  await openAppUpdateStore('android', async (url) => {
    opened.push(url);
    if (url.startsWith('market://')) throw new Error('native store unavailable');
  });
  assert.deepEqual(opened, [
    'market://details?id=com.hellowhen.app',
    'https://play.google.com/store/apps/details?id=com.hellowhen.app',
  ]);
});

test('store opener rejects only after both store URLs fail', async () => {
  const opened: string[] = [];
  await assert.rejects(
    openAppUpdateStore('ios', async (url) => {
      opened.push(url);
      throw new Error('cannot open');
    }),
    /cannot open/,
  );
  assert.equal(opened.length, 2);
});
