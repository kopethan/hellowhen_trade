#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n?/g, '\n');
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

function assertEnvDefault(file, key, expected) {
  const env = read(file);
  const pattern = new RegExp(`^${key}=${expected}$`, 'm');
  assert(pattern.test(env), `${file} must keep ${key}=${expected} for first launch.`);
}

function collectFiles(dir, result = []) {
  for (const entry of readdirSync(path.join(root, dir))) {
    const relativePath = path.join(dir, entry).replaceAll('\\\\', '/');
    const absolutePath = path.join(root, relativePath);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) collectFiles(relativePath, result);
    else result.push(relativePath);
  }
  return result;
}

function assertPackageDoesNotDependOn(packageJsonPath, blockedDependencies) {
  const pkg = JSON.parse(read(packageJsonPath));
  const allDependencies = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };

  for (const dependency of blockedDependencies) {
    assert(!(dependency in allDependencies), `${packageJsonPath} must not depend on ${dependency} for the first mobile launch.`);
  }
}

function runFirstLaunchEnvChecks() {
  const envFiles = ['.env.example', 'apps/mobile/.env.example'];
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
    'EXPO_PUBLIC_AI_ENABLED',
    'EXPO_PUBLIC_AI_MODERATION_ENABLED',
    'EXPO_PUBLIC_AI_SUGGESTIONS_ENABLED',
    'EXPO_PUBLIC_AI_ADMIN_ASSIST_ENABLED',
    'EXPO_PUBLIC_AI_SAFETY_CLASSIFIER_ENABLED',
    'EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED',
    'EXPO_PUBLIC_PRO_ACCOUNTS_ENABLED',
    'EXPO_PUBLIC_PRO_ACCOUNTS_VISIBLE',
    'EXPO_PUBLIC_PRO_TRIALS_ENABLED',
    'EXPO_PUBLIC_PRO_TRADE_PACKAGES_ENABLED',
    'EXPO_PUBLIC_PRO_TRADE_PACKAGES_VISIBLE',
  ];
  const noneFlags = ['EXPO_PUBLIC_MONEY_PROVIDER', 'EXPO_PUBLIC_ADS_PROVIDER', 'EXPO_PUBLIC_AI_PROVIDER'];

  for (const envFile of envFiles) {
    assert(existsSync(path.join(root, envFile)), `${envFile} is missing.`);
    for (const key of falseFlags) assertEnvDefault(envFile, key, 'false');
    for (const key of noneFlags) assertEnvDefault(envFile, key, 'none');
  }

  assertEnvDefault('.env.example', 'EXPO_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED', 'true');
  for (const envFile of envFiles) {
    assertEnvDefault(envFile, 'EXPO_PUBLIC_PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS', 'true');
    assertEnvDefault(envFile, 'EXPO_PUBLIC_PLANS_ENABLED', 'true');
    assertEnvDefault(envFile, 'EXPO_PUBLIC_PLANS_VISIBLE', 'true');
    assertEnvDefault(envFile, 'EXPO_PUBLIC_MAIN_NAV_PLANS_ME_TRADE', 'true');
    assertEnvDefault(envFile, 'EXPO_PUBLIC_MOBILE_FLAG_DIAGNOSTICS_VISIBLE', 'false');
  }
  console.log('Mobile public-release env flags: PASS');
}

