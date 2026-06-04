#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExists(relativePath, message = `${relativePath} is missing.`) {
  assert(existsSync(path.join(root, relativePath)), message);
}

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  assert(read(file).includes(needle), message);
}

function assertNotContains(file, needle, message = `${file} must not contain ${needle}`) {
  assert(!read(file).includes(needle), message);
}

function assertEnvDefault(file, key, expected) {
  const env = read(file);
  const pattern = new RegExp(`^${key}=${expected}$`, 'm');
  assert(pattern.test(env), `${file} must keep ${key}=${expected} for first launch/store review.`);
}

function assertPackageDoesNotDependOn(packageJsonPath, blockedDependencies) {
  const pkg = JSON.parse(read(packageJsonPath));
  const allDependencies = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };

  for (const dependency of blockedDependencies) {
    assert(!(dependency in allDependencies), `${packageJsonPath} must not depend on ${dependency} while Cash Promise is not an in-app payment feature.`);
  }
}

function runEnvGuards() {
  assertEnvDefault('.env.example', 'CASH_PROMISE_ENABLED', 'false');
  assertEnvDefault('.env.example', 'CASH_PROMISE_VISIBLE', 'false');
  assertEnvDefault('.env.example', 'NEXT_PUBLIC_CASH_PROMISE_ENABLED', 'false');
  assertEnvDefault('.env.example', 'NEXT_PUBLIC_CASH_PROMISE_VISIBLE', 'false');
  assertEnvDefault('.env.example', 'EXPO_PUBLIC_CASH_PROMISE_ENABLED', 'false');
  assertEnvDefault('.env.example', 'EXPO_PUBLIC_CASH_PROMISE_VISIBLE', 'false');
  assertEnvDefault('apps/mobile/.env.example', 'EXPO_PUBLIC_CASH_PROMISE_ENABLED', 'false');
  assertEnvDefault('apps/mobile/.env.example', 'EXPO_PUBLIC_CASH_PROMISE_VISIBLE', 'false');

  assertContains('apps/api/src/config/env.ts', "publicFlagEnabled('NEXT_PUBLIC_CASH_PROMISE_ENABLED')", 'Production env guard must reject enabled web Cash Promise flags.');
  assertContains('apps/api/src/config/env.ts', "publicFlagEnabled('EXPO_PUBLIC_CASH_PROMISE_ENABLED')", 'Production env guard must reject enabled native Cash Promise flags.');
  assertContains('apps/api/src/config/env.ts', 'env.cashPromiseEnabled', 'Production env guard must reject server Cash Promise flags.');
  assertContains('apps/api/src/config/env.ts', 'Money, wallet, payout, cash-trade, Cash Promise, and money-trade flags must stay disabled/hidden for first launch.', 'Production env guard error must explicitly mention Cash Promise.');

  assertContains('apps/web/src/lib/betaFeatures.tsx', 'forceFirstLaunchSafeFlags', 'Web feature flags must force first-launch safety in production.');
  assertContains('apps/mobile/src/lib/betaFeatures.ts', 'forceFirstLaunchSafeFlags', 'Mobile feature flags must force first-launch safety in production.');
  assertContains('apps/web/src/lib/betaFeatures.tsx', 'cashPromiseEnabled: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_CASH_PROMISE_ENABLED)', 'Web Cash Promise UI must remain nested behind the money visibility gate.');
  assertContains('apps/mobile/src/lib/betaFeatures.ts', 'cashPromiseEnabled: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_CASH_PROMISE_ENABLED)', 'Mobile Cash Promise UI must remain nested behind the money visibility gate.');
  console.log('Cash Promise env/feature-flag guards: PASS');
}

