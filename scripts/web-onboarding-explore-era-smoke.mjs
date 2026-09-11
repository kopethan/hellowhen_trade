import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, fragment, label) {
  assert(source.includes(fragment), `${label}: missing ${fragment}`);
}

function assertExcludes(source, fragment, label) {
  assert(!source.includes(fragment), `${label}: unexpected ${fragment}`);
}

const localePaths = [
  'packages/i18n/src/locales/en/onboarding.ts',
  'packages/i18n/src/locales/fr/onboarding.ts',
  'packages/i18n/src/locales/es/onboarding.ts',
];
const localeSources = localePaths.map((path) => ({ path, source: read(path) }));

for (const { path, source } of localeSources) {
  assertIncludes(source, 'Explore', `${path} must teach Explore`);
  assertIncludes(source, 'globalAccountHub', `${path} must use the Account slide`);
  assertExcludes(source, 'globalMeHub', `${path} must not use the retired Me slide key`);
  assertExcludes(source, 'global-me-hub', `${path} must not reference the retired Me slide id`);
}

const stalePhrases = [
  'Trade, Plans, and Me',
  'Trade, Plans et Me',
  'Trade, Plans y Me',
  'Your activity lives in Me',
  'Votre activité vit dans Me',
  'Tu actividad vive en Me',
  'available from Me',
  'disponibles dans Me',
  'disponibles desde Me',
  'navigation, Me',
  'navegación, Me',
];
for (const phrase of stalePhrases) {
  for (const { path, source } of localeSources) {
    assertExcludes(source, phrase, `${path} stale onboarding copy`);
  }
}
console.log('Explore-era onboarding copy: PASS');

for (const path of [
  'apps/web/src/features/onboarding-guide/onboardingGuide.slides.ts',
  'apps/mobile/src/features/onboarding-guide/onboardingGuide.slides.ts',
]) {
  const source = read(path);
  assertIncludes(source, "| 'globalAccountHub'", `${path} Account slide key`);
  assertIncludes(source, "id: 'global-account'", `${path} Account slide id`);
  assertIncludes(source, "titleKey: 'onboarding.slides.globalAccountHub.title'", `${path} Account title key`);
  assertExcludes(source, 'globalMeHub', `${path} retired Me slide key`);
  assertExcludes(source, 'global-me-hub', `${path} retired Me slide id`);
}
console.log('Web/native onboarding slide parity: PASS');

const webAssets = read('apps/web/src/features/onboarding-guide/onboardingGuideAssets.ts');
assertIncludes(webAssets, "globalWelcome: { src: '/images/guides/light/plans-welcome-light.webp'", 'Web global welcome current artwork');
assertIncludes(webAssets, "globalWorlds: { src: '/images/guides/light/plans-discover-light.webp'", 'Web Explore-era worlds artwork');
assertIncludes(webAssets, "globalAccountHub: { src: '/onboarding/light/account-guide-light.webp'", 'Web Account artwork');
assertExcludes(webAssets, 'global-me-hub-light.webp', 'Web retired Me artwork');
assertExcludes(webAssets, 'global-me-hub-dark.webp', 'Web retired Me dark artwork');

const mobileAssets = read('apps/mobile/src/features/onboarding-guide/OnboardingSlideIllustration.tsx');
assertIncludes(mobileAssets, "globalWelcome: require('../../../assets/guides/light/plans-welcome-light.png')", 'Mobile global welcome current artwork');
assertIncludes(mobileAssets, "globalWorlds: require('../../../assets/guides/light/plans-discover-light.png')", 'Mobile Explore-era worlds artwork');
assertIncludes(mobileAssets, "globalAccountHub: require('../../../assets/onboarding/light/account-guide-light.jpg')", 'Mobile Account artwork');
assertExcludes(mobileAssets, 'global-me-hub-light.png', 'Mobile retired Me artwork');
assertExcludes(mobileAssets, 'global-me-hub-dark.png', 'Mobile retired Me dark artwork');
console.log('Explore-era onboarding artwork mapping: PASS');

const sharedNavigation = read('packages/shared/src/appNavigation.ts');
const mobileLaunchSmoke = read('scripts/mobile-launch-smoke.mjs');
assertIncludes(sharedNavigation, "normalAppNavItemIds = ['plans', 'explore', 'trade']", 'Shared Plans / Explore / Trade navigation');
assertIncludes(mobileLaunchSmoke, "normalAppNavItemIds = ['plans', 'explore', 'trade']", 'Mobile launch smoke current web navigation assertion');
assertExcludes(mobileLaunchSmoke, "normalAppNavItemIds = ['plans', 'me', 'trade']", 'Mobile launch smoke old web navigation assertion');
console.log('Onboarding/navigation contract alignment: PASS');

console.log('WEB-PARITY-FIX4 Explore-era onboarding migration smoke: PASS');
