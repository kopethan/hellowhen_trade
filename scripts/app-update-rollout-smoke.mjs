#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  const contents = normalizeLineEndings(read(file));
  const expected = normalizeLineEndings(needle);
  assert(contents.includes(expected), message);
}

function assertExists(relativePath, message = `${relativePath} must exist.`) {
  assert(existsSync(path.join(root, relativePath)), message);
}

function parseEnvAssignments(contents) {
  const entries = new Map();
  for (const rawLine of contents.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) continue;
    entries.set(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim());
  }
  return entries;
}

function runServerSafetyChecks() {
  const envExample = parseEnvAssignments(read('.env.example'));
  assert(envExample.get('MOBILE_RELEASE_POLICY_ENABLED') === 'false', 'Release policy must remain disabled by default.');
  for (const key of [
    'MOBILE_IOS_LATEST_VERSION',
    'MOBILE_IOS_LATEST_BUILD',
    'MOBILE_IOS_MIN_SUPPORTED_VERSION',
    'MOBILE_IOS_MIN_SUPPORTED_BUILD',
    'MOBILE_ANDROID_LATEST_VERSION',
    'MOBILE_ANDROID_LATEST_BUILD',
    'MOBILE_ANDROID_MIN_SUPPORTED_VERSION',
    'MOBILE_ANDROID_MIN_SUPPORTED_BUILD',
  ]) {
    assert(envExample.has(key) && envExample.get(key) === '', `${key}= must stay empty in .env.example so rollout cannot activate accidentally.`);
  }

  assertContains('apps/api/src/routes.ts', "routes.use('/mobile', mobileReleaseRoutes);", 'Mobile release policy must stay on its public route without auth middleware.');
  assertContains('apps/api/src/modules/mobile-release/mobileRelease.routes.ts', "res.setHeader('Cache-Control', 'no-store');", 'Release-policy responses must never be cached.');
  assertContains('apps/api/src/app.ts', 'if (err instanceof ZodError) return res.status(400)', 'Malformed release-policy query parameters must be handled as validation errors, not 500s.');
  assertContains('apps/api/src/modules/mobile-release/mobileReleasePolicy.ts', 'if (!latest || !minimumSupported) return disabledPolicy(input);');
  assertContains('apps/api/src/modules/mobile-release/mobileReleasePolicy.ts', 'if (compareMobileReleaseTargets(minimumSupported, latest) > 0) return disabledPolicy(input);');
  console.log('App update server fail-open/config safety: PASS');
}

function runNativeGateChecks() {
  assertContains('apps/mobile/src/features/app-update/AppUpdatePolicyProvider.tsx', 'Application.nativeApplicationVersion', 'Native marketing version must come from the installed binary.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePolicyProvider.tsx', 'Application.nativeBuildVersion', 'Native build/version code must come from the installed binary.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePolicyProvider.tsx', 'ExecutionEnvironment.StoreClient', 'Expo Go must bypass native store-version checks.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePolicyProvider.tsx', 'validateAppUpdatePolicyResponse(policyResponse, release)', 'Native app must runtime-validate policy responses before presenting an update.');
  assertContains('apps/mobile/src/features/app-update/appUpdatePolicy.ts', 'mobileReleasePolicyResponseSchema.safeParse(value)', 'Native policy validation must include the shared runtime schema.');
  assertContains('apps/mobile/src/features/app-update/appUpdatePolicy.ts', "const expectedStatus = belowMinimum ? 'mandatory' : belowLatest ? 'optional' : 'current';", 'Native policy validation must independently recompute update status.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePolicyProvider.tsx', 'const FOREGROUND_RECHECK_INTERVAL_MS = 15 * 60 * 1000;', 'Foreground polling must stay throttled.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePolicyProvider.tsx', 'setPolicy(null);\n      setDismissal(null);', 'Policy request failures must fail open.');
  assertContains('apps/mobile/src/lib/api.ts', "if (namespace === 'mobile' && method === 'releasePolicy') return false;", 'Public release-policy failures must not trigger auth refresh.');
  console.log('App update native gate/fail-open safety: PASS');
}

