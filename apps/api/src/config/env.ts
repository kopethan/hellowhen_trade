import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
dotenv.config({ path: path.resolve(repoRoot, '.env') });

function parseCsv(value: string | undefined) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function enabled(value: string | undefined, defaultValue = false) {
  const raw = value?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function disabled(value: string | undefined, defaultValue = false) {
  const raw = value?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === 'false' || raw === '0' || raw === 'no';
}

const moneyProviders = new Set(['none', 'stripe', 'airwallex']);
const adsProviders = new Set(['none', 'adsense', 'admob']);
const aiProviders = new Set(['none', 'openai', 'gemini', 'groq']);
const airwallexEnvironments = new Set(['demo', 'production']);

function parseMoneyProvider(value: string | undefined) {
  const raw = String(value ?? 'none').toLowerCase();
  return moneyProviders.has(raw) ? raw as 'none' | 'stripe' | 'airwallex' : 'none';
}

function parseAirwallexEnv(value: string | undefined) {
  const raw = String(value ?? 'demo').toLowerCase();
  return airwallexEnvironments.has(raw) ? raw as 'demo' | 'production' : 'demo';
}

function parseAdsProvider(value: string | undefined) {
  const raw = String(value ?? 'none').toLowerCase();
  return adsProviders.has(raw) ? raw as 'none' | 'adsense' | 'admob' : 'none';
}

function parseAiProvider(value: string | undefined) {
  const raw = String(value ?? 'none').toLowerCase();
  return aiProviders.has(raw) ? raw as 'none' | 'openai' | 'gemini' | 'groq' : 'none';
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  mobileOrigin: process.env.MOBILE_ORIGIN ?? 'exp://127.0.0.1:8081',
  uploadDir: process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads'),
  moneyProvider: parseMoneyProvider(process.env.MONEY_PROVIDER),
  moneyProviderSandboxOnly: (process.env.MONEY_PROVIDER_SANDBOX_ONLY ?? 'true').toLowerCase() !== 'false',
  moneyProviderAccountCreationEnabled: (process.env.MONEY_PROVIDER_ACCOUNT_CREATION_ENABLED ?? 'false').toLowerCase() === 'true',
  moneyProviderWalletSyncEnabled: (process.env.MONEY_PROVIDER_WALLET_SYNC_ENABLED ?? 'false').toLowerCase() === 'true',
  moneyProviderPayinsEnabled: (process.env.MONEY_PROVIDER_PAYINS_ENABLED ?? 'false').toLowerCase() === 'true',
  moneyProviderTradeMoneyEnabled: (process.env.MONEY_PROVIDER_TRADE_MONEY_ENABLED ?? 'false').toLowerCase() === 'true',
  moneyProviderPayoutsEnabled: (process.env.MONEY_PROVIDER_PAYOUTS_ENABLED ?? 'false').toLowerCase() === 'true',
  moneyProviderWebhooksEnabled: (process.env.MONEY_PROVIDER_WEBHOOKS_ENABLED ?? 'false').toLowerCase() === 'true',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripeCurrency: (process.env.STRIPE_CURRENCY ?? 'eur').toLowerCase(),
  stripeConnectEnabled: (process.env.STRIPE_CONNECT_ENABLED ?? 'false').toLowerCase() === 'true',
  stripeConnectCountry: (process.env.STRIPE_CONNECT_COUNTRY ?? 'US').toUpperCase(),
  stripeConnectRefreshPath: process.env.STRIPE_CONNECT_REFRESH_PATH ?? '/account/payouts?stripe_connect=refresh',
  stripeConnectReturnPath: process.env.STRIPE_CONNECT_RETURN_PATH ?? '/account/payouts?stripe_connect=return',
  stripeConnectTransferMode: (process.env.STRIPE_CONNECT_TRANSFER_MODE ?? 'false').toLowerCase() === 'true',
  airwallexEnabled: (process.env.AIRWALLEX_ENABLED ?? 'false').toLowerCase() === 'true',
  airwallexEnv: parseAirwallexEnv(process.env.AIRWALLEX_ENV),
  airwallexBaseUrl: process.env.AIRWALLEX_BASE_URL ?? 'https://api-demo.airwallex.com',
  airwallexClientId: process.env.AIRWALLEX_CLIENT_ID ?? '',
  airwallexApiKey: process.env.AIRWALLEX_API_KEY ?? '',
  airwallexWebhookSecret: process.env.AIRWALLEX_WEBHOOK_SECRET ?? '',
  airwallexHostedFlowTemplateId: process.env.AIRWALLEX_HOSTED_FLOW_TEMPLATE_ID ?? '',
  airwallexBusinessHostedFlowTemplateId: process.env.AIRWALLEX_BUSINESS_HOSTED_FLOW_TEMPLATE_ID ?? process.env.AIRWALLEX_HOSTED_FLOW_TEMPLATE_ID ?? '',
  airwallexOnboardingReturnPath: process.env.AIRWALLEX_ONBOARDING_RETURN_PATH ?? '/account/payouts?airwallex=return',
  airwallexOnboardingErrorPath: process.env.AIRWALLEX_ONBOARDING_ERROR_PATH ?? '/account/payouts?airwallex=error',
  airwallexBusinessOnboardingReturnPath: process.env.AIRWALLEX_BUSINESS_ONBOARDING_RETURN_PATH ?? '/account/business?airwallex=return',
  airwallexBusinessOnboardingErrorPath: process.env.AIRWALLEX_BUSINESS_ONBOARDING_ERROR_PATH ?? '/account/business?airwallex=error',
  airwallexPlatformAccountId: process.env.AIRWALLEX_PLATFORM_ACCOUNT_ID ?? '',
  airwallexDefaultCurrency: (process.env.AIRWALLEX_DEFAULT_CURRENCY ?? 'eur').toLowerCase(),
  airwallexConnectedAccountsEnabled: (process.env.AIRWALLEX_CONNECTED_ACCOUNTS_ENABLED ?? 'false').toLowerCase() === 'true',
  airwallexKycOnboardingMode: process.env.AIRWALLEX_KYC_ONBOARDING_MODE ?? 'hosted',
  airwallexDefaultAccountType: process.env.AIRWALLEX_DEFAULT_ACCOUNT_TYPE ?? 'individual',
  airwallexSandboxPayoutBeneficiaryId: process.env.AIRWALLEX_SANDBOX_PAYOUT_BENEFICIARY_ID ?? '',
  airwallexSandboxPayoutTransferMethod: (process.env.AIRWALLEX_SANDBOX_PAYOUT_TRANSFER_METHOD ?? 'LOCAL').toUpperCase(),
  airwallexSandboxPayoutReason: process.env.AIRWALLEX_SANDBOX_PAYOUT_REASON ?? 'services',
  webAppUrl: process.env.WEB_APP_URL ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  mobileAppUrl: process.env.MOBILE_APP_URL ?? 'hellowhen://',
  googleSignInEnabled: (process.env.GOOGLE_SIGN_IN_ENABLED ?? 'false').toLowerCase() === 'true',
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Hellowhen <support@mail.hellowhen.com>',
  passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 45),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  emailVerificationTtlMinutes: Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES ?? 60),
  twoFactorEncryptionSecret: process.env.TWO_FACTOR_ENCRYPTION_SECRET ?? '',
  twoFactorChallengeTtlMinutes: Number(process.env.TWO_FACTOR_CHALLENGE_TTL_MINUTES ?? 10),
  sensitiveActionTtlMinutes: Number(process.env.SENSITIVE_ACTION_TTL_MINUTES ?? 10),
  adminRequireTwoFactor: (process.env.ADMIN_REQUIRE_TWO_FACTOR ?? 'true').toLowerCase() !== 'false',
  payoutPlatformFeeRateBps: Number(process.env.PAYOUT_PLATFORM_FEE_RATE_BPS ?? 1000),
  limitNewActiveServiceTrades: Number(process.env.LIMIT_NEW_ACTIVE_SERVICE_TRADES ?? 3),
  limitNewActiveMoneyTrades: Number(process.env.LIMIT_NEW_ACTIVE_MONEY_TRADES ?? 0),
  limitNewPerTradeMoneyCents: Number(process.env.LIMIT_NEW_PER_TRADE_MONEY_CENTS ?? 0),
  limitNewWalletBalanceCents: Number(process.env.LIMIT_NEW_WALLET_BALANCE_CENTS ?? 0),
  limitNewWeeklyPayoutCents: Number(process.env.LIMIT_NEW_WEEKLY_PAYOUT_CENTS ?? 0),
  limitEmailActiveServiceTrades: Number(process.env.LIMIT_EMAIL_ACTIVE_SERVICE_TRADES ?? 5),
  limitEmailActiveMoneyTrades: Number(process.env.LIMIT_EMAIL_ACTIVE_MONEY_TRADES ?? 1),
  limitEmailPerTradeMoneyCents: Number(process.env.LIMIT_EMAIL_PER_TRADE_MONEY_CENTS ?? 2500),
  limitEmailWalletBalanceCents: Number(process.env.LIMIT_EMAIL_WALLET_BALANCE_CENTS ?? 5000),
  limitEmailWeeklyPayoutCents: Number(process.env.LIMIT_EMAIL_WEEKLY_PAYOUT_CENTS ?? 0),
  limitStripeActiveServiceTrades: Number(process.env.LIMIT_STRIPE_ACTIVE_SERVICE_TRADES ?? 10),
  limitStripeActiveMoneyTrades: Number(process.env.LIMIT_STRIPE_ACTIVE_MONEY_TRADES ?? 3),
  limitStripePerTradeMoneyCents: Number(process.env.LIMIT_STRIPE_PER_TRADE_MONEY_CENTS ?? 5000),
  limitStripeWalletBalanceCents: Number(process.env.LIMIT_STRIPE_WALLET_BALANCE_CENTS ?? 10000),
  limitStripeWeeklyPayoutCents: Number(process.env.LIMIT_STRIPE_WEEKLY_PAYOUT_CENTS ?? 10000),
  limitTrustedActiveServiceTrades: Number(process.env.LIMIT_TRUSTED_ACTIVE_SERVICE_TRADES ?? 25),
  limitTrustedActiveMoneyTrades: Number(process.env.LIMIT_TRUSTED_ACTIVE_MONEY_TRADES ?? 10),
  limitTrustedPerTradeMoneyCents: Number(process.env.LIMIT_TRUSTED_PER_TRADE_MONEY_CENTS ?? 25000),
  limitTrustedWalletBalanceCents: Number(process.env.LIMIT_TRUSTED_WALLET_BALANCE_CENTS ?? 50000),
  limitTrustedWeeklyPayoutCents: Number(process.env.LIMIT_TRUSTED_WEEKLY_PAYOUT_CENTS ?? 100000),
  limitMinimumPayoutCents: Number(process.env.LIMIT_MINIMUM_PAYOUT_CENTS ?? 1000),
  moneyLaunchMode: process.env.MONEY_LAUNCH_MODE ?? 'disabled',
  moneyProductionEnabled: (process.env.MONEY_PRODUCTION_ENABLED ?? 'false').toLowerCase() === 'true',
  moneyPrivateBetaUserIds: parseCsv(process.env.MONEY_PRIVATE_BETA_USER_IDS),
  moneyPolicyAckRequired: (process.env.MONEY_POLICY_ACK_REQUIRED ?? 'true').toLowerCase() !== 'false',
  moneyPolicyVersion: process.env.MONEY_POLICY_VERSION ?? '2026-05-09',
  moneyWalletTermsVersion: process.env.MONEY_WALLET_TERMS_VERSION ?? process.env.MONEY_POLICY_VERSION ?? '2026-05-09',
  moneyPayoutTermsVersion: process.env.MONEY_PAYOUT_TERMS_VERSION ?? process.env.MONEY_POLICY_VERSION ?? '2026-05-09',
  moneyRefundPolicyVersion: process.env.MONEY_REFUND_POLICY_VERSION ?? process.env.MONEY_POLICY_VERSION ?? '2026-05-09',
  moneyDisputePolicyVersion: process.env.MONEY_DISPUTE_POLICY_VERSION ?? process.env.MONEY_POLICY_VERSION ?? '2026-05-09',
  moneyRequireManualPayoutReview: (process.env.MONEY_REQUIRE_MANUAL_PAYOUT_REVIEW ?? 'true').toLowerCase() !== 'false',
  moneyFeaturesVisible: (process.env.MONEY_FEATURES_VISIBLE ?? 'false').toLowerCase() === 'true',
  walletVisible: (process.env.WALLET_VISIBLE ?? 'false').toLowerCase() === 'true',
  payoutsVisible: (process.env.PAYOUTS_VISIBLE ?? 'false').toLowerCase() === 'true',
  moneyTradesEnabled: (process.env.MONEY_TRADES_ENABLED ?? 'false').toLowerCase() === 'true',
  cashTradesEnabled: (process.env.CASH_TRADES_ENABLED ?? 'false').toLowerCase() === 'true',
  cashPromiseEnabled: enabled(process.env.CASH_PROMISE_ENABLED),
  cashPromiseVisible: enabled(process.env.CASH_PROMISE_VISIBLE),
  cashPromiseMaxAmountCents: Number(process.env.CASH_PROMISE_MAX_AMOUNT_CENTS ?? 100000),
  businessAccountsEnabled: enabled(process.env.BUSINESS_ACCOUNTS_ENABLED),
  businessAccountsVisible: enabled(process.env.BUSINESS_ACCOUNTS_VISIBLE),
  businessSponsoredContentEnabled: enabled(process.env.BUSINESS_SPONSORED_CONTENT_ENABLED),
  businessCampaignsEnabled: enabled(process.env.BUSINESS_CAMPAIGNS_ENABLED),
  businessBudgetsEnabled: enabled(process.env.BUSINESS_BUDGETS_ENABLED),
  subscriptionsEnabled: enabled(process.env.SUBSCRIPTIONS_ENABLED),
  proAccountsEnabled: enabled(process.env.PRO_ACCOUNTS_ENABLED),
  proAccountsVisible: enabled(process.env.PRO_ACCOUNTS_VISIBLE),
  proTrialsEnabled: enabled(process.env.PRO_TRIALS_ENABLED),
  identityVerificationEnabled: enabled(process.env.IDENTITY_VERIFICATION_ENABLED),
  proMonthlyPriceCents: Number(process.env.PRO_MONTHLY_PRICE_CENTS ?? 1499),
  proMonthlyPriceCurrency: (process.env.PRO_MONTHLY_PRICE_CURRENCY ?? 'eur').toLowerCase(),
  proTrialDays: Number(process.env.PRO_TRIAL_DAYS ?? 14),
  proTradePackagesEnabled: enabled(process.env.PRO_TRADE_PACKAGES_ENABLED),
  proTradePackageMaxSupportingNeeds: Number(process.env.PRO_TRADE_PACKAGE_MAX_SUPPORTING_NEEDS ?? 3),
  proTradePackageMaxSupportingOffers: Number(process.env.PRO_TRADE_PACKAGE_MAX_SUPPORTING_OFFERS ?? 3),
  adsEnabled: (process.env.ADS_ENABLED ?? 'false').toLowerCase() === 'true',
  webAdsEnabled: (process.env.WEB_ADS_ENABLED ?? 'false').toLowerCase() === 'true',
  mobileAdsEnabled: (process.env.MOBILE_ADS_ENABLED ?? 'false').toLowerCase() === 'true',
  adsProvider: parseAdsProvider(process.env.ADS_PROVIDER),
  adsDebugPlaceholders: (process.env.ADS_DEBUG_PLACEHOLDERS ?? 'false').toLowerCase() === 'true',
  aiProvider: parseAiProvider(process.env.AI_PROVIDER),
  aiEnabled: enabled(process.env.AI_ENABLED),
  aiModerationEnabled: enabled(process.env.AI_MODERATION_ENABLED),
  aiSuggestionsEnabled: enabled(process.env.AI_SUGGESTIONS_ENABLED),
  aiAdminAssistEnabled: enabled(process.env.AI_ADMIN_ASSIST_ENABLED),
  aiSafetyClassifierEnabled: enabled(process.env.AI_SAFETY_CLASSIFIER_ENABLED),
  aiPrivateContentEnabled: enabled(process.env.AI_PRIVATE_CONTENT_ENABLED),
  aiDebugPlaceholders: enabled(process.env.AI_DEBUG_PLACEHOLDERS),
  openaiApiKey: process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY ?? '',
  openaiContentSuggestionModel: process.env.OPENAI_CONTENT_SUGGESTION_MODEL ?? 'gpt-4o-mini',
  geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY ?? '',
  geminiContentSuggestionModel: process.env.GEMINI_CONTENT_SUGGESTION_MODEL ?? 'gemini-1.5-flash',
  groqApiKey: process.env.GROQ_API_KEY ?? process.env.AI_API_KEY ?? '',
  groqContentSuggestionModel: process.env.GROQ_CONTENT_SUGGESTION_MODEL ?? 'llama-3.1-8b-instant',
  aiContentSuggestionTimeoutMs: Number(process.env.AI_CONTENT_SUGGESTION_TIMEOUT_MS ?? 12000),
  contentIntelligenceEnabled: enabled(process.env.CONTENT_INTELLIGENCE_ENABLED),
  contentClassificationEnabled: enabled(process.env.CONTENT_CLASSIFICATION_ENABLED),
  contentPlacementSignalsEnabled: enabled(process.env.CONTENT_PLACEMENT_SIGNALS_ENABLED),
  businessContextualSignalsEnabled: enabled(process.env.BUSINESS_CONTEXTUAL_SIGNALS_ENABLED),
  contextualAdSignalsEnabled: enabled(process.env.CONTEXTUAL_AD_SIGNALS_ENABLED),
  aiModerationSuggestionsEnabled: enabled(process.env.AI_MODERATION_SUGGESTIONS_ENABLED),
  autoModerationActionsEnabled: enabled(process.env.AUTO_MODERATION_ACTIONS_ENABLED),
  contentReviewGateEnabled: enabled(process.env.CONTENT_REVIEW_GATE_ENABLED),
  contentReviewGateHighRiskEnabled: enabled(process.env.CONTENT_REVIEW_GATE_HIGH_RISK_ENABLED),
  contentReviewGateCategoryMismatchEnabled: enabled(process.env.CONTENT_REVIEW_GATE_CATEGORY_MISMATCH_ENABLED),
  contentReviewGateSuggestedHideEnabled: enabled(process.env.CONTENT_REVIEW_GATE_SUGGESTED_HIDE_ENABLED),
  contentReviewGateClassifierFailureEnabled: enabled(process.env.CONTENT_REVIEW_GATE_CLASSIFIER_FAILURE_ENABLED),
  plansEnabled: (process.env.PLANS_ENABLED ?? 'false').toLowerCase() === 'true',
  plansVisible: (process.env.PLANS_VISIBLE ?? 'false').toLowerCase() === 'true',
  firstLaunchGuardsEnabled: !disabled(process.env.FIRST_LAUNCH_GUARDS_ENABLED, false)
};

function isLoopbackHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname.toLowerCase());
}

function isPrivateLanHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  const match = normalized.match(/^172\.(\d{1,2})\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalOrPrivateUrl(value: string) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  if (parsed.protocol === 'exp:') return true;
  return isLoopbackHostname(parsed.hostname) || isPrivateLanHostname(parsed.hostname);
}

function isHttpsUrl(value: string) {
  return parseUrl(value)?.protocol === 'https:';
}

function isOriginOnlyUrl(value: string) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  return parsed.origin !== 'null' && parsed.href.replace(/\/$/, '') === parsed.origin;
}

function getEmailAddress(value: string) {
  const trimmed = value.trim();
  const bracketMatch = trimmed.match(/<([^<>]+)>/);
  return (bracketMatch?.[1] ?? trimmed).trim();
}

function isValidEmailAddress(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export function isValidEmailSender(value: string) {
  return isValidEmailAddress(getEmailAddress(value));
}

function publicFlagEnabled(name: string) {
  return enabled(process.env[name]);
}

function publicFlagValue(name: string) {
  return (process.env[name] ?? '').trim().toLowerCase();
}

function hasConfiguredValue(value: string | undefined) {
  const raw = (value ?? '').trim();
  return Boolean(raw) && !raw.includes('replace_me') && !raw.includes('change-me') && !raw.includes('dev-change-me');
}

function isWeakProductionSecret(value: string | undefined) {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw.length < 32) return true;
  return raw.includes('dev-change') || raw.includes('change-me') || raw.includes('password') || raw.includes('replace_me');
}

