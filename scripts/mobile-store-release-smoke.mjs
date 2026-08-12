#!/usr/bin/env node

import { readFileSync } from 'node:fs';
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

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  assert(read(file).includes(needle), message);
}

function assertProductionEnvValue(env, key, expected) {
  assert(env[key] === expected, `apps/mobile/eas.json production env must keep ${key}=${expected}. Found ${env[key] ?? '(unset)'}.`);
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
  assert(!/^10\./.test(parsed.hostname) && !/^192\.168\./.test(parsed.hostname) && !/^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname), `${label} must not point to a private LAN address.`);
}

function runEasProductionProfileChecks() {
  const eas = readJson('apps/mobile/eas.json');
  const env = eas.build?.production?.env ?? {};

  const releaseValues = {
    EXPO_PUBLIC_STORE_RELEASE: 'true',
    EXPO_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED: 'true',
    EXPO_PUBLIC_PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS: 'true',
    EXPO_PUBLIC_PLANS_ENABLED: 'true',
    EXPO_PUBLIC_PLANS_VISIBLE: 'true',
    EXPO_PUBLIC_MAIN_NAV_PLANS_ME_TRADE: 'true',
    EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE: 'false',
  };
  for (const [key, expected] of Object.entries(releaseValues)) assertProductionEnvValue(env, key, expected);

  const falseFlags = [
    'EXPO_PUBLIC_MONEY_FEATURES_VISIBLE',
    'EXPO_PUBLIC_WALLET_VISIBLE',
    'EXPO_PUBLIC_PAYOUTS_VISIBLE',
    'EXPO_PUBLIC_MONEY_TRADES_ENABLED',
    'EXPO_PUBLIC_CASH_TRADES_ENABLED',
    'EXPO_PUBLIC_CASH_PROMISE_ENABLED',
    'EXPO_PUBLIC_CASH_PROMISE_VISIBLE',
    'EXPO_PUBLIC_ADS_ENABLED',
    'EXPO_PUBLIC_MOBILE_ADS_ENABLED',
    'EXPO_PUBLIC_ADS_DEBUG_PLACEHOLDERS',
    'EXPO_PUBLIC_AI_ENABLED',
    'EXPO_PUBLIC_AI_MODERATION_ENABLED',
    'EXPO_PUBLIC_AI_SUGGESTIONS_ENABLED',
    'EXPO_PUBLIC_AI_ADMIN_ASSIST_ENABLED',
    'EXPO_PUBLIC_AI_SAFETY_CLASSIFIER_ENABLED',
    'EXPO_PUBLIC_AI_DEBUG_PLACEHOLDERS',
    'EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED',
    'EXPO_PUBLIC_PLUS_ENABLED',
    'EXPO_PUBLIC_PLUS_PUBLIC',
    'EXPO_PUBLIC_AI_ASSIST_ENABLED',
    'EXPO_PUBLIC_PLUS_CUSTOMIZATION_ENABLED',
    'EXPO_PUBLIC_SAVED_LIBRARY_ENABLED',
    'EXPO_PUBLIC_SAVED_COLLECTIONS_ENABLED',
    'EXPO_PUBLIC_AGENDA_ENABLED',
    'EXPO_PUBLIC_INVENTORY_FOLDERS_ENABLED',
    'EXPO_PUBLIC_PRO_ACCOUNTS_ENABLED',
    'EXPO_PUBLIC_PRO_ACCOUNTS_VISIBLE',
    'EXPO_PUBLIC_PRO_TRIALS_ENABLED',
    'EXPO_PUBLIC_IDENTITY_VERIFICATION_ENABLED',
    'EXPO_PUBLIC_PRO_TRADE_PACKAGES_ENABLED',
    'EXPO_PUBLIC_PRO_TRADE_PACKAGES_VISIBLE',
    'EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE',
    'EXPO_PUBLIC_IOS_STOREKIT_MEMBERSHIP_ENABLED',
    'EXPO_PUBLIC_ANDROID_GOOGLE_PLAY_MEMBERSHIP_ENABLED',
    'EXPO_PUBLIC_IOS_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED',
    'EXPO_PUBLIC_ANDROID_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED',
    'EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED',
    'EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE',
    'EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED',
    'EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED',
    'EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED',
  ];
  for (const key of falseFlags) assertProductionEnvValue(env, key, 'false');

  assertProductionEnvValue(env, 'EXPO_PUBLIC_MONEY_PROVIDER', 'none');
  assertProductionEnvValue(env, 'EXPO_PUBLIC_ADS_PROVIDER', 'none');
  assertProductionEnvValue(env, 'EXPO_PUBLIC_AI_PROVIDER', 'none');
  assertPublicHttpsUrl(env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL');
  assertPublicHttpsUrl(env.EXPO_PUBLIC_WEB_URL, 'EXPO_PUBLIC_WEB_URL');
  console.log('EAS production release profile: PASS');
}

function runRuntimeGateChecks() {
  assertContains('apps/mobile/src/lib/betaFeatures.ts', "const storeReleaseMode = enabled(process.env.EXPO_PUBLIC_STORE_RELEASE);", 'Native feature gates must read the explicit EAS store-release flag.');
  assertContains('apps/mobile/src/lib/betaFeatures.ts', "const forceFirstLaunchSafeFlags = storeReleaseMode ||", 'Native store-release mode must force first-launch safety flags.');
  assertContains('apps/mobile/src/lib/betaFeatures.ts', 'mobileDiagnosticsVisible', 'Native diagnostics must have a dedicated release-safe gate.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'const showFlagDiagnostics = betaFeatures.mobileDiagnosticsVisible;', 'The Me screen must never auto-show diagnostics because a feature is hidden.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.savedLibraryEnabled ? <Stack.Screen name="SavedLibrary"', 'Saved Library route must stay unregistered while hidden.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.savedCollectionsEnabled ? <Stack.Screen name="SavedLibraryCollection"', 'Saved collection routes must stay unregistered while hidden.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.agendaEnabled ? <Stack.Screen name="Agenda"', 'Agenda route must stay unregistered while hidden.');

  assertContains('apps/web/src/lib/betaFeatures.tsx', "const storeReleaseMode = enabled(process.env.NEXT_PUBLIC_STORE_RELEASE);", 'Web feature gates must read the explicit release flag.');
  assertContains('apps/web/src/lib/betaFeatures.tsx', "const forceFirstLaunchSafeFlags = storeReleaseMode ||", 'Web release mode must force first-launch safety flags.');
  assertContains('apps/web/src/lib/demoMode.ts', "if (storeReleaseMode || process.env.NODE_ENV === 'production') return false;", 'Public web production must never fall back to mock/demo inventory or trades.');
  console.log('Client runtime release gates: PASS');
}

function runAppleMapsParityChecks() {
  const plansScreen = read('apps/mobile/src/features/plans/PlansScreens.tsx');
  const englishPlans = read('packages/i18n/src/locales/en/plans.ts');
  const frenchPlans = read('packages/i18n/src/locales/fr/plans.ts');
  const spanishPlans = read('packages/i18n/src/locales/es/plans.ts');

  assert(plansScreen.includes('function buildAppleMapsSearchUrl'), 'Native Plans must build Apple Maps place links.');
  assert(plansScreen.includes('function buildAppleMapsDirectionsUrl'), 'Native Plans must build Apple Maps route links.');
  assert(plansScreen.includes('https://maps.apple.com/?q='), 'Native Plans must use the public Apple Maps search URL.');
  assert(plansScreen.includes('https://maps.apple.com/?daddr='), 'Multi-stop Plans must open Apple Maps toward the first available offline stop.');
  assert(!plansScreen.includes('https://maps.apple.com/?saddr='), 'Apple Maps must not imply that a first-to-last link represents the complete multi-stop Plan route.');
  assert(plansScreen.includes('const offlinePlaces = places.filter(isOfflinePlanPlace);'), 'Plan routing must explicitly exclude online Places.');
  assert(plansScreen.includes('const includedStops = routeStops.slice(0, GOOGLE_MAPS_MAX_ROUTE_STOPS);'), 'Plan routing must preserve ordered mapped stops and keep the external route limit.');
  assert(plansScreen.includes('skippedMissingLocationCount'), 'Plan routing must disclose offline Places that have no mappable location.');
  assert(plansScreen.includes('appleLabel: routeMaps.appleLabel'), 'Multi-stop Plan routes must use the Apple Maps first-stop label.');
  assert(plansScreen.includes("appleLabel: t('plans.detail.location.appleMaps')"), 'Offline Place actions must offer Apple Maps on iOS.');
  assert(plansScreen.includes('googleLabel: routeMaps.googleLabel'), 'Multi-stop Plan routes must distinguish the Google Maps Plan route.');
  assert(englishPlans.includes("appleMapsFirstStop: 'Apple Maps (first stop)'"), 'English copy must explain the Apple Maps first-stop behavior.');
  assert(frenchPlans.includes("appleMapsFirstStop: 'Plans d’Apple (première étape)'"), 'French copy must explain the Apple Maps first-stop behavior.');
  assert(spanishPlans.includes("appleMapsFirstStop: 'Mapas de Apple (primera parada)'"), 'Spanish copy must explain the Apple Maps first-stop behavior.');
  assert(englishPlans.includes('skippedMissingLocationOne'), 'English route copy must disclose unmappable offline Places.');
  assert(frenchPlans.includes('skippedMissingLocationOne'), 'French route copy must disclose unmappable offline Places.');
  assert(spanishPlans.includes('skippedMissingLocationOne'), 'Spanish route copy must disclose unmappable offline Places.');
  assert(!englishPlans.includes('Open route in Google Maps'), 'English Plan route actions must not be Google-only.');
  assert(!frenchPlans.includes('Ouvrir le parcours dans Google Maps'), 'French Plan route actions must not be Google-only.');
  assert(!spanishPlans.includes('Abrir ruta en Google Maps'), 'Spanish Plan route actions must not be Google-only.');
  console.log('Apple Maps provider parity: PASS');
}

function runLocalizationChecks() {
  const mobileApp = readJson('apps/mobile/app.json');
  const infoPlist = mobileApp.expo?.ios?.infoPlist ?? {};
  const localizations = infoPlist.CFBundleLocalizations;

  assert(infoPlist.CFBundleDevelopmentRegion === 'fr', 'iOS development region must remain French for unsupported-language fallback.');
  assert(Array.isArray(localizations), 'iOS CFBundleLocalizations must explicitly declare supported languages.');
  assert(JSON.stringify(localizations) === JSON.stringify(['fr', 'en', 'es']), 'iOS CFBundleLocalizations must declare fr, en, es in the release config.');

  const languages = read('packages/i18n/src/languages.ts');
  assert(languages.includes("export const supportedLanguages = ['en', 'fr', 'es'] as const;"), 'Shared runtime must continue supporting English, French, and Spanish.');
  assert(languages.includes("export const defaultLanguage: SupportedLanguage = 'fr';"), 'Unsupported/system language fallback must remain French.');
  assert(languages.includes("export const defaultLanguagePreference: LanguagePreference = 'system';"), 'Default preference must remain system-based.');
  assert(languages.includes("if (normalizedPreference !== 'system') return normalizedPreference;"), 'Explicit saved language choices must continue to override device language detection.');
  assert(languages.includes('for (const candidate of localeCandidates)'), 'System preference must continue checking device language candidates.');
  assert(languages.includes('return defaultLanguage;'), 'Unsupported device languages must resolve through the shared French fallback.');

  const mobileSettings = read('apps/mobile/src/providers/AppSettingsProvider.tsx');
  assert(mobileSettings.includes("const SETTINGS_STORAGE_KEY = 'hellowhen_app_settings_v1';"), 'Native saved settings storage key must remain unchanged.');
  assert(mobileSettings.includes("language: 'system',"), 'New/default settings must continue following the device language.');
  assert(mobileSettings.includes("contentLanguageOrder: ['en'],"), 'APPSTORE-I18N1 must not change user-generated content language ordering.');

  const nativeProvider = read('apps/mobile/src/providers/MobileI18nProvider.tsx');
  assert(nativeProvider.includes('createTranslator(defaultLanguage)'), 'Native context fallback translator must use the shared default language.');
  assert(nativeProvider.includes('resolveLanguage(settings.language, deviceLanguages)'), 'Native runtime must keep resolving saved preference against device languages.');

  const webProvider = read('apps/web/src/providers/WebI18nProvider.tsx');
  assert(webProvider.includes('createTranslator(defaultLanguage)'), 'Web context fallback translator must use the same shared default language.');
  assert(webProvider.includes('resolveLanguage(settings.language, browserLanguages)'), 'Web runtime must keep resolving saved preference against browser languages.');

  console.log('Native/App Store language declarations and fallback: PASS');
}

function runExampleEnvChecks() {
  assertContains('.env.example', 'NEXT_PUBLIC_STORE_RELEASE=false', 'Root env example must document the web release flag.');
  assertContains('.env.example', 'EXPO_PUBLIC_STORE_RELEASE=false', 'Root env example must document the native release flag.');
  assertContains('apps/mobile/.env.example', 'EXPO_PUBLIC_STORE_RELEASE=false', 'Native local env example must keep store-release mode off outside EAS production.');
  assertContains('apps/mobile/.env.example', 'EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE=false', 'Native diagnostics must default off.');
  console.log('Release env examples: PASS');
}

function main() {
  runEasProductionProfileChecks();
  runRuntimeGateChecks();
  runAppleMapsParityChecks();
  runLocalizationChecks();
  runExampleEnvChecks();
  console.log('Mobile store-release hardening smoke: PASS');
}

main();
