#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedVersion = '1.0.2';
const minimumIosBuildNumber = 28;
const appStoreConnectAppId = '6781399122';
const activeRunbook = 'docs/launch/mobile-102-production-release.md';
const evidenceTemplate = 'docs/launch/appstore-i18n-102-submission-evidence-template.md';
const englishLocalizationGuide = 'docs/launch/appstore-i18n-102-english-localization.md';
const englishMetadataSource = 'docs/launch/appstore-i18n-102-en-US-metadata.json';

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

  assert(app.version === expectedVersion, `The App Store update must use marketing version ${expectedVersion}.`);
  assert(app.ios?.buildNumber === undefined, 'Do not hard-code ios.buildNumber while EAS remote versioning is the source of truth.');
  assert(eas.cli?.appVersionSource === 'remote', 'EAS build numbers must remain remote-managed.');
  assert(production.autoIncrement === true, 'The production profile must keep iOS build-number auto-increment enabled.');
  assert(eas.submit?.production?.ios?.ascAppId === appStoreConnectAppId, `The submit profile must target App Store Connect app ${appStoreConnectAppId}.`);
  assert(productionEnv.EXPO_PUBLIC_STORE_RELEASE === 'true', 'The submitted profile must enable store-release mode.');
  assert(productionEnv.EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE === 'false', 'Feature diagnostics must stay hidden in the submitted build.');
  console.log(`Submission release identity ${expectedVersion}, minimum build ${minimumIosBuildNumber}: PASS`);
}