function pushFirstLaunchGuardErrors(errors: string[]) {
  if (!env.firstLaunchGuardsEnabled) return;

  if (!env.adminRequireTwoFactor) {
    errors.push('ADMIN_REQUIRE_TWO_FACTOR must stay true for first-launch production.');
  }

  if (env.googleSignInEnabled || publicFlagEnabled('NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED') || publicFlagEnabled('EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED')) {
    errors.push('Google sign-in must stay disabled for first launch. Keep GOOGLE_SIGN_IN_ENABLED, NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED, and EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED false.');
  }

  const moneyProviderFlag = publicFlagValue('NEXT_PUBLIC_MONEY_PROVIDER');
  const mobileMoneyProviderFlag = publicFlagValue('EXPO_PUBLIC_MONEY_PROVIDER');
  if (env.moneyProvider !== 'none' || (moneyProviderFlag && moneyProviderFlag !== 'none') || (mobileMoneyProviderFlag && mobileMoneyProviderFlag !== 'none')) {
    errors.push('Money providers must stay set to none for first launch. Keep MONEY_PROVIDER, NEXT_PUBLIC_MONEY_PROVIDER, and EXPO_PUBLIC_MONEY_PROVIDER as none.');
  }

  const providerRuntimeEnabled = env.moneyProviderAccountCreationEnabled
    || env.moneyProviderWalletSyncEnabled
    || env.moneyProviderPayinsEnabled
    || env.moneyProviderTradeMoneyEnabled
    || env.moneyProviderPayoutsEnabled
    || env.moneyProviderWebhooksEnabled
    || env.stripeConnectEnabled
    || env.stripeConnectTransferMode
    || env.airwallexEnabled
    || env.airwallexConnectedAccountsEnabled;
  if (providerRuntimeEnabled) {
    errors.push('Stripe/Airwallex provider runtime flags must stay disabled for first launch.');
  }

  const providerSecretsConfigured = hasConfiguredValue(env.stripeSecretKey)
    || hasConfiguredValue(env.stripeWebhookSecret)
    || hasConfiguredValue(env.airwallexClientId)
    || hasConfiguredValue(env.airwallexApiKey)
    || hasConfiguredValue(env.airwallexWebhookSecret)
    || hasConfiguredValue(env.airwallexPlatformAccountId);
  if (providerSecretsConfigured) {
    errors.push('Stripe/Airwallex credentials must not be configured in the first-launch production environment.');
  }

  const moneyUiEnabled = env.moneyFeaturesVisible
    || env.walletVisible
    || env.payoutsVisible
    || env.moneyTradesEnabled
    || env.cashTradesEnabled
    || publicFlagEnabled('NEXT_PUBLIC_MONEY_FEATURES_VISIBLE')
    || publicFlagEnabled('NEXT_PUBLIC_WALLET_VISIBLE')
    || publicFlagEnabled('NEXT_PUBLIC_PAYOUTS_VISIBLE')
    || publicFlagEnabled('NEXT_PUBLIC_MONEY_TRADES_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_CASH_TRADES_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_CASH_PROMISE_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_CASH_PROMISE_VISIBLE')
    || publicFlagEnabled('EXPO_PUBLIC_MONEY_FEATURES_VISIBLE')
    || publicFlagEnabled('EXPO_PUBLIC_WALLET_VISIBLE')
    || publicFlagEnabled('EXPO_PUBLIC_PAYOUTS_VISIBLE')
    || publicFlagEnabled('EXPO_PUBLIC_MONEY_TRADES_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_CASH_TRADES_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_CASH_PROMISE_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_CASH_PROMISE_VISIBLE')
    || env.cashPromiseEnabled
    || env.cashPromiseVisible;
  if (moneyUiEnabled || env.moneyLaunchMode !== 'disabled' || env.moneyProductionEnabled) {
    errors.push('Money, wallet, payout, cash-trade, Cash Promise, and money-trade flags must stay disabled/hidden for first launch.');
  }

  const businessRuntimeEnabled = env.businessAccountsEnabled
    || env.businessAccountsVisible
    || env.businessSponsoredContentEnabled
    || env.businessCampaignsEnabled
    || env.businessBudgetsEnabled
    || publicFlagEnabled('NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE')
    || publicFlagEnabled('NEXT_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE')
    || publicFlagEnabled('EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED');
  if (businessRuntimeEnabled) {
    errors.push('Business/brand account, sponsored-content, campaign, and budget flags must stay disabled/hidden for first launch.');
  }

  const subscriptionFlagsEnabled = env.subscriptionsEnabled
    || env.proAccountsEnabled
    || env.proAccountsVisible
    || env.proTrialsEnabled
    || env.identityVerificationEnabled
    || env.proTradePackagesEnabled
    || publicFlagEnabled('NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_PRO_ACCOUNTS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_PRO_ACCOUNTS_VISIBLE')
    || publicFlagEnabled('NEXT_PUBLIC_PRO_TRIALS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_IDENTITY_VERIFICATION_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_PRO_ACCOUNTS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_PRO_ACCOUNTS_VISIBLE')
    || publicFlagEnabled('EXPO_PUBLIC_PRO_TRIALS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_IDENTITY_VERIFICATION_ENABLED');
  if (subscriptionFlagsEnabled) {
    errors.push('Professional/subscription flags must stay disabled and hidden for first launch.');
  }

  const webAdsProviderFlag = publicFlagValue('NEXT_PUBLIC_ADS_PROVIDER');
  const mobileAdsProviderFlag = publicFlagValue('EXPO_PUBLIC_ADS_PROVIDER');
  const adsUiEnabled = env.adsEnabled
    || env.webAdsEnabled
    || env.mobileAdsEnabled
    || env.adsDebugPlaceholders
    || publicFlagEnabled('NEXT_PUBLIC_ADS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_WEB_ADS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_ADS_DEBUG_PLACEHOLDERS')
    || publicFlagEnabled('EXPO_PUBLIC_ADS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_MOBILE_ADS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_ADS_DEBUG_PLACEHOLDERS');
  if (adsUiEnabled || env.adsProvider !== 'none' || (webAdsProviderFlag && webAdsProviderFlag !== 'none') || (mobileAdsProviderFlag && mobileAdsProviderFlag !== 'none')) {
    errors.push('Ads must stay disabled and ADS_PROVIDER must stay none for first launch.');
  }

  if (env.plansEnabled || env.plansVisible || publicFlagEnabled('NEXT_PUBLIC_PLANS_ENABLED') || publicFlagEnabled('NEXT_PUBLIC_PLANS_VISIBLE') || publicFlagEnabled('EXPO_PUBLIC_PLANS_ENABLED') || publicFlagEnabled('EXPO_PUBLIC_PLANS_VISIBLE')) {
    errors.push('Plans must stay disabled and hidden for first launch.');
  }

  const contentReviewGateRuntimeEnabled = env.contentReviewGateEnabled
    || env.contentReviewGateHighRiskEnabled
    || env.contentReviewGateCategoryMismatchEnabled
    || env.contentReviewGateSuggestedHideEnabled
    || env.contentReviewGateClassifierFailureEnabled;
  if (env.contentPlacementSignalsEnabled || env.businessContextualSignalsEnabled || env.contextualAdSignalsEnabled) {
    errors.push('Contextual placement/ad signals must stay disabled for first launch. Content Intelligence may store admin-reviewed classifications only.');
  }

  if (contentReviewGateRuntimeEnabled && env.autoModerationActionsEnabled) {
    errors.push('Content review gate automation must stay disabled for first launch. Content Intelligence may store suggestions only.');
  }

  if (env.autoModerationActionsEnabled) {
    errors.push('Automatic moderation actions must stay disabled for first launch. Content Intelligence may store suggestions only.');
  }

  const publicAiEnabled = publicFlagEnabled('NEXT_PUBLIC_AI_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_AI_MODERATION_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_AI_SUGGESTIONS_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_AI_ADMIN_ASSIST_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_AI_SAFETY_CLASSIFIER_ENABLED')
    || publicFlagEnabled('NEXT_PUBLIC_AI_DEBUG_PLACEHOLDERS')
    || publicFlagEnabled('EXPO_PUBLIC_AI_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_AI_MODERATION_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_AI_SUGGESTIONS_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_AI_ADMIN_ASSIST_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_AI_SAFETY_CLASSIFIER_ENABLED')
    || publicFlagEnabled('EXPO_PUBLIC_AI_DEBUG_PLACEHOLDERS');
  const publicAiProvider = publicFlagValue('NEXT_PUBLIC_AI_PROVIDER');
  const mobileAiProvider = publicFlagValue('EXPO_PUBLIC_AI_PROVIDER');
  const aiRuntimeEnabled = env.aiEnabled
    || env.aiModerationEnabled
    || env.aiSuggestionsEnabled
    || env.aiAdminAssistEnabled
    || env.aiSafetyClassifierEnabled
    || env.aiPrivateContentEnabled
    || env.aiModerationSuggestionsEnabled
    || env.aiDebugPlaceholders;
  const aiSecretsConfigured = hasConfiguredValue(env.openaiApiKey)
    || hasConfiguredValue(env.geminiApiKey)
    || hasConfiguredValue(env.groqApiKey);

  if (env.aiProvider !== 'none' || (publicAiProvider && publicAiProvider !== 'none') || (mobileAiProvider && mobileAiProvider !== 'none') || aiRuntimeEnabled || publicAiEnabled || aiSecretsConfigured) {
    errors.push('AI features, providers, and API keys must stay disabled for first launch. Keep AI_PROVIDER, NEXT_PUBLIC_AI_PROVIDER, and EXPO_PUBLIC_AI_PROVIDER as none, keep all AI feature flags false, and do not configure AI provider keys in production.');
  }
}

