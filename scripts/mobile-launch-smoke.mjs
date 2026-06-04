#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
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
    'EXPO_PUBLIC_PLANS_ENABLED',
    'EXPO_PUBLIC_PLANS_VISIBLE',
  ];
  const noneFlags = ['EXPO_PUBLIC_MONEY_PROVIDER', 'EXPO_PUBLIC_ADS_PROVIDER', 'EXPO_PUBLIC_AI_PROVIDER'];

  for (const envFile of envFiles) {
    assert(existsSync(path.join(root, envFile)), `${envFile} is missing.`);
    for (const key of falseFlags) assertEnvDefault(envFile, key, 'false');
    for (const key of noneFlags) assertEnvDefault(envFile, key, 'none');
  }

  assertEnvDefault('.env.example', 'EXPO_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED', 'true');
  console.log('Mobile first-launch env flags: PASS');
}

function runNavigationChecks() {
  const navigator = read('apps/mobile/src/navigation/RootNavigator.tsx');
  const tabNames = [...navigator.matchAll(/<Tabs\.Screen name="([^"]+)"/g)].map((match) => match[1]);
  assert(JSON.stringify(tabNames) === JSON.stringify(['Trades', 'Needs', 'Offers', 'Account']), `Mobile tabs must stay Trades/Needs/Offers/Account. Found: ${tabNames.join(', ') || 'none'}.`);

  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'const ProtectedProposalDetailScreen = withAuth(ProposalDetailScreen);', 'Proposal thread detail must stay auth-protected.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', "withAuth(TradePrivateProposalsScreen, 'Login to view private proposals'", 'Private proposals screen must stay auth-protected.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.walletVisible ? <Stack.Screen name="Wallet"', 'Wallet route must stay hidden behind walletVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.walletVisible ? <Stack.Screen name="BuyCredits"', 'Buy credits route must stay hidden behind walletVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.payoutsVisible ? <Stack.Screen name="Payouts"', 'Payouts route must stay hidden behind payoutsVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.proSubscriptionFeatures.proAccountsVisible ? <Stack.Screen name="ProPlans"', 'Pro plans route must stay hidden behind proAccountsVisible.');
  assertContains('apps/mobile/src/navigation/RootNavigator.tsx', 'betaFeatures.businessAccountsVisible ? <Stack.Screen name="BusinessAccounts"', 'Business route must stay hidden behind businessAccountsVisible.');
  assertNotContains('apps/mobile/src/navigation/RootNavigator.tsx', 'wallet, support, and beta account tools', 'Logged-out Account copy must not mention wallet while first-launch money UI is hidden.');
  console.log('Mobile navigation/privacy gates: PASS');
}

function runSharePlacementChecks() {
  const allowedShareFiles = new Set([
    'apps/mobile/src/components/MobileIcon.tsx',
    'apps/mobile/src/features/trade/TradeDetailScreen.tsx',
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
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', 'AccountActionGroup', 'Account screen should keep grouped account rows.');
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
  assertContains('apps/mobile/src/features/trade/CreateNeedScreen.tsx', 'uploadProgress', 'Create Need must show upload progress while saving images.');
  assertContains('apps/mobile/src/features/trade/CreateOfferScreen.tsx', 'uploadProgress', 'Create Offer must show upload progress while saving images.');
  assertContains('apps/mobile/src/features/trade/CreateProposalScreen.tsx', 'messageError', 'Create Proposal must show a validation error for short messages.');
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
