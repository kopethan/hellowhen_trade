#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
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

function assertExists(relativePath, message = `${relativePath} is missing.`) {
  assert(existsSync(path.join(root, relativePath)), message);
}

function assertNonEmptyFile(relativePath, message = `${relativePath} must exist and be non-empty.`) {
  const absolutePath = path.join(root, relativePath);
  assert(existsSync(absolutePath), message);
  assert(statSync(absolutePath).size > 0, message);
}

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  assert(read(file).includes(needle), message);
}

function assertNotContains(file, needle, message = `${file} must not contain ${needle}`) {
  assert(!read(file).includes(needle), message);
}

function assertPackageDoesNotDependOn(packageJsonPath, blockedDependencies) {
  const pkg = readJson(packageJsonPath);
  const allDependencies = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };

  for (const dependency of blockedDependencies) {
    assert(!(dependency in allDependencies), `${packageJsonPath} must not depend on ${dependency} before store submission approval for that feature.`);
  }
}

function runAppMetadataChecks() {
  const app = readJson('apps/mobile/app.json').expo;
  assert(app.name === 'Hellowhen', 'Mobile app display name must stay Hellowhen for store assets/reviewer notes.');
  assert(app.slug === 'hellowhen', 'Expo slug must stay hellowhen.');
  assert(/^\d+\.\d+\.\d+$/.test(app.version), 'Mobile app version must be semantic, for example 0.1.0.');
  assert(app.orientation === 'portrait', 'Mobile app should stay portrait-only unless landscape has been tested.');
  assert(app.userInterfaceStyle === 'automatic', 'Mobile app should keep automatic appearance support.');
  assert(app.scheme === 'hellowhen', 'Mobile deep link scheme must stay configured.');

  assert(app.icon === './assets/icon.png', 'Mobile app icon path must stay configured.');
  assert(app.splash?.image === './assets/splash-logo.png', 'Mobile splash image path must stay configured.');
  assert(app.android?.adaptiveIcon?.foregroundImage === './assets/adaptive-icon.png', 'Android adaptive icon foreground must stay configured.');
  assertNonEmptyFile('apps/mobile/assets/icon.png', 'Store app icon asset is missing or empty.');
  assertNonEmptyFile('apps/mobile/assets/adaptive-icon.png', 'Android adaptive icon asset is missing or empty.');
  assertNonEmptyFile('apps/mobile/assets/splash-logo.png', 'Splash logo asset is missing or empty.');

  assert(/^com\.hellowhen\.[a-z0-9_]+$/.test(app.ios?.bundleIdentifier ?? ''), 'iOS bundleIdentifier must be a production Hellowhen identifier.');
  assert(/^com\.hellowhen\.[a-z0-9_]+$/.test(app.android?.package ?? ''), 'Android package must be a production Hellowhen identifier.');
  assert(!/(example|sample|test|dev)/i.test(app.ios?.bundleIdentifier ?? ''), 'iOS bundleIdentifier must not look like a placeholder.');
  assert(!/(example|sample|test|dev)/i.test(app.android?.package ?? ''), 'Android package must not look like a placeholder.');

  assert(app.ios?.config?.usesNonExemptEncryption === false, 'iOS export compliance flag should be explicit while no custom non-exempt encryption is added.');
  assert(typeof app.ios?.infoPlist?.NSPhotoLibraryUsageDescription === 'string' && app.ios.infoPlist.NSPhotoLibraryUsageDescription.length >= 40, 'iOS photo-library permission copy must explain why Hellowhen accesses selected photos.');
  console.log('Mobile store metadata: PASS');
}

function runPermissionAndSdkChecks() {
  const app = readJson('apps/mobile/app.json').expo;
  const appConfigText = read('apps/mobile/app.json');
  const androidPermissions = app.android?.permissions ?? [];
  const blockedAndroidPermissions = ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'READ_CONTACTS', 'WRITE_CONTACTS'];
  for (const permission of blockedAndroidPermissions) {
    assert(!androidPermissions.includes(permission), `Android permission ${permission} must not be requested unless a reviewed store scope adds it.`);
  }

  for (const blockedInfoPlistKey of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSLocationWhenInUseUsageDescription', 'NSContactsUsageDescription', 'NSUserTrackingUsageDescription']) {
    assert(!appConfigText.includes(blockedInfoPlistKey), `${blockedInfoPlistKey} must not be declared before that capability/tracking scope exists.`);
  }

  assertPackageDoesNotDependOn('apps/mobile/package.json', [
    'expo-notifications',
    'react-native-push-notification',
    '@react-native-firebase/messaging',
    'react-native-google-mobile-ads',
    'expo-ads-admob',
    '@stripe/stripe-react-native',
    'expo-location',
    'expo-camera',
    'expo-contacts',
    'expo-tracking-transparency',
  ]);
  console.log('Mobile permissions / SDK scope: PASS');
}

