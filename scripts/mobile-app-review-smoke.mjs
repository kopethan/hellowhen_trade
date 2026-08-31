#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n?/g, '\n');
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

  assertNotContains(accountScreen, "label={t('common.states.beta')}", 'The Account header must not restore the Beta badge shown in Apple review.');
  assertNotContains(accountScreen, 'web-header-beta-badge', 'Native Account must not contain a release-state badge borrowed from the web header.');
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
  assertContains(navigator, 'explore: ExploreScreen', 'The center mobile tab must open the public Explore surface.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "navigation.navigate('Account')", 'Explore must keep Account/login reachable from the primary header.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'api.notifications.unreadCount()', 'The submitted primary Account control must retain its unread notification indicator.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', '<UserAvatar', 'The submitted primary Account control must reuse the authenticated profile avatar when available.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'requestId === requestSequence', 'The Account unread badge refresh must ignore stale overlapping responses.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'Math.max(0, Math.trunc(response.unreadCount ?? 0))', 'The Account unread badge must normalize API counts before rendering.');
  assertNotContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'if (active) setUnreadCount(0);', 'A transient unread-count refresh failure must not erase the last known Account badge.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<FlatList', 'The submitted Explore surface must render independent concepts as a virtualized vertical feed.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "kind: 'trade'", 'The submitted Explore surface must keep Trade ideas as independent concepts.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "kind: 'plan'", 'The submitted Explore surface must keep Plan ideas as independent concepts.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'moveIdea(', 'The submitted Explore surface must not use global previous/next Trade idea controls.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'movePlanIdea(', 'The submitted Explore surface must not use global previous/next Plan idea controls.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'deckControls', 'The submitted Explore surface must not restore global concept navigation buttons.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<AppText accessibilityRole="header" style={styles.title}>', 'The submitted Explore surface must keep a semantic page heading after discovery concepts are mixed.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'buildBalancedMixedFeed(', 'The submitted Explore surface must keep the balanced mixed discovery feed.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'minHeight: MOBILE_TRADE_DECK_AVAILABLE_HEIGHT', 'The submitted Explore surface must not reserve an extra empty deck stage around every concept.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<AppSmartHeaderScreen header={header} resetKey={typeFilter}>', 'The submitted Explore surface must restore its header on upward scrolling without changing other primary headers.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '...scrollProps.scrollViewProps', 'The submitted Explore feed must drive the direction-aware header from its FlatList scroll events.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'icon="filter"', 'The submitted Explore header must keep its dedicated filter control.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<LibraryFilterScreen', 'The submitted Explore filter must reuse the production full-screen filter UI.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'nextConceptDeck: { marginTop: MOBILE_DECK_FEED_GAP }', 'The submitted Explore surface must keep the shared mobile deck feed gap.');
  assertContains('packages/shared/src/appNavigation.ts', "icon: 'compass',\n    mobileTabName: 'ExploreTab'", 'The submitted Explore tab must use the dedicated compass icon.');
  assertContains('apps/mobile/src/components/MobileIcon.tsx', "case 'compass':", 'The submitted binary must keep the dedicated Explore compass glyph.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<AccountHeaderActionButton', 'Explore must use the shared primary Account control.');
  assertContains('apps/mobile/src/features/plans/PlansScreens.tsx', '<AccountHeaderActionButton', 'Plans must use the shared primary Account control.');
  assertContains('apps/mobile/src/features/trade/TradeDeckFeedScreen.tsx', '<AccountHeaderActionButton', 'Trade must use the shared primary Account control.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<PlanSquareDeck', 'The submitted Explore surface must keep Plan ideas on the production Plan deck system.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "navigation.navigate('PlanIdeaDetail'", 'The submitted Explore Plan ideas must keep their review/customize detail route.');
  assertContains(navigator, 'normalMobileAppNavItems.map', 'The submitted mobile navigation must stay generated from the mobile-specific production nav definition.');
  console.log('iPhone / iPad compatibility shell: PASS');
}

function runReviewerJourneyRouteChecks() {
  const navigator = 'apps/mobile/src/navigation/RootNavigator.tsx';
  const requiredScreens = [
    '<Stack.Screen name="TradeTabs" component={TradeTabs} />',
    '<Stack.Screen name="Account" component={ProtectedAccountScreen} />',
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
  const checklist = 'docs/launch/mobile-102-ios-device-release-smoke.md';
  assertNonEmptyFile(checklist, 'The App Store iPhone/iPad device checklist is missing.');
  assertContains(checklist, 'iPad Air 11-inch (M3)', 'The checklist must replay the device used for the rejected build.');
  assertContains(checklist, 'APPSTORE26 rejection regressions', 'The checklist must include explicit rejection-regression coverage.');
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
  console.log('RELEASE-METADATA1 1.0.2 static App Review smoke: PASS');
  console.log('Manual iPhone and iPad checks are still required on the exact submitted binary.');
}

main();