function runSubmissionDocumentChecks() {
  assertExists(activeRunbook, 'The 1.0.2 production release runbook is missing.');
  assertExists(evidenceTemplate, 'The 1.0.2 private evidence template is missing.');
  assertContains(activeRunbook, 'RELEASE-METADATA1', 'The release runbook must require the English App Store metadata/review package before final review submission.');
  assertContains(activeRunbook, 'appstore-i18n-102-english-localization.md', 'The release runbook must point to the active 1.0.2 English localization package.');
  assertContains(englishLocalizationGuide, 'preserve the already approved French localization', 'The active localization guide must preserve the existing French localization.');
  assertContains(englishMetadataSource, 'https://hellowhen.com/legal/privacy', 'The active metadata source must keep the production Privacy Policy URL.');
  assertContains(evidenceTemplate, 'Exact TestFlight device checks', 'The evidence template must bind QA to the exact TestFlight binary.');
  assertContains(evidenceTemplate, 'Marketing version | 1.0.2', 'The evidence template must pin marketing version 1.0.2.');
  assertContains(evidenceTemplate, 'iOS build number | 28 or greater', 'The evidence template must require build 28 or greater.');
  assertContains(evidenceTemplate, 'French system language', 'The evidence template must capture French system-language behavior.');
  assertContains(evidenceTemplate, 'English system language', 'The evidence template must capture English system-language behavior.');
  assertContains(evidenceTemplate, 'Spanish system language', 'The evidence template must capture Spanish system-language behavior.');
  assertContains(evidenceTemplate, 'Unsupported system language', 'The evidence template must capture French fallback for unsupported device languages.');
  console.log('1.0.2 update runbook/evidence templates: PASS');
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function runEnglishLocalizationPackageChecks() {
  assertExists(englishLocalizationGuide, 'The RELEASE-METADATA1 English localization guide is missing.');
  assertExists(englishMetadataSource, 'The RELEASE-METADATA1 English metadata source is missing.');

  const metadata = readJson(englishMetadataSource);
  const guide = read(englishLocalizationGuide);
  const normalizedGuide = normalizeLineEndings(guide);

  assert(metadata.locale === 'en-US', 'The App Store metadata source must target English (U.S.) / en-US.');
  assert(metadata.version === expectedVersion, `The App Store metadata source must target version ${expectedVersion}.`);
  assert(metadata.name === 'Hellowhen', 'English App Store name must keep the Hellowhen brand.');
  assert(metadata.name.length >= 2 && metadata.name.length <= 30, 'English App Store name must be 2-30 characters.');
  assert(metadata.subtitle.length <= 30, 'English App Store subtitle must be 30 characters or fewer.');
  assert(metadata.promotionalText.length <= 170, 'English promotional text must be 170 characters or fewer.');
  assert(metadata.description.length <= 4000, 'English description must be 4000 characters or fewer.');
  assert(utf8Bytes(metadata.keywords) <= 100, 'English keywords must be 100 bytes or fewer.');
  assert(metadata.keywords.split(',').every((keyword) => keyword.trim().length > 2), 'Every English keyword must be longer than two characters.');
  assert(!metadata.keywords.toLowerCase().includes('hellowhen'), 'Keywords must not duplicate the searchable app name.');
  assert(metadata.whatsNew.length > 0 && metadata.whatsNew.length <= 4000, "What's New must be present for 1.0.2 and remain within 4000 characters.");
  assert(utf8Bytes(metadata.appReviewNotes) <= 4000, 'App Review Notes must be 4000 bytes or fewer.');

  assert(metadata.supportUrl === 'https://hellowhen.com/support', 'English Support URL must use the reviewed production support page.');
  assert(metadata.marketingUrl === 'https://hellowhen.com', 'English Marketing URL must use the production Hellowhen site.');
  assert(metadata.privacyPolicyUrl === 'https://hellowhen.com/legal/privacy', 'English Privacy Policy URL must use the reviewed production privacy page.');

  for (const field of ['name', 'subtitle', 'promotionalText', 'description', 'keywords', 'whatsNew', 'appReviewNotes']) {
    assert(normalizedGuide.includes(normalizeLineEndings(metadata[field])), `English localization guide must contain the exact ${field} value from the metadata source.`);
  }

  const customerFacing = [metadata.subtitle, metadata.promotionalText, metadata.description, metadata.keywords, metadata.whatsNew].join(' ').toLowerCase();
  for (const forbidden of ['cash promise', 'wallet', 'payout', 'subscription', 'membership', 'agenda', 'saved library', 'artificial intelligence', ' ai ', 'advertising', ' ads ']) {
    assert(!customerFacing.includes(forbidden), `Customer-facing App Store copy must not advertise disabled feature: ${forbidden.trim()}.`);
  }

  assert(guide.includes('preserve the already approved French localization'), 'RELEASE-METADATA1 must preserve the existing French App Store localization.');
  assert(guide.includes('Primary Language'), 'RELEASE-METADATA1 must include a Primary Language verification step.');
  assert(guide.includes('Plans feed'), 'English screenshot plan must include the current Plans surface.');
  assert(guide.includes('Trade feed'), 'English screenshot plan must include the current Trade surface.');
  assert(guide.includes('Private proposal thread'), 'English screenshot plan must include private proposal UX.');
  assert(guide.includes('Me / Safety'), 'English screenshot plan must include the Me/safety surface.');
  assert(guide.includes('supportsTablet` is `false`'), 'Screenshot guidance must account for the current iPhone-only native configuration.');
  assert(metadata.appReviewNotes.includes('normal update to the already released version 1.0.1'), 'Review notes must describe 1.0.2 as a normal update, not a rejection resubmission.');
  assert(metadata.appReviewNotes.includes('release policy remains disabled'), 'Review notes must state that the first 1.0.2 rollout keeps the app-update policy disabled.');
  assert(metadata.appReviewNotes.includes('Apple Maps is offered'), 'Review notes must preserve Apple Maps review clarity for eligible iOS map actions.');
  assert(metadata.appReviewNotes.includes('does not expose payments'), 'Review notes must clearly describe disabled payment and future-feature surfaces.');

  console.log('RELEASE-METADATA1 English metadata limits, screenshots, URLs, and review notes: PASS');
}

function runCredentialSafetyChecks() {
  const gitignore = read('.gitignore');

  assert(gitignore.split(/\r?\n/).includes('.release-private/'), '.release-private/ must be ignored before storing private submission evidence.');
  assertNotContains(evidenceTemplate, '@gmail.com', 'The committed evidence template must not contain a personal reviewer email.');
  assertNotContains(evidenceTemplate, '@icloud.com', 'The committed evidence template must not contain a personal reviewer email.');
  assertNotContains(evidenceTemplate, 'Password: password', 'The committed evidence template must not contain a reusable sample password.');
  assertContains(evidenceTemplate, 'Never commit the completed copy.', 'The evidence template must protect private release evidence.');
  console.log('Reviewer credential/evidence safety: PASS');
}

function runWorkflowIntegrationChecks() {
  assertContains('package.json', '"mobile:submission-preflight": "node scripts/mobile-submission-preflight.mjs"', 'package.json must expose the submission preflight command.');
  assertContains('package.json', 'npm run mobile:submission-preflight', 'The store-readiness chain must run the submission preflight.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'appstore-i18n-102-en-US-metadata.json', 'Store readiness must point to the RELEASE-METADATA1 exact English metadata source.');
  assertContains('docs/launch/native-app-store-release-checklist.md', 'mobile-102-ios-device-release-smoke.md', 'Native release checklist must point to the active exact-binary 1.0.2 device checklist.');
  assertContains('docs/mobile/ios-eas-build-requirements.md', 'mobile-102-production-release.md', 'iOS EAS requirements must point to the active 1.0.2 runbook.');

  // Keep the successful 1.0.0 rejection-resolution material as immutable historical guidance/regression context.
  assertContains('docs/launch/appstore26-app-review-resubmission.md', 'Guideline 2.2 — Performance — Beta Testing', 'Historical APPSTORE26 review evidence must remain available.');
  assertContains('docs/launch/appstore26-ios-device-review-smoke.md', 'build 25 rejection regression', 'Historical APPSTORE26 rejection regression checklist must remain available.');
  assertExists('docs/launch/appstore-i18n-101-en-US-metadata.json', 'Historical 1.0.1 metadata must remain preserved.');
  assert(readJson('docs/launch/appstore-i18n-101-en-US-metadata.json').version === '1.0.1', 'Historical 1.0.1 metadata must stay pinned to 1.0.1.');
  console.log('1.0.2 submission workflow integration + 1.0.1 history preservation: PASS');
}

function main() {
  runReleaseIdentityChecks();
  runSubmissionDocumentChecks();
  runEnglishLocalizationPackageChecks();
  runCredentialSafetyChecks();
  runWorkflowIntegrationChecks();
  console.log('RELEASE-METADATA1 1.0.2 App Store localization/submission preflight: PASS');
  console.log('Exact TestFlight QA, App Store Connect build selection, English screenshot capture/upload, reviewer credentials, and final App Store Connect entry remain manual release steps.');
}

main();