export function validateProductionEnv() {
  if (env.nodeEnv !== 'production') return;
  const errors: string[] = [];
  if (!env.databaseUrl) errors.push('DATABASE_URL is required in production.');
  if (isWeakProductionSecret(env.jwtSecret)) errors.push('JWT_SECRET must be a strong production secret, not a development placeholder.');
  if (env.adminRequireTwoFactor && isWeakProductionSecret(env.twoFactorEncryptionSecret)) errors.push('TWO_FACTOR_ENCRYPTION_SECRET must be set to a strong production secret when admin two-step verification is required.');
  if (isLocalOrPrivateUrl(env.webOrigin)) errors.push('WEB_ORIGIN must not point to localhost or a private LAN address in production.');
  if (isLocalOrPrivateUrl(env.webAppUrl)) errors.push('WEB_APP_URL must not point to localhost or a private LAN address in production.');
  if (env.mobileOrigin && isLocalOrPrivateUrl(env.mobileOrigin)) errors.push('MOBILE_ORIGIN must not point to Expo, localhost, or a private LAN address in production. Leave it empty if native requests do not send an Origin header.');
  if (!isHttpsUrl(env.webOrigin)) errors.push('WEB_ORIGIN must use https:// in production.');
  if (!isHttpsUrl(env.webAppUrl)) errors.push('WEB_APP_URL must use https:// in production so password reset and email verification links are public and secure.');
  if (!isOriginOnlyUrl(env.webOrigin)) errors.push('WEB_ORIGIN must be an origin only, for example https://app.hellowhen.com without a path.');
  if (!env.resendApiKey) errors.push('RESEND_API_KEY is required in production for password reset and email verification emails.');
  if (!isValidEmailSender(env.emailFrom)) errors.push('EMAIL_FROM must be a valid sender such as Hellowhen <support@mail.hellowhen.com>.');
  if (env.businessAccountsVisible && !env.businessAccountsEnabled) errors.push('BUSINESS_ACCOUNTS_VISIBLE=true requires BUSINESS_ACCOUNTS_ENABLED=true in production.');
  if ((env.businessSponsoredContentEnabled || env.businessCampaignsEnabled || env.businessBudgetsEnabled) && !env.businessAccountsEnabled) errors.push('Business sponsored-content, campaign, and budget flags require BUSINESS_ACCOUNTS_ENABLED=true in production.');
  if (env.businessBudgetsEnabled && (env.moneyProvider === 'none' || !env.moneyProviderAccountCreationEnabled || !env.moneyProviderSandboxOnly)) errors.push('BUSINESS_BUDGETS_ENABLED requires a sandbox-only money provider with provider account creation enabled in production.');
  if (publicFlagEnabled('NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE') && !publicFlagEnabled('NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')) errors.push('NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE=true requires NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED=true in production.');
  if ((publicFlagEnabled('NEXT_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED') || publicFlagEnabled('NEXT_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED') || publicFlagEnabled('NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED')) && !publicFlagEnabled('NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')) errors.push('NEXT_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED, NEXT_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED, and NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED require NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED=true in production.');
  if (publicFlagEnabled('EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE') && !publicFlagEnabled('EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')) errors.push('EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE=true requires EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED=true in production.');
  if ((publicFlagEnabled('EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED') || publicFlagEnabled('EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED') || publicFlagEnabled('EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED')) && !publicFlagEnabled('EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')) errors.push('EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED, EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED, and EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED require EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED=true in production.');
  if (env.plansVisible && !env.plansEnabled) errors.push('PLANS_VISIBLE=true requires PLANS_ENABLED=true in production.');
  const aiConfigured = env.aiProvider !== 'none' || env.aiEnabled || env.aiModerationEnabled || env.aiSuggestionsEnabled || env.aiAdminAssistEnabled || env.aiSafetyClassifierEnabled || env.aiPrivateContentEnabled || env.aiModerationSuggestionsEnabled || env.aiDebugPlaceholders;
  const aiSecretsConfigured = hasConfiguredValue(env.openaiApiKey) || hasConfiguredValue(env.geminiApiKey) || hasConfiguredValue(env.groqApiKey);
  if (aiConfigured && env.aiProvider === 'none') {
    errors.push('AI feature flags require AI_PROVIDER to be set to a real provider in a later dedicated AI launch.');
  }
  if (env.contentPlacementSignalsEnabled && (!env.contentIntelligenceEnabled || !env.contentClassificationEnabled)) errors.push('CONTENT_PLACEMENT_SIGNALS_ENABLED requires CONTENT_INTELLIGENCE_ENABLED=true and CONTENT_CLASSIFICATION_ENABLED=true.');
  if (env.businessContextualSignalsEnabled && (!env.contentPlacementSignalsEnabled || !env.businessSponsoredContentEnabled)) errors.push('BUSINESS_CONTEXTUAL_SIGNALS_ENABLED requires CONTENT_PLACEMENT_SIGNALS_ENABLED=true and BUSINESS_SPONSORED_CONTENT_ENABLED=true in a later Business launch.');
  if (env.contextualAdSignalsEnabled && (!env.contentPlacementSignalsEnabled || !env.adsEnabled || env.adsProvider === 'none')) errors.push('CONTEXTUAL_AD_SIGNALS_ENABLED requires CONTENT_PLACEMENT_SIGNALS_ENABLED=true, ADS_ENABLED=true, and a real ADS_PROVIDER in a later ads launch.');
  if (env.aiModerationSuggestionsEnabled && (!env.contentIntelligenceEnabled || !env.contentClassificationEnabled)) errors.push('AI_MODERATION_SUGGESTIONS_ENABLED requires CONTENT_INTELLIGENCE_ENABLED=true and CONTENT_CLASSIFICATION_ENABLED=true.');
  if (env.aiModerationSuggestionsEnabled && (!env.aiAdminAssistEnabled || !env.aiSuggestionsEnabled)) errors.push('AI_MODERATION_SUGGESTIONS_ENABLED requires AI_ADMIN_ASSIST_ENABLED=true and AI_SUGGESTIONS_ENABLED=true for the admin-only suggestion workflow.');
  if (env.aiModerationSuggestionsEnabled && env.aiPrivateContentEnabled) errors.push('AI_MODERATION_SUGGESTIONS_ENABLED cannot be combined with AI_PRIVATE_CONTENT_ENABLED in this admin-only classifier launch.');
  if (aiConfigured && !aiSecretsConfigured) errors.push('AI provider launch requires a provider API key such as OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY.');
  const reviewGateConfigured = env.contentReviewGateEnabled
    || env.contentReviewGateHighRiskEnabled
    || env.contentReviewGateCategoryMismatchEnabled
    || env.contentReviewGateSuggestedHideEnabled
    || env.contentReviewGateClassifierFailureEnabled;
  const reviewGateReasonConfigured = env.contentReviewGateHighRiskEnabled
    || env.contentReviewGateCategoryMismatchEnabled
    || env.contentReviewGateSuggestedHideEnabled
    || env.contentReviewGateClassifierFailureEnabled;
  if (reviewGateConfigured && (!env.contentIntelligenceEnabled || !env.contentClassificationEnabled)) errors.push('Content review gate flags require CONTENT_INTELLIGENCE_ENABLED=true and CONTENT_CLASSIFICATION_ENABLED=true.');
  if (reviewGateReasonConfigured && !env.contentReviewGateEnabled) errors.push('Content review gate reason flags require CONTENT_REVIEW_GATE_ENABLED=true.');
  if (env.autoModerationActionsEnabled && !env.contentReviewGateEnabled) errors.push('AUTO_MODERATION_ACTIONS_ENABLED requires CONTENT_REVIEW_GATE_ENABLED=true for the dedicated moderation review-gate launch.');
  if (env.contentReviewGateEnabled && !env.autoModerationActionsEnabled) errors.push('CONTENT_REVIEW_GATE_ENABLED requires AUTO_MODERATION_ACTIONS_ENABLED=true so the gate is explicit and auditable.');
  if ((env.webAdsEnabled || env.mobileAdsEnabled) && !env.adsEnabled) errors.push('WEB_ADS_ENABLED=true or MOBILE_ADS_ENABLED=true requires ADS_ENABLED=true in production.');
  if (env.adsDebugPlaceholders) errors.push('ADS_DEBUG_PLACEHOLDERS must stay false in production.');
  if (env.adsProvider !== 'none' && !env.adsEnabled) errors.push('ADS_PROVIDER requires ADS_ENABLED=true in production.');
  const googleClientIdsConfigured = Boolean(env.googleWebClientId || env.googleIosClientId || env.googleAndroidClientId);
  if (env.googleSignInEnabled && !googleClientIdsConfigured) errors.push('GOOGLE_SIGN_IN_ENABLED=true requires at least one Google OAuth client ID.');
  if (!env.googleSignInEnabled && googleClientIdsConfigured) errors.push('Google OAuth client IDs are configured while GOOGLE_SIGN_IN_ENABLED=false. Keep Google sign-in disabled for first launch or explicitly enable it later.');
  const moneyConfigured = env.moneyProvider !== 'none' || env.moneyFeaturesVisible || env.walletVisible || env.payoutsVisible || env.moneyTradesEnabled || env.cashTradesEnabled || env.cashPromiseEnabled || env.cashPromiseVisible;
  if (moneyConfigured && !env.moneyProductionEnabled) {
    errors.push('Money/wallet/payout features must stay disabled in production unless MONEY_PRODUCTION_ENABLED=true is explicitly set for a separate money launch.');
  }
  pushFirstLaunchGuardErrors(errors);
  if (errors.length) {
    throw new Error(`Invalid Hellowhen production configuration:\n- ${errors.join('\n- ')}`);
  }
}
