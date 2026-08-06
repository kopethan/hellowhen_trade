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

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  assert(read(file).includes(needle), message);
}

function assertNotContains(file, needle, message = `${file} must not contain ${needle}`) {
  assert(!read(file).includes(needle), message);
}

function assertNonEmptyFile(relativePath, message = `${relativePath} must exist and be non-empty.`) {
  const absolutePath = path.join(root, relativePath);
  assert(existsSync(absolutePath), message);
  assert(statSync(absolutePath).size > 0, message);
}

function assertBefore(file, firstNeedle, secondNeedle, message) {
  const source = read(file);
  const firstIndex = source.indexOf(firstNeedle);
  const secondIndex = source.indexOf(secondNeedle);
  assert(firstIndex >= 0, `${file} must contain ${firstNeedle}`);
  assert(secondIndex >= 0, `${file} must contain ${secondNeedle}`);
  assert(firstIndex < secondIndex, message);
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

function runSubmittedBinaryConfigurationChecks() {
  const app = readJson('apps/mobile/app.json').expo;
  const eas = readJson('apps/mobile/eas.json');
  const production = eas.build?.production ?? {};
  const productionEnv = production.env ?? {};

  assert(app.name === 'Hellowhen', 'Submitted display name must stay Hellowhen.');
  assert(app.orientation === 'portrait', 'The submitted iOS UI is portrait-only; the device matrix must test that exact orientation.');
  assert(app.userInterfaceStyle === 'automatic', 'The submitted app must retain automatic light/dark appearance support.');
  assert(app.ios?.supportsTablet === false, 'This release intentionally runs as an iPhone app in iPad compatibility mode; do not silently change tablet support without full iPad QA.');
  assert(app.ios?.bundleIdentifier === 'com.hellowhen.app', 'The App Store build must use the production iOS bundle identifier.');
  assert(eas.cli?.appVersionSource === 'remote', 'EAS must use the remote App Store version/build source.');
  assert(production.autoIncrement === true, 'The EAS production profile must auto-increment the submitted build number.');
  assert(productionEnv.EXPO_PUBLIC_STORE_RELEASE === 'true', 'The EAS production profile must enable store-release mode.');
  assert(productionEnv.EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE === 'false', 'Feature flag diagnostics must stay hidden in the submitted build.');
  assertPublicHttpsUrl(productionEnv.EXPO_PUBLIC_API_URL, 'EAS production EXPO_PUBLIC_API_URL');
  assertPublicHttpsUrl(productionEnv.EXPO_PUBLIC_WEB_URL, 'EAS production EXPO_PUBLIC_WEB_URL');

  assertNonEmptyFile('apps/mobile/assets/icon.png', 'The shared app icon is missing or empty.');
  assertNonEmptyFile('apps/mobile/assets/ios-icon.png', 'The iOS app icon is missing or empty.');
  assertNonEmptyFile('apps/mobile/assets/splash-logo.png', 'The splash logo is missing or empty.');
  console.log('Submitted binary configuration: PASS');
}

function runFirstRejectionRegressionChecks() {
  const accountScreen = 'apps/mobile/src/features/account/AccountScreen.tsx';
  const plansScreen = 'apps/mobile/src/features/plans/PlansScreens.tsx';

  assertNotContains(accountScreen, "label={t('common.states.beta')}", 'The Me header must not restore the Beta badge shown in Apple review.');
  assertNotContains(accountScreen, 'web-header-beta-badge', 'Native Me must not contain a release-state badge borrowed from the web header.');
  assertContains(plansScreen, 'function showIosMapsProviderPicker', 'iOS must keep an explicit map-provider picker.');
  assertContains(plansScreen, 'https://maps.apple.com/?q=', 'Individual offline Places must keep Apple Maps search links.');
  assertContains(plansScreen, 'https://maps.apple.com/?daddr=', 'Plan route actions must keep Apple Maps directions links.');
  assertBefore(
    plansScreen,
    'text: options.appleLabel',
    'text: options.googleLabel',
    'Apple Maps must remain the first provider shown in the iOS action sheet.',
  );
  assertContains(plansScreen, "text: options.cancelLabel, style: 'cancel'", 'Cancelling the provider picker must leave the reviewer inside Hellowhen.');
  assertContains(plansScreen, "appleLabel: t('plans.detail.location.appleMaps')", 'Each eligible offline Place must offer Apple Maps.');
  assertContains(plansScreen, 'appleLabel: routeMaps.appleLabel', 'The Plan route action must offer Apple Maps.');
  console.log('Apple rejection regression guards: PASS');
}

function runIphoneAndIpadShellChecks() {
  const appShell = 'apps/mobile/src/App.tsx';
  const navigator = 'apps/mobile/src/navigation/RootNavigator.tsx';

  assertContains(appShell, '<GestureHandlerRootView style={{ flex: 1 }}>', 'The native app shell must fill the compatibility-mode viewport.');
  assertContains(appShell, '<SafeAreaProvider>', 'The native app shell must provide safe-area metrics on iPhone and iPad compatibility mode.');
  assertContains(navigator, 'const insets = useSafeAreaInsets();', 'The bottom navigation must read device safe-area insets.');
  assertContains(navigator, 'height: 70 + bottomInset', 'The bottom navigation must reserve the home-indicator inset.');
  assertContains(navigator, 'paddingBottom: bottomInset || 8', 'The bottom navigation must remain usable on devices with and without a home indicator.');
  assertContains(navigator, 'return auth.isAuthenticated ? <AccountScreen /> : <LoginScreen />;', 'The Me tab must open authentication directly for logged-out reviewers.');
  assertContains(navigator, 'normalAppNavItems.map', 'The submitted Plans / Me / Trade navigation must stay generated from the shared production nav definition.');
  console.log('iPhone / iPad compatibility shell: PASS');
}

function runReviewerJourneyRouteChecks() {
  const navigator = 'apps/mobile/src/navigation/RootNavigator.tsx';
  const requiredScreens = [
    '<Stack.Screen name="TradeTabs" component={TradeTabs} />',
    '<Stack.Screen name="TradeDetail" component={TradeDetailScreen} />',
    '<Stack.Screen name="Login" component={LoginScreen} />',
    '<Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />',
    '<Stack.Screen name="Notifications" component={ProtectedNotificationsScreen} />',
    '<Stack.Screen name="SupportCenter" component={ProtectedSupportCenterScreen} />',
    '<Stack.Screen name="SafetyCenter" component={ProtectedSafetyCenterScreen} />',
    '<Stack.Screen name="AccountDeletion" component={ProtectedAccountDeletionScreen} />',
    '<Stack.Screen name="TradePublicDiscussion" component={ProtectedTradePublicDiscussionScreen} />',
    '<Stack.Screen name="TradePrivateProposals" component={ProtectedTradePrivateProposalsScreen} />',
    '<Stack.Screen name="ProposalDetail" component={ProtectedProposalDetailScreen} />',
  ];

  for (const screen of requiredScreens) {
    assertContains(navigator, screen, `The App Review journey requires ${screen}.`);
  }

  assertContains(navigator, '{betaFeatures.plansEnabled ? <Stack.Screen name="PlanDetail" component={PlanDetailScreen} /> : null}', 'The production Plans flow must retain Plan Detail behind the reviewed Plans gate.');
  assertContains(navigator, '{betaFeatures.plansEnabled ? <Stack.Screen name="PlanPublicDiscussion" component={ProtectedPlanPublicDiscussionScreen} /> : null}', 'The production Plans flow must retain public discussion behind the reviewed Plans gate.');
  console.log('Reviewer journey routes: PASS');
}

function runReviewEvidenceChecklistChecks() {
  const checklist = 'docs/launch/appstore26-ios-device-review-smoke.md';
  assertNonEmptyFile(checklist, 'The App Store iPhone/iPad device checklist is missing.');
  assertContains(checklist, 'iPad Air 11-inch (M3)', 'The checklist must replay the device used for the rejected build.');
  assertContains(checklist, 'build 25 rejection regression', 'The checklist must include an explicit rejection-regression pass.');
  assertContains(checklist, 'Apple Maps', 'The checklist must cover Apple Maps on device.');
  assertContains(checklist, 'No Beta badge', 'The checklist must verify the removed Me badge visually.');
  assertContains(checklist, 'Exact submitted binary', 'The checklist must forbid signing off from Expo Go or a different build.');
  assertContains(checklist, 'Stop submission', 'The checklist must define stop-ship failures.');
  assertContains(checklist, 'Evidence record', 'The checklist must capture device/build evidence.');
  console.log('App Review evidence checklist: PASS');
}

function main() {
  runSubmittedBinaryConfigurationChecks();
  runFirstRejectionRegressionChecks();
  runIphoneAndIpadShellChecks();
  runReviewerJourneyRouteChecks();
  runReviewEvidenceChecklistChecks();
  console.log('APPSTORE26-QA1 static App Review smoke: PASS');
  console.log('Manual iPhone and iPad checks are still required on the exact submitted binary.');
}

main();
