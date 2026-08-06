#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedVersion = '1.0.0';
const rejectedBuild = 25;
const appStoreConnectAppId = '6781399122';
const originalSubmissionId = '46ed2c97-069c-4c92-a903-3c82d1b690de';

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExists(relativePath, message = `${relativePath} must exist.`) {
  assert(existsSync(path.join(root, relativePath)), message);
}

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  assert(read(file).includes(needle), message);
}

function assertNotContains(file, needle, message = `${file} must not contain ${needle}`) {
  assert(!read(file).includes(needle), message);
}

function runReleaseIdentityChecks() {
  const app = readJson('apps/mobile/app.json').expo;
  const eas = readJson('apps/mobile/eas.json');
  const production = eas.build?.production ?? {};
  const productionEnv = production.env ?? {};

  assert(app.version === expectedVersion, `The replacement submission must use marketing version ${expectedVersion}.`);
  assert(eas.cli?.appVersionSource === 'remote', 'EAS build numbers must remain remote-managed.');
  assert(production.autoIncrement === true, 'The production profile must auto-increment beyond the previously issued build number.');
  assert(eas.submit?.production?.ios?.ascAppId === appStoreConnectAppId, `The submit profile must target App Store Connect app ${appStoreConnectAppId}.`);
  assert(productionEnv.EXPO_PUBLIC_STORE_RELEASE === 'true', 'The submitted profile must enable store-release mode.');
  assert(productionEnv.EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE === 'false', 'Feature diagnostics must stay hidden in the submitted build.');
  console.log(`Submission release identity ${expectedVersion}, build > ${rejectedBuild}: PASS`);
}

function runSubmissionDocumentChecks() {
  const checklist = 'docs/launch/appstore26-app-review-resubmission.md';
  const evidence = 'docs/launch/appstore26-submission-evidence-template.md';

  assertExists(checklist, 'The APPSTORE26 App Review resubmission checklist is missing.');
  assertExists(evidence, 'The APPSTORE26 private evidence template is missing.');
  assertContains(checklist, originalSubmissionId, 'The checklist must identify the rejection being resolved.');
  assertContains(checklist, 'Guideline 2.2 — Performance — Beta Testing', 'The review response must address Guideline 2.2 explicitly.');
  assertContains(checklist, 'Guideline 4 — Design', 'The review response must address Guideline 4 explicitly.');
  assertContains(checklist, 'Removed the general BETA badge shown on the Me screen', 'The notes must identify the exact visible rejection fix.');
  assertContains(checklist, 'Added Apple Maps as the first map-provider option on iOS', 'The notes must explain Apple Maps parity.');
  assertContains(checklist, '<IOS_BUILD_NUMBER>', 'The reply template must require the exact replacement build number.');
  assertContains(checklist, '<REVIEW_PLAN_TITLE>', 'The review path must require a stable prepared Plan title.');
  assertContains(checklist, '<REVIEWER_EMAIL>', 'Reviewer credentials must remain placeholders in the committed template.');
  assertContains(checklist, '<TEMPORARY_PASSWORD>', 'Reviewer password must remain a placeholder in the committed template.');
  assertContains(checklist, 'https://hellowhen.com/legal/privacy', 'The checklist must use the production Privacy Policy URL.');
  assertContains(checklist, 'Resubmit to App Review', 'The checklist must cover resubmitting the corrected unresolved item.');
  assertContains(evidence, 'Exact TestFlight device checks', 'The evidence template must bind QA to the exact TestFlight binary.');
  assertContains(evidence, 'Original submission ID', 'The evidence template must retain the rejection context.');
  console.log('App Review response/checklist templates: PASS');
}

function runCredentialSafetyChecks() {
  const gitignore = read('.gitignore');
  const checklist = 'docs/launch/appstore26-app-review-resubmission.md';

  assert(gitignore.split(/\r?\n/).includes('.release-private/'), '.release-private/ must be ignored before storing private submission evidence.');
  assertNotContains(checklist, 'Password: password', 'The committed review template must not include a reusable sample password.');
  assertNotContains(checklist, '@gmail.com', 'The committed review template must not contain a personal reviewer email.');
  assertNotContains(checklist, '@icloud.com', 'The committed review template must not contain a personal reviewer email.');
  assertContains(checklist, 'Never add the completed private evidence file to the repository.', 'The checklist must protect private release evidence.');
  console.log('Reviewer credential/evidence safety: PASS');
}

function runRunbookIntegrationChecks() {
  assertContains('package.json', '"mobile:submission-preflight": "node scripts/mobile-submission-preflight.mjs"', 'package.json must expose the submission preflight command.');
  assertContains('package.json', 'npm run mobile:submission-preflight', 'The store-readiness chain must run the submission preflight.');
  assertContains('docs/launch/appstore26-production-release.md', 'appstore26-app-review-resubmission.md', 'The production runbook must point to the final resubmission checklist.');
  assertContains('docs/launch/appstore26-ios-device-review-smoke.md', 'appstore26-submission-evidence-template.md', 'The device checklist must point to the private evidence template.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'APPSTORE26-SUBMIT1', 'The store checklist must use the final APPSTORE26 review notes instead of a stale generic template.');
  console.log('Submission workflow integration: PASS');
}

function main() {
  runReleaseIdentityChecks();
  runSubmissionDocumentChecks();
  runCredentialSafetyChecks();
  runRunbookIntegrationChecks();
  console.log('APPSTORE26-SUBMIT1 App Review submission preflight: PASS');
  console.log('Exact TestFlight QA, reviewer credentials, App Store Connect build selection, and final resubmission remain manual steps.');
}

main();
