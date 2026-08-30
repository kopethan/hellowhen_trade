import assert from 'node:assert/strict';
import test from 'node:test';
import type { MobileReleasePolicyResponse } from '@hellowhen/contracts';
import {
  getOptionalUpdateDismissal,
  readInstalledReleaseTarget,
  shouldPresentAppUpdate,
  validateAppUpdatePolicyResponse,
  type InstalledMobileRelease,
} from '../appUpdatePolicy.js';

const installed: InstalledMobileRelease = {
  platform: 'ios',
  target: { version: '1.0.2', build: 31 },
};

const optionalPolicy: MobileReleasePolicyResponse = {
  enabled: true,
  platform: 'ios',
  status: 'optional',
  installed: installed.target,
  latest: { version: '1.0.3', build: 35 },
  minimumSupported: { version: '1.0.2', build: 30 },
  releaseNotes: 'Bug fixes and improvements.',
};

const mandatoryPolicy: MobileReleasePolicyResponse = {
  ...optionalPolicy,
  status: 'mandatory',
  installed: { version: '1.0.1', build: 29 },
};

const mandatoryInstalled: InstalledMobileRelease = {
  platform: 'ios',
  target: mandatoryPolicy.installed,
};

test('installed release metadata accepts only native iOS/Android x.y.z versions and positive integer builds', () => {
  assert.deepEqual(readInstalledReleaseTarget({ platform: 'ios', version: '1.0.2', build: '31' }), installed);
  assert.equal(readInstalledReleaseTarget({ platform: 'web', version: '1.0.2', build: '31' }), null);
  assert.equal(readInstalledReleaseTarget({ platform: 'android', version: '1.0', build: '12' }), null);
  assert.equal(readInstalledReleaseTarget({ platform: 'android', version: '1.0.2', build: '0' }), null);
  assert.equal(readInstalledReleaseTarget({ platform: 'android', version: '1.0.2', build: '12.5' }), null);
});

test('native validation accepts the expected optional policy for the exact installed release', () => {
  assert.deepEqual(validateAppUpdatePolicyResponse(optionalPolicy, installed), optionalPolicy);
});

test('native validation rejects schema failures and installed-release mismatches', () => {
  assert.equal(validateAppUpdatePolicyResponse({ ...optionalPolicy, status: 'force' }, installed), null);
  assert.equal(validateAppUpdatePolicyResponse({ ...optionalPolicy, platform: 'android' }, installed), null);
  assert.equal(validateAppUpdatePolicyResponse({ ...optionalPolicy, installed: { version: '1.0.2', build: 30 } }, installed), null);
});

test('native validation independently rejects false mandatory and false optional classifications', () => {
  const falseMandatory = { ...optionalPolicy, status: 'mandatory' as const };
  assert.equal(validateAppUpdatePolicyResponse(falseMandatory, installed), null);

  const belowMinimum: InstalledMobileRelease = {
    platform: 'ios',
    target: { version: '1.0.1', build: 99 },
  };
  const falseOptional: MobileReleasePolicyResponse = {
    ...optionalPolicy,
    status: 'optional',
    installed: belowMinimum.target,
  };
  assert.equal(validateAppUpdatePolicyResponse(falseOptional, belowMinimum), null);
});

test('native validation rejects contradictory minimum/latest targets', () => {
  const contradictory: MobileReleasePolicyResponse = {
    ...optionalPolicy,
    minimumSupported: { version: '1.0.4', build: 1 },
  };
  assert.equal(validateAppUpdatePolicyResponse(contradictory, installed), null);
});

test('disabled current policy stays non-blocking', () => {
  const disabled: MobileReleasePolicyResponse = {
    enabled: false,
    platform: 'ios',
    status: 'current',
    installed: installed.target,
    latest: null,
    minimumSupported: null,
    releaseNotes: null,
  };
  assert.deepEqual(validateAppUpdatePolicyResponse(disabled, installed), disabled);
  assert.equal(shouldPresentAppUpdate(disabled, null), false);
});

test('optional dismissal hides only the exact latest target', () => {
  const dismissal = getOptionalUpdateDismissal(optionalPolicy);
  assert.ok(dismissal);
  assert.equal(shouldPresentAppUpdate(optionalPolicy, dismissal), false);

  const newerOptional: MobileReleasePolicyResponse = {
    ...optionalPolicy,
    latest: { version: '1.0.4', build: 40 },
  };
  assert.equal(shouldPresentAppUpdate(newerOptional, dismissal), true);
});

test('mandatory policy always presents even when an older optional target was dismissed', () => {
  const previousDismissal = {
    platform: 'ios' as const,
    version: '1.0.3',
    build: 35,
  };
  const validated = validateAppUpdatePolicyResponse(mandatoryPolicy, mandatoryInstalled);
  assert.ok(validated);
  assert.equal(shouldPresentAppUpdate(validated, previousDismissal), true);
});
