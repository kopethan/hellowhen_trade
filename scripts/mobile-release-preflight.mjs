#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedMarketingVersion = '1.0.1';
const previousPublicMarketingVersion = '1.0.0';
const minimumIosBuildNumber = 27;
const appStoreConnectAppId = '6781399122';
const activeRunbook = 'docs/launch/appstore-i18n-101-production-release.md';
const activeDeviceChecklist = 'docs/launch/appstore-i18n-101-ios-device-release-smoke.md';

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  assert(read(file).includes(needle), message);
}

function assertExists(relativePath, message = `${relativePath} must exist.`) {
  assert(existsSync(path.join(root, relativePath)), message);
}

function assertPublicHttpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }

  assert(parsed.protocol === 'https:', `${label} must use https://.`);
  assert(!['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname.toLowerCase()), `${label} must not point to localhost.`);
}

function runMarketingVersionChecks() {
  const app = readJson('apps/mobile/app.json').expo;
  const mobilePackage = readJson('apps/mobile/package.json');
  const lockfile = readJson('package-lock.json');

  assert(app.version === expectedMarketingVersion, `apps/mobile/app.json must use marketing version ${expectedMarketingVersion}. Found ${app.version ?? '(unset)'}.`);
  assert(mobilePackage.version === expectedMarketingVersion, `apps/mobile/package.json must stay aligned with marketing version ${expectedMarketingVersion}.`);
  assert(lockfile.packages?.['apps/mobile']?.version === expectedMarketingVersion, 'package-lock.json must stay aligned with apps/mobile/package.json.');
  assert(/^\d+\.\d+\.\d+$/.test(app.version), 'The public marketing version must use three-part semantic versioning.');
  assert(app.version !== previousPublicMarketingVersion, `The active update must advance beyond public version ${previousPublicMarketingVersion}.`);
  assert(app.ios?.buildNumber === undefined, 'ios.buildNumber must remain omitted while EAS remote versioning is the source of truth.');
  assert(app.android?.versionCode === undefined, 'android.versionCode must remain omitted while EAS remote versioning is the source of truth.');
  console.log(`Marketing version ${expectedMarketingVersion}: PASS`);
}

function runEasVersionAndSubmissionChecks() {
  const app = readJson('apps/mobile/app.json').expo;
  const eas = readJson('apps/mobile/eas.json');
  const production = eas.build?.production ?? {};
  const productionEnv = production.env ?? {};
  const submitIos = eas.submit?.production?.ios ?? {};

  assert(eas.cli?.appVersionSource === 'remote', 'EAS developer-facing build versions must remain remote-managed.');
  assert(production.autoIncrement === true, 'The EAS production profile must auto-increment the iOS build number.');
  assert(submitIos.ascAppId === appStoreConnectAppId, `The production submit profile must target App Store Connect app ${appStoreConnectAppId}.`);
  assert(app.extra?.eas?.projectId === '382a7ae7-3e37-4200-bd40-b68d6d9e94be', 'The mobile app must stay linked to the production EAS project.');
  assert(productionEnv.EXPO_PUBLIC_STORE_RELEASE === 'true', 'The production build must enable store-release mode.');
  assert(productionEnv.EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE === 'false', 'Feature diagnostics must stay hidden in the production build.');
  assertPublicHttpsUrl(productionEnv.EXPO_PUBLIC_API_URL, 'Production API URL');
  assertPublicHttpsUrl(productionEnv.EXPO_PUBLIC_WEB_URL, 'Production web URL');
  console.log('EAS remote versioning and App Store submit target: PASS');
}

function runReleaseRunbookChecks() {
  assertExists(activeRunbook, 'The 1.0.1 production release runbook is missing.');
  assertContains(activeRunbook, 'npm run mobile:release-preflight', 'Release runbook must require the focused preflight command.');
  assertContains(activeRunbook, 'eas build:version:get --platform ios --profile production', 'Release runbook must inspect the remote iOS build number before building.');
  assertContains(activeRunbook, `Marketing version: ${expectedMarketingVersion}`, 'Release runbook must identify the active public marketing version.');
  assertContains(activeRunbook, `Minimum iOS build: ${minimumIosBuildNumber}`, 'Release runbook must require the next safe iOS build floor.');
  assertContains(activeRunbook, 'Do not run `eas build:version:set` blindly', 'Release runbook must protect against resetting the remote build number to a duplicate.');
  assertContains(activeRunbook, 'eas build --platform ios --profile production --clear-cache', 'Release runbook must use the reviewed production profile for the 1.0.1 binary.');
  assertContains(activeRunbook, 'eas submit --platform ios --profile production', 'Release runbook must document submission of the selected production build.');
  assertContains(activeRunbook, 'Do not use `--auto-submit`', 'Release runbook must preserve the manual QA checkpoint before upload.');
  assertContains(activeRunbook, 'APPSTORE-I18N3', 'Release runbook must stop before final App Review submission until the English metadata/review package is complete.');
  console.log('1.0.1 production release runbook: PASS');
}

function runChecklistIntegrationChecks() {
  assertExists(activeDeviceChecklist, 'The 1.0.1 exact-binary device checklist is missing.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'appstore-i18n-101-production-release.md', 'Store readiness must link the active 1.0.1 release runbook.');
  assertContains('docs/launch/native-app-store-release-checklist.md', 'appstore-i18n-101-production-release.md', 'Native release checklist must link the active 1.0.1 release runbook.');
  assertContains(activeDeviceChecklist, 'Marketing version | 1.0.1', 'Device evidence must pin the exact 1.0.1 marketing version.');
  assertContains(activeDeviceChecklist, 'iOS build number | 27 or greater', 'Device evidence must require build 27 or greater.');
  assertContains('docs/mobile/ios-eas-build-requirements.md', 'eas build:version:get --platform ios --profile production', 'iOS EAS requirements must require a remote build-number check.');

  // APPSTORE26 remains historical evidence/regression context and must not be rewritten as the 1.0.1 release.
  assertContains('docs/launch/appstore26-production-release.md', 'Marketing version: 1.0.0', 'Historical APPSTORE26 release evidence must remain pinned to 1.0.0.');
  assertContains('docs/launch/appstore26-app-review-resubmission.md', 'Replacement marketing version: 1.0.0', 'Historical APPSTORE26 resubmission evidence must remain pinned to 1.0.0.');
  console.log('Release checklist rollover and APPSTORE26 history preservation: PASS');
}

function main() {
  runMarketingVersionChecks();
  runEasVersionAndSubmissionChecks();
  runReleaseRunbookChecks();
  runChecklistIntegrationChecks();
  console.log('APPSTORE-I18N2 1.0.1 production version/build preflight: PASS');
  console.log(`Remote EAS build-number inspection must still confirm that the generated build is ${minimumIosBuildNumber} or greater.`);
}

main();