function runAccountDeletionAndLegalChecks() {
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', "AccountDeletion: undefined", 'Account deletion route type must stay defined.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', '<Stack.Screen name="AccountDeletion" component={ProtectedAccountDeletionScreen} />', 'Account deletion route must stay reachable for logged-in users.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', "route: 'AccountDeletion'", 'Account hub must link to account deletion.');
  assertContains('apps/mobile/src/features/account/AccountDeletionScreen.tsx', 'api.account.requestDeletion', 'Account deletion screen must let users request deletion in-app.');
  assertContains('apps/mobile/src/features/account/AccountDeletionScreen.tsx', 'api.account.cancelDeletionRequest', 'Account deletion screen must let users cancel a pending request when supported.');
  assertContains('apps/mobile/src/features/account/AccountDeletionScreen.tsx', "navigation.navigate('SupportCenter')", 'Account deletion screen must link to support for privacy/account questions.');

  assertContains('packages/i18n/src/legalPolicies.ts', "['terms', 'privacy', 'safety', 'refundDispute']", 'Legal policy list must include terms, privacy, safety, and refund/dispute pages.');
  assertContains('apps/mobile/src/features/auth/LoginScreen.tsx', "navigation.navigate('LegalPolicy', { policy: 'terms' })", 'Register/login screen must link to Terms.');
  assertContains('apps/mobile/src/features/auth/LoginScreen.tsx', "navigation.navigate('LegalPolicy', { policy: 'privacy' })", 'Register/login screen must link to Privacy Policy.');
  assertContains('apps/mobile/src/features/settings/SettingsScreen.tsx', "navigation.navigate('LegalPolicy')", 'Settings must link to legal/privacy/safety policies.');
  assertContains('apps/mobile/src/features/auth/LoginScreen.tsx', 'acceptedTerms', 'Register flow must require policy acceptance.');
  assertContains('apps/mobile/src/features/auth/LoginScreen.tsx', 'ageConfirmed', 'Register flow must require 18+ confirmation.');
  console.log('Mobile account deletion / legal links: PASS');
}

function runUgcSafetyChecks() {
  assertContains('apps/mobile/src/components/ReportContentPanel.tsx', 'api.reports.create', 'Mobile report panel must submit reports through the reports API.');
  assertContains('apps/mobile/src/features/trade/TradeDetailScreen.tsx', '<ReportContentPanel targetType="trade"', 'Trade detail must expose report flow to non-owners.');
  assertContains('apps/mobile/src/features/users/PublicUserProfileScreen.tsx', '<ReportContentPanel targetType="profile"', 'Public profile must expose report flow.');
  assertContains('apps/mobile/src/features/trade/TradePublicDiscussionScreen.tsx', '<ReportContentPanel targetType="public_message"', 'Public messages must expose report flow.');
  assertContains('apps/mobile/src/features/account/SupportCenterScreen.tsx', 'api.support.createTicket', 'Mobile support center must let users contact support.');
  assertContains('apps/mobile/src/features/account/SupportCenterScreen.tsx', "navigation.navigate('LegalPolicy', { policy: 'safety' })", 'Support center must link to safety guidelines.');
  assertContains('apps/mobile/src/features/account/SupportCenterScreen.tsx', "navigation.navigate('LegalPolicy', { policy: 'refundDispute' })", 'Support center must link to dispute policy.');
  console.log('Mobile UGC safety/support flows: PASS');
}

function runReviewerReadinessChecks() {
  assertExists('docs/launch/mobile-launch-smoke-test.md', 'Manual mobile launch smoke checklist must exist.');
  assertExists('docs/launch/mobile-store-readiness-checklist.md', 'Mobile store-readiness checklist must exist.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'Reviewer account', 'Store checklist must include reviewer account preparation.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'Account deletion', 'Store checklist must include account deletion preparation.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'User-generated content', 'Store checklist must include UGC safety preparation.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'Data safety', 'Store checklist must include Google Play Data safety preparation.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'App privacy', 'Store checklist must include Apple App Privacy preparation.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'No wallet, payouts, paid helpers, Stripe, Airwallex, ads, push, email notifications, or Plans', 'Store checklist must keep hidden/future features out of first-launch review notes.');
  console.log('Mobile reviewer readiness docs: PASS');
}

function main() {
  runAppMetadataChecks();
  runPermissionAndSdkChecks();
  runAccountDeletionAndLegalChecks();
  runUgcSafetyChecks();
  runReviewerReadinessChecks();
  console.log('Mobile store-readiness static checks: PASS');
}

main();