function runBackendGuards() {
  assertContains('apps/api/src/modules/cash-promise/cashPromise.ts', 'env.cashPromiseEnabled && env.cashPromiseVisible && env.moneyFeaturesVisible', 'Cash Promise backend enablement must require all hidden flags plus money visibility.');
  assertContains('apps/api/src/modules/cash-promise/cashPromise.ts', 'cash_promise_disabled', 'Cash Promise backend must return a disabled error while hidden.');
  assertContains('apps/api/src/modules/cash-promise/cashPromise.ts', 'Hellowhen does not process, hold, protect, refund, or guarantee outside-app cash.', 'Backend disabled copy must avoid in-app payment protection language.');
  assertContains('apps/api/src/modules/trades/trades.routes.ts', 'validateCashPromiseInput(input.cashPromise', 'Trade creation must validate Cash Promise through the guard helper.');
  assertContains('apps/api/src/modules/proposals/proposals.routes.ts', 'validateCashPromiseInput(input.cashPromise', 'Proposal updates must validate Cash Promise through the guard helper.');
  assertNotContains('apps/api/src/modules/cash-promise/cashPromise.ts', 'stripe', 'Cash Promise helper must not call Stripe.');
  assertNotContains('apps/api/src/modules/cash-promise/cashPromise.ts', 'airwallex', 'Cash Promise helper must not call Airwallex.');
  console.log('Cash Promise backend guards: PASS');
}

function runCopyGuards() {
  const acknowledgement = 'Cash is arranged outside Hellowhen. Hellowhen does not process, hold, protect, refund, or guarantee this cash promise.';
  assertContains('packages/contracts/src/trade.ts', `CASH_PROMISE_ACKNOWLEDGEMENT_TEXT = '${acknowledgement}'`, 'Shared Cash Promise acknowledgement copy must stay explicit.');
  assertContains('packages/i18n/src/locales/en/trade.ts', 'Hellowhen does not process, hold, protect, refund, or guarantee this cash.', 'English Cash Promise warning must be explicit.');
  assertContains('packages/i18n/src/locales/en/trade.ts', 'Not processed by Hellowhen', 'English Cash Promise chip must say it is not processed by Hellowhen.');
  assertContains('packages/i18n/src/locales/fr/trade.ts', 'Hellowhen ne traite pas, ne détient pas, ne protège pas, ne rembourse pas et ne garantit pas cet argent.', 'French Cash Promise warning must be explicit.');
  assertContains('packages/i18n/src/locales/fr/trade.ts', 'Non traité par Hellowhen', 'French Cash Promise chip must say it is not processed by Hellowhen.');
  assertNotContains('packages/i18n/src/locales/en/trade.ts', 'Cash payment protected', 'Cash Promise copy must not imply protected payment.');
  assertNotContains('packages/i18n/src/locales/fr/trade.ts', 'paiement protégé', 'Cash Promise copy must not imply protected payment.');
  console.log('Cash Promise safety copy guards: PASS');
}

function runSdkGuards() {
  const blockedDependencies = [
    '@stripe/stripe-react-native',
    '@stripe/stripe-js',
    '@stripe/react-stripe-js',
    'stripe',
    'react-native-google-mobile-ads',
    'expo-ads-admob',
    'expo-tracking-transparency',
  ];
  assertPackageDoesNotDependOn('apps/mobile/package.json', blockedDependencies);
  assertPackageDoesNotDependOn('apps/web/package.json', blockedDependencies.filter((dependency) => dependency !== '@stripe/stripe-react-native'));
  console.log('Cash Promise no payment/ad/tracking SDK guard: PASS');
}

function runStoreDocsGuards() {
  assertExists('docs/launch/cash-promise-store-safety-checklist.md', 'Cash Promise store/safety checklist must exist.');
  assertContains('docs/launch/cash-promise-store-safety-checklist.md', 'Cash Promise is hidden by default', 'Cash Promise checklist must document hidden default.');
  assertContains('docs/launch/cash-promise-store-safety-checklist.md', 'Hellowhen does not process, hold, protect, refund, or guarantee cash', 'Cash Promise checklist must document outside-app limitation.');
  assertContains('docs/launch/cash-promise-store-safety-checklist.md', 'No wallet, payout, escrow, checkout, Stripe, Airwallex, payment SDK, or protected-payment wording', 'Cash Promise checklist must forbid payment/wallet language.');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'Cash Promise store/safety checklist', 'Mobile store checklist must reference the Cash Promise checklist.');
  assertContains('docs/launch/app-store-google-play-review-notes.md', 'Cash Promise is hidden and disabled for first launch', 'Store review notes must explicitly state Cash Promise is hidden and disabled.');
  console.log('Cash Promise store/review docs guards: PASS');
}

function main() {
  runEnvGuards();
  runBackendGuards();
  runCopyGuards();
  runSdkGuards();
  runStoreDocsGuards();
  console.log('Cash Promise store/safety static checks: PASS');
}

main();