function runDismissalAndPromptChecks() {
  assertContains('apps/mobile/src/features/app-update/appUpdateStorage.ts', 'hellowhen_mobile.appUpdate.dismissedOptional.v1', 'Optional dismissal must use a dedicated local key.');
  assertContains('apps/mobile/src/features/app-update/appUpdatePolicy.ts', 'target.version === dismissal.version', 'Optional dismissal must compare exact target version.');
  assertContains('apps/mobile/src/features/app-update/appUpdatePolicy.ts', 'target.build === dismissal.build', 'Optional dismissal must compare exact target build.');
  assertContains('apps/mobile/src/features/app-update/appUpdatePolicy.ts', "if (policy.status === 'mandatory') return Boolean(policy.minimumSupported);", 'Mandatory updates must ignore optional dismissal.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', 'onRequestClose={isMandatory ? () => undefined : dismiss}', 'Mandatory prompt must not close via Android Back.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', '{!isMandatory ? (', 'Mandatory prompt must not render the Later action.');
  assertExists('apps/mobile/assets/app-update/light/update-available-light.png', 'Bundled light update illustration is missing.');
  assertExists('apps/mobile/assets/app-update/dark/update-available-dark.png', 'Bundled dark update illustration is missing.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', 'UPDATE_ILLUSTRATIONS[theme.mode]', 'Update artwork must follow the resolved app theme.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', 'useAppSettings()', 'Update prompt appearance control must reuse the persisted app settings provider.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', "{ value: 'system', labelKey: 'onboarding.preferences.appearanceOptions.system' }", 'Update prompt must retain the System appearance option.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', 'transparent={false}', 'Update prompt must remain a full-screen modal rather than a translucent card overlay.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', 'UPDATE_BACKGROUNDS[theme.mode]', 'Update prompt page background must follow the artwork-specific seamless light/dark background.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', "light: '#FEFEFE'", 'Light update page background must stay aligned with the bundled light artwork edge color.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', "dark: '#090E24'", 'Dark update page background must stay aligned with the bundled dark artwork edge color.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', 'const illustrationSize = Math.max(180, Math.min(windowWidth - 56, compactHeight ? 220 : 280));', 'Update artwork must stay capped so the title and release details remain visible on standard phones.');
  assertContains('apps/mobile/src/features/app-update/AppUpdatePrompt.tsx', "justifyContent: 'flex-start'", 'Full-screen update content must remain top-positioned instead of drifting behind the action dock.');
  console.log('App update dismissal/mandatory prompt + artwork safety: PASS');
}

function runStoreTargetChecks() {
  const app = readJson('apps/mobile/app.json').expo;
  const eas = readJson('apps/mobile/eas.json');
  const storeModule = read('apps/mobile/src/features/app-update/appUpdateStore.ts');

  assert(app.ios?.bundleIdentifier === 'com.hellowhen.app', 'iOS bundle identifier changed; review update store target before release.');
  assert(app.android?.package === 'com.hellowhen.app', 'Android package changed; review update store target before release.');
  assert(eas.submit?.production?.ios?.ascAppId === '6781399122', 'App Store Connect app id changed; review update store target before release.');
  assert(storeModule.includes("const IOS_APP_STORE_ID = '6781399122';"), 'Update prompt must target the production App Store app id.');
  assert(storeModule.includes("const ANDROID_PACKAGE_NAME = 'com.hellowhen.app';"), 'Update prompt must target the production Google Play package.');
  assert(storeModule.includes('itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}'), 'iOS native App Store URL is missing.');
  assert(storeModule.includes('https://apps.apple.com/app/id${IOS_APP_STORE_ID}'), 'iOS HTTPS fallback is missing.');
  assert(storeModule.includes('market://details?id=${ANDROID_PACKAGE_NAME}'), 'Android native Play Store URL is missing.');
  assert(storeModule.includes('https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}'), 'Android HTTPS fallback is missing.');
  console.log('App update store-target/fallback safety: PASS');
}

function runRunbookChecks() {
  const runbook = 'docs/launch/mobile-app-update-rollout.md';
  assertExists(runbook, 'App update rollout runbook is missing.');
  assertContains(runbook, 'MOBILE_RELEASE_POLICY_ENABLED=false', 'Runbook must document the immediate rollback switch.');
  assertContains(runbook, 'Optional first; mandatory later', 'Runbook must require optional rollout before mandatory enforcement.');
  assertContains(runbook, 'npm run app-update:probe --', 'Runbook must include the live endpoint probe.');
  assertContains(runbook, 'Do not raise the minimum-supported target until', 'Runbook must prevent mandatory rollout before store availability is confirmed.');
  console.log('App update rollout/rollback runbook: PASS');
}

function main() {
  runServerSafetyChecks();
  runNativeGateChecks();
  runDismissalAndPromptChecks();
  runStoreTargetChecks();
  runRunbookChecks();
  console.log('APPUPDATE4 release safety static smoke: PASS');
}

main();
