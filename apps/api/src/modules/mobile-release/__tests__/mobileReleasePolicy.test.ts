import assert from 'node:assert/strict';
import test from 'node:test';
import { mobileReleasePolicyQuerySchema, type MobileReleasePolicyQuery } from '@hellowhen/contracts';
import {
  compareMobileReleaseTargets,
  evaluateMobileReleasePolicy,
  type MobileReleasePolicyConfig,
} from '../mobileReleasePolicy.js';

const baseConfig: MobileReleasePolicyConfig = {
  enabled: true,
  ios: {
    latestVersion: '1.0.3',
    latestBuild: '35',
    minimumSupportedVersion: '1.0.2',
    minimumSupportedBuild: '30',
    releaseNotes: {
      en: 'Bug fixes and improvements.',
      fr: 'Corrections et améliorations.',
      es: 'Correcciones y mejoras.',
    },
  },
  android: {
    latestVersion: '1.0.3',
    latestBuild: '14',
    minimumSupportedVersion: '1.0.1',
    minimumSupportedBuild: '10',
    releaseNotes: {
      en: 'Bug fixes and improvements.',
    },
  },
};

function query(overrides: Partial<MobileReleasePolicyQuery> = {}): MobileReleasePolicyQuery {
  return {
    platform: 'ios',
    version: '1.0.2',
    build: 31,
    locale: 'en',
    ...overrides,
  };
}


test('release policy query rejects malformed versions and missing build numbers', () => {
  assert.equal(mobileReleasePolicyQuerySchema.safeParse({ platform: 'ios', version: '1.0', build: '31' }).success, false);
  assert.equal(mobileReleasePolicyQuerySchema.safeParse({ platform: 'ios', version: '1.0.2', build: '' }).success, false);
  assert.equal(mobileReleasePolicyQuerySchema.safeParse({ platform: 'ios', version: '1.0.2', build: '31' }).success, true);
});

test('release comparison uses semantic x.y.z first and build number second', () => {
  assert.equal(compareMobileReleaseTargets({ version: '1.0.2', build: 99 }, { version: '1.0.3', build: 1 }), -1);
  assert.equal(compareMobileReleaseTargets({ version: '1.0.3', build: 34 }, { version: '1.0.3', build: 35 }), -1);
  assert.equal(compareMobileReleaseTargets({ version: '1.1.0', build: 1 }, { version: '1.0.99', build: 999 }), 1);
  assert.equal(compareMobileReleaseTargets({ version: '2.0.0', build: 1 }, { version: '2.0.0', build: 1 }), 0);
});

test('disabled master flag always returns a non-blocking policy', () => {
  const policy = evaluateMobileReleasePolicy(query({ version: '0.0.1', build: 1 }), { ...baseConfig, enabled: false });
  assert.equal(policy.enabled, false);
  assert.equal(policy.status, 'current');
  assert.equal(policy.latest, null);
  assert.equal(policy.minimumSupported, null);
});

test('installed releases below minimum support are mandatory', () => {
  const policy = evaluateMobileReleasePolicy(query({ version: '1.0.1', build: 99, locale: 'fr' }), baseConfig);
  assert.equal(policy.enabled, true);
  assert.equal(policy.status, 'mandatory');
  assert.deepEqual(policy.minimumSupported, { version: '1.0.2', build: 30 });
  assert.equal(policy.releaseNotes, 'Corrections et améliorations.');
});

test('supported releases below latest are optional', () => {
  const policy = evaluateMobileReleasePolicy(query(), baseConfig);
  assert.equal(policy.status, 'optional');
  assert.deepEqual(policy.latest, { version: '1.0.3', build: 35 });
});

test('a lower build of the same marketing version is optional', () => {
  const policy = evaluateMobileReleasePolicy(query({ version: '1.0.3', build: 34 }), baseConfig);
  assert.equal(policy.status, 'optional');
});

test('latest or newer installed releases are current', () => {
  assert.equal(evaluateMobileReleasePolicy(query({ version: '1.0.3', build: 35 }), baseConfig).status, 'current');
  assert.equal(evaluateMobileReleasePolicy(query({ version: '1.0.4', build: 1 }), baseConfig).status, 'current');
});

test('release notes fall back to English when a locale has no configured message', () => {
  const policy = evaluateMobileReleasePolicy(query({ platform: 'android', version: '1.0.2', build: 11, locale: 'es' }), baseConfig);
  assert.equal(policy.status, 'optional');
  assert.equal(policy.releaseNotes, 'Bug fixes and improvements.');
});

test('incomplete or contradictory platform configuration fails open', () => {
  const incomplete = structuredClone(baseConfig);
  incomplete.ios.latestBuild = '';
  const incompletePolicy = evaluateMobileReleasePolicy(query(), incomplete);
  assert.equal(incompletePolicy.enabled, false);
  assert.equal(incompletePolicy.status, 'current');

  const contradictory = structuredClone(baseConfig);
  contradictory.ios.minimumSupportedVersion = '1.0.4';
  const contradictoryPolicy = evaluateMobileReleasePolicy(query(), contradictory);
  assert.equal(contradictoryPolicy.enabled, false);
  assert.equal(contradictoryPolicy.status, 'current');
});

test('same marketing version below the minimum build is mandatory', () => {
  const policy = evaluateMobileReleasePolicy(query({ version: '1.0.2', build: 29 }), baseConfig);
  assert.equal(policy.status, 'mandatory');
});

test('platform configuration is evaluated independently', () => {
  const iosBroken = structuredClone(baseConfig);
  iosBroken.ios.latestVersion = '';

  const iosPolicy = evaluateMobileReleasePolicy(query(), iosBroken);
  assert.equal(iosPolicy.enabled, false);

  const androidPolicy = evaluateMobileReleasePolicy(query({ platform: 'android', version: '1.0.2', build: 11 }), iosBroken);
  assert.equal(androidPolicy.enabled, true);
  assert.equal(androidPolicy.status, 'optional');
});

test('invalid localized release notes fall back safely without changing update status', () => {
  const config = structuredClone(baseConfig);
  config.ios.releaseNotes.fr = 'x'.repeat(4001);
  const policy = evaluateMobileReleasePolicy(query({ locale: 'fr' }), config);
  assert.equal(policy.status, 'optional');
  assert.equal(policy.releaseNotes, 'Bug fixes and improvements.');

  config.ios.releaseNotes.en = '';
  const withoutFallback = evaluateMobileReleasePolicy(query({ locale: 'fr' }), config);
  assert.equal(withoutFallback.status, 'optional');
  assert.equal(withoutFallback.releaseNotes, null);
});