function runNavigationChecks() {
  const sharedNavigation = read('packages/shared/src/appNavigation.ts');
  const nativeSourceFiles = collectFiles('apps/mobile/src').filter((file) => /\.(tsx?|jsx?)$/.test(file));
  const bottomTabNavigatorDeclarations = [];

  for (const file of nativeSourceFiles) {
    const content = read(file);
    const declarationPattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*createBottomTabNavigator\s*(?:<[^>]+>)?\s*\(/g;
    for (const match of content.matchAll(declarationPattern)) {
      bottomTabNavigatorDeclarations.push({ file: file.replaceAll('\\', '/'), variableName: match[1] });
    }
  }

  assert(
    bottomTabNavigatorDeclarations.length === 1
      && bottomTabNavigatorDeclarations[0].file === 'apps/mobile/src/navigation/RootNavigator.tsx',
    `Native mobile must keep exactly one bottom-tab navigator in RootNavigator.tsx. Found: ${bottomTabNavigatorDeclarations.map(({ file, variableName }) => `${file}:${variableName}`).join(', ') || '(none)'}.`,
  );

  const configuredMobileTabNames = [...sharedNavigation.matchAll(/mobileTabName:\s*'([^']+)'/g)].map((match) => match[1]);
  const expectedMobileTabNames = ['PlanTab', 'ExploreTab', 'TradeTab'];
  assert(
    JSON.stringify(configuredMobileTabNames) === JSON.stringify(expectedMobileTabNames),
    `Shared mobile primary tabs must be exactly ${expectedMobileTabNames.join(' / ')}. Found: ${configuredMobileTabNames.join(', ') || '(none)'}.`,
  );

  const forbiddenPrimaryTabNames = ['Me', 'MeTab', 'Need', 'Needs', 'Offer', 'Offers', 'Account', 'NeedTab', 'NeedsTab', 'OfferTab', 'OffersTab', 'AccountTab'];
  const [{ file: bottomTabFile, variableName: bottomTabVariableName }] = bottomTabNavigatorDeclarations;
  const bottomTabSource = read(bottomTabFile);
  for (const tabName of forbiddenPrimaryTabNames) {
    const literalPrimaryTabPattern = new RegExp(`<${bottomTabVariableName}\\.Screen\\b[^>]*\\bname\\s*=\\s*["']${tabName}["']`);
    assert(!configuredMobileTabNames.includes(tabName) && !literalPrimaryTabPattern.test(bottomTabSource), `Legacy primary tab ${tabName} must not be registered.`);
  }

  assertContains('packages/shared/src/appNavigation.ts', "normalAppNavItemIds = ['plans', 'me', 'trade']", 'Web public navigation must stay Plans / Me / Trade during the mobile Explore migration.');
  assertContains('packages/shared/src/appNavigation.ts', "normalMobileAppNavItemIds = ['plans', 'explore', 'trade']", 'Mobile primary navigation must be Plans / Explore / Trade.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'normalMobileAppNavItems.map((item)', 'Native bottom tabs must be generated from the mobile-specific navigation contract.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'initialRouteName={DEFAULT_NORMAL_MOBILE_APP_NAV_TAB_NAME}', 'Native public navigation must keep the mobile-specific default tab.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'explore: ExploreScreen', 'Explore must own the center mobile primary tab.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<TradeFeedIdeaCard', 'Explore must reuse the existing Trade starter-card visual system.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<PlanSquareDeck', 'Explore Plan ideas must reuse the existing Plan square-deck visual system.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "navigation.navigate('PlanIdeaDetail'", 'Explore Plan ideas must open the existing Plan idea detail flow.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "navigation.navigate('Account')", 'Explore must expose Account after Me is retired from primary navigation.');
  assertContains('apps/mobile/src/features/plans/PlansScreens.tsx', "navigation.navigate('Account')", 'Plans must expose Account after Me is retired from primary navigation.');
  assertContains('apps/mobile/src/features/trade/TradeDeckFeedScreen.tsx', "navigation.navigate('Account')", 'Trade must expose Account after Me is retired from primary navigation.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'api.notifications.unreadCount()', 'The shared Account header action must surface the unread notification count.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', '<UserAvatar', 'The shared Account header action must reuse the real profile avatar when available.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'badgeCount={unreadCount}', 'The Account header action must carry the unread indicator after Me is retired from primary navigation.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'requestId === requestSequence', 'The Account unread badge refresh must ignore stale overlapping responses.');
  assertContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'Math.max(0, Math.trunc(response.unreadCount ?? 0))', 'The Account unread badge must normalize API counts before rendering.');
  assertNotContains('apps/mobile/src/components/AccountHeaderActionButton.tsx', 'if (active) setUnreadCount(0);', 'A transient unread-count refresh failure must not erase the last known Account badge.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<FlatList', 'Explore concepts must use a virtualized vertical feed instead of one global idea deck.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "kind: 'trade'", 'Explore must model each Trade idea as its own feed concept.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', "kind: 'plan'", 'Explore must model each Plan idea as its own feed concept.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'moveIdea(', 'Explore must not use global previous/next controls to switch Trade concepts.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'movePlanIdea(', 'Explore must not use global previous/next controls to switch Plan concepts.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'deckControls', 'Explore must not reintroduce global concept navigation buttons.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<AppText accessibilityRole="header" style={styles.title}>', 'Explore must keep a semantic page heading after discovery concepts are mixed.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'buildBalancedMixedFeed(', 'Explore must compose discovery concepts as one balanced mixed feed.');
  assertNotContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'minHeight: MOBILE_TRADE_DECK_AVAILABLE_HEIGHT', 'Explore must not reserve an extra empty production deck stage around every mixed-feed concept.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<AppSmartHeaderScreen header={header} resetKey={typeFilter}>', 'Explore alone must use the direction-aware smart header shell.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '...scrollProps.scrollViewProps', 'Explore must connect its virtualized feed to the smart-header scroll events.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'icon="filter"', 'Explore must expose the circular type-filter affordance.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<LibraryFilterScreen', 'Explore type filtering must use the existing full-screen filter UI.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', 'nextConceptDeck: { marginTop: MOBILE_DECK_FEED_GAP }', 'Explore concepts must keep the shared mobile deck feed gap.');
  assertContains('packages/shared/src/appNavigation.ts', "NormalMobileAppNavIcon = NormalAppNavIcon | 'search' | 'compass'", 'The mobile navigation contract must support the Explore compass icon without changing web navigation.');
  assertContains('packages/shared/src/appNavigation.ts', "icon: 'compass',\n    mobileTabName: 'ExploreTab'", 'Explore must use the compass icon rather than the search icon.');
  assertContains('apps/mobile/src/components/MobileIcon.tsx', "case 'compass':", 'The native icon system must provide a dedicated compass glyph for Explore.');
  assertContains('apps/mobile/src/features/explore/ExploreScreen.tsx', '<AccountHeaderActionButton', 'Explore must use the shared Account/profile header action.');
  assertContains('apps/mobile/src/features/plans/PlansScreens.tsx', '<AccountHeaderActionButton', 'Plans must use the shared Account/profile header action.');
  assertContains('apps/mobile/src/features/trade/TradeDeckFeedScreen.tsx', '<AccountHeaderActionButton', 'Trade must use the shared Account/profile header action.');

  console.log('Mobile primary-navigation regression guard: PASS');

  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', '<Stack.Screen name="Account" component={ProtectedAccountScreen} />', 'Account must remain independently reachable after Me is removed from primary navigation.');
  assertContains('apps/mobile/src/features/trade/MyNeedsScreen.tsx', "navigation.replace('Account');", 'My Needs fallback navigation must return to Account without depending on MeTab.');
  assertContains('apps/mobile/src/features/trade/MyOffersScreen.tsx', "navigation.replace('Account');", 'My Offers fallback navigation must return to Account without depending on MeTab.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', "auth.logout().finally(() => navigation.navigate('Login'))", 'Logout must not depend on the removable MeTab route.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'navigation.canGoBack()', 'Account must prefer stack back navigation so it returns to the Plans, Explore, or Trade surface that opened it.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'navigation.goBack();', 'Account must expose a real Back action instead of routing through a fixed primary tab.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', "t('account.context.switchProfile')", 'Account must expose the profile/context switcher foundation from the Profile section.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'accessibilityState={{ selected: true }}', 'The Personal context must be announced as the currently selected context.');
  assertContains('packages/i18n/src/locales/en/account.ts', "switchProfile: 'Switch profile'", 'Account context-switcher copy must remain localized in English.');
  assertContains('packages/i18n/src/locales/fr/account.ts', "switchProfile: 'Changer de profil'", 'Account context-switcher copy must remain localized in French.');
  assertContains('packages/i18n/src/locales/es/account.ts', "switchProfile: 'Cambiar perfil'", 'Account context-switcher copy must remain localized in Spanish.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', "accountActivity?: 'mine' | 'involved'", 'Account must be able to open the existing Trade activity workspace directly.');
  assertContains('apps/mobile/src/features/trade/TradeDeckFeedScreen.tsx', 'setActivityTab(params.accountActivity);', 'Trade feed must honor Account activity deep links.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'const ProtectedProposalDetailScreen = withAuth(ProposalDetailScreen);', 'Proposal thread detail must stay auth-protected.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', "withAuth(TradePrivateProposalsScreen, 'navigation.authRequired.privateProposals.title'", 'Private proposals screen must stay auth-protected.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.walletVisible ? <Stack.Screen name="Wallet"', 'Wallet route must stay hidden behind walletVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.walletVisible ? <Stack.Screen name="BuyCredits"', 'Buy credits route must stay hidden behind walletVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.payoutsVisible ? <Stack.Screen name="Payouts"', 'Payouts route must stay hidden behind payoutsVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.plusSubscriptionFeatures.plusPublic ? <Stack.Screen name="ProPlans"', 'Plan selection route must stay hidden behind plusPublic.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.businessAccountsVisible ? <Stack.Screen name="BusinessAccounts"', 'Business route must stay hidden behind businessAccountsVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.savedLibraryEnabled ? <Stack.Screen name="SavedLibrary"', 'Saved Library route must stay hidden behind savedLibraryEnabled.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.savedCollectionsEnabled ? <Stack.Screen name="SavedLibraryCollection"', 'Saved collections route must stay hidden behind savedCollectionsEnabled.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.agendaEnabled ? <Stack.Screen name="Agenda"', 'Agenda route must stay hidden behind agendaEnabled.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'const showFlagDiagnostics = betaFeatures.mobileDiagnosticsVisible;', 'Production Account screen must not auto-show feature diagnostics.');
  assertNotContains('apps/mobile/src/navigation/RootNavigator.tsx', 'wallet, support, and beta account tools', 'Logged-out Account copy must not mention wallet while first-launch money UI is hidden.');
  console.log('Mobile navigation/privacy gates: PASS');
}

function runSharePlacementChecks() {
  const allowedShareFiles = new Set([
    'apps/mobile/src/components/MobileIcon.tsx',
    'apps/mobile/src/features/trade/TradeDetailScreen.tsx',
    'apps/mobile/src/features/plans/PlansScreens.tsx',
  ]);
  const files = collectFiles('apps/mobile/src').filter((file) => /\.(tsx?|jsx?)$/.test(file));
  const sharePatterns = [/\bShare\.share\b/, /\bshareTrade\b/, /name="share"/, /trade\.detail\.share/];

  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, '/');
    const content = read(file);
    const hasShareUi = sharePatterns.some((pattern) => pattern.test(content));
    assert(!hasShareUi || allowedShareFiles.has(normalizedFile), `Share UI/action should stay only on Trade Detail. Found share-related code in ${file}.`);
  }

  assertContains('apps/mobile/src/features/trade/TradeDetailScreen.tsx', 'Share.share', 'Trade Detail must keep native share behavior.');
  assertContains('apps/mobile/src/features/trade/TradeDetailScreen.tsx', 'shareTrade', 'Trade Detail must keep its share handler.');
  assertContains('apps/mobile/src/features/plans/PlansScreens.tsx', 'Share.share', 'Plan Detail must keep native share behavior.');
  console.log('Mobile share placement: PASS');
}

function runDependencyChecks() {
  assertPackageDoesNotDependOn('apps/mobile/package.json', [
    'expo-notifications',
    'react-native-push-notification',
    '@react-native-firebase/messaging',
    'react-native-google-mobile-ads',
    'expo-ads-admob',
    '@stripe/stripe-react-native',
  ]);
  console.log('Mobile no push/ad/payment SDK dependency guard: PASS');
}

function runScreenFoundationChecks() {
  assertContains('apps/mobile/src/features/trade/TradeDetailScreen.tsx', 'DetailSection', 'Trade Detail should keep the shared mobile detail foundation.');
  assertContains('apps/mobile/src/features/trade/ProposalDetailScreen.tsx', 'ConversationComposerBar', 'Proposal thread should keep the modern composer foundation.');
  assertContains('apps/mobile/src/features/trade/ProposalDetailScreen.tsx', 'ProposalPackageThreadBlock', 'Proposal thread should keep the inline proposal package block.');
  assertContains('apps/mobile/src/features/trade/InventoryDetailScreen.tsx', 'DetailBottomActionBar', 'Need/Offer detail should keep the shared bottom action area.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'AccountHubSection', 'Account must keep one consolidated grouped row hub.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'AccountHubRow', 'Account must keep simple row navigation instead of dashboard widgets.');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', "navigate('TradeActivityProposals')", 'Account proposals must open the existing Trade proposal activity workspace.');
  assertNotContains('apps/mobile/src/features/account/AccountScreen.tsx', 'MeWidgetSection', 'Account must not restore the old expandable Me widget dashboard.');
  assertNotContains('apps/mobile/src/features/account/AccountScreen.tsx', 'AccountMenuScreen', 'The retired secondary Me/Account menu screen must stay removed.');
  assertNotContains('apps/mobile/src/features/account/AccountScreen.tsx', 'AccountMenuSection', 'The retired secondary Me/Account menu sections must stay removed.');
  assertNotContains('apps/mobile/src/features/account/AccountScreen.tsx', 'AccountActionRow', 'The retired colored Me/Account action rows must stay removed.');
  assertNotContains('apps/mobile/src/navigation/RootNavigator.tsx', 'MeMenu', 'The retired MeMenu route must stay unregistered.');
  assertNotContains('apps/mobile/src/navigation/RootNavigator.tsx', 'ProtectedAccountMenuScreen', 'The retired MeMenu auth wrapper must stay removed.');
  assertContains('apps/mobile/src/features/account/NotificationsScreen.tsx', 'groupNotifications', 'Notifications should keep dated grouping.');
  console.log('Mobile UI foundation smoke: PASS');
}

function runReliabilityChecks() {
  assertContains('packages/api-client/src/http.ts', 'DEFAULT_REQUEST_TIMEOUT_MS', 'API client must keep a finite JSON request timeout for weak mobile networks.');
  assertContains('packages/api-client/src/http.ts', 'FORM_DATA_REQUEST_TIMEOUT_MS', 'API client must keep a longer upload timeout for mobile image uploads.');
  assertContains('apps/mobile/src/lib/errors.ts', 'HELLOWHEN_API_TIMEOUT_ERROR', 'Mobile errors must show a friendly timeout message.');
  assertContains('apps/mobile/src/features/trade/TradeDeckFeedScreen.tsx', 'loadRequestIdRef', 'Trade feed must ignore stale overlapping feed responses.');
  assertContains('apps/mobile/src/features/trade/ProposalDetailScreen.tsx', 'if (actionLoading) return;', 'Proposal thread must guard duplicate message/action submissions.');
  assertContains('apps/mobile/src/features/account/NotificationsScreen.tsx', 'markingNotificationIdsRef', 'Notifications must guard duplicate mark-read requests.');
  assertContains('apps/mobile/src/features/account/NotificationsScreen.tsx', 'common.actions.tryAgain', 'Notifications must offer a retry action when loading fails.');
  console.log('Mobile reliability guards: PASS');
}


function runFormQualityChecks() {
  assertContains('apps/mobile/src/hooks/useUnsavedChangesWarning.ts', 'beforeRemove', 'Mobile draft forms must warn before discarding unsaved changes.');
  assertContains('apps/mobile/src/features/trade/mediaUpload.ts', 'SelectedImageUploadProgress', 'Mobile image uploads must expose progress for form UI.');
  assertContains('apps/mobile/src/features/trade/mediaUpload.ts', 'SelectedImageUploadError', 'Mobile image uploads must identify the failed image.');
  assertContains('apps/mobile/src/features/trade/components/ImagePickerField.tsx', 'MAX_IMAGE_SIZE_BYTES', 'Image picker must reject oversized images before upload.');
  assertContains('apps/mobile/src/features/trade/components/ImagePickerField.tsx', 'ALLOWED_IMAGE_MIME_TYPES', 'Image picker must restrict images to safe supported formats.');
  assertContains('apps/mobile/src/features/trade/CreateNeedScreen.tsx', 'InventoryCreateWizardScreen', 'Create Need must use the shared wizard that shows upload progress while saving images.');
  assertContains('apps/mobile/src/features/trade/CreateOfferScreen.tsx', 'InventoryCreateWizardScreen', 'Create Offer must use the shared wizard that shows upload progress while saving images.');
  assertContains('apps/mobile/src/features/trade/InventoryCreateWizardScreen.tsx', 'uploadProgress', 'Create Need/Offer wizard must show upload progress while saving images.');
  assertContains('apps/mobile/src/features/trade/TradePrivateProposalsScreen.tsx', 'messageTooShort', 'Create Proposal must show a validation error for short messages.');
  console.log('Mobile form/upload quality guards: PASS');
}


function runPrivacyAccessibilityChecks() {
  assertContains('apps/mobile/src/features/account/NotificationsScreen.tsx', "t('account.notifications.safeTitle')", 'Notifications must use a safe generic title fallback instead of backend-provided private text.');
  assertContains('apps/mobile/src/features/account/NotificationsScreen.tsx', "t('account.notifications.safeBody')", 'Notifications must use a safe generic body fallback instead of backend-provided private text.');
  assertNotContains('apps/mobile/src/features/account/NotificationsScreen.tsx', 'notification.body', 'Mobile notification previews must not render raw backend notification body text.');
  assertNotContains('apps/mobile/src/features/account/NotificationsScreen.tsx', 'notification.title', 'Mobile notification previews must not render raw backend notification title text.');
  assertContains('apps/mobile/src/features/auth/LoginScreen.tsx', 'accessibilityRole="checkbox"', 'Register terms and 18+ confirmation rows must expose checkbox roles.');
  assertContains('apps/mobile/src/features/auth/LoginScreen.tsx', 'accessibilityState={{ checked: acceptedTerms }}', 'Terms checkbox must expose checked state.');
  assertContains('apps/mobile/src/features/auth/LoginScreen.tsx', 'accessibilityState={{ checked: ageConfirmed }}', '18+ checkbox must expose checked state.');
  assertContains('apps/mobile/src/components/detail/MobileDetailUI.tsx', 'accessibilityLabel={action.label}', 'Shared detail actions must expose accessible labels.');
  assertContains('apps/mobile/src/components/detail/MobileDetailUI.tsx', 'accessibilityState={{ disabled: Boolean(primary.disabled || primary.loading), busy: Boolean(primary.loading) }}', 'Shared primary actions must expose disabled/busy states.');
  assertContains('apps/mobile/src/features/trade/ProposalDetailScreen.tsx', "t('trade.proposals.messageOptions')", 'Proposal thread message option buttons must expose accessible labels.');
  assertNotContains('apps/mobile/src/navigation/RootNavigator.tsx', 'proposals, wallet, and account settings', 'Logged-out private-route copy must not mention wallet while money features are hidden.');
  console.log('Mobile privacy/accessibility guards: PASS');
}

function main() {
  runFirstLaunchEnvChecks();
  runNavigationChecks();
  runSharePlacementChecks();
  runDependencyChecks();
  runScreenFoundationChecks();
  runReliabilityChecks();
  runFormQualityChecks();
  runPrivacyAccessibilityChecks();
  console.log('Mobile launch smoke static checks: PASS');
}

main();
