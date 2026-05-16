import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
dotenv.config({ path: path.resolve(repoRoot, '.env') });

function parseCsv(value: string | undefined) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

const moneyProviders = new Set(['none', 'stripe', 'airwallex']);
const airwallexEnvironments = new Set(['demo', 'production']);

function parseMoneyProvider(value: string | undefined) {
  const raw = String(value ?? 'none').toLowerCase();
  return moneyProviders.has(raw) ? raw as 'none' | 'stripe' | 'airwallex' : 'none';
}

function parseAirwallexEnv(value: string | undefined) {
  const raw = String(value ?? 'demo').toLowerCase();
  return airwallexEnvironments.has(raw) ? raw as 'demo' | 'production' : 'demo';
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
  emailFrom: process.env.EMAIL_FROM ?? 'Hellowhen <support@hellowhen.app>',
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
  businessAccountsVisible: (process.env.BUSINESS_ACCOUNTS_VISIBLE ?? 'false').toLowerCase() === 'true',
  plansEnabled: (process.env.PLANS_ENABLED ?? 'false').toLowerCase() === 'true',
  plansVisible: (process.env.PLANS_VISIBLE ?? 'false').toLowerCase() === 'true'
};

function isLocalUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function validateProductionEnv() {
  if (env.nodeEnv !== 'production') return;
  const errors: string[] = [];
  if (!env.databaseUrl) errors.push('DATABASE_URL is required in production.');
  if (!env.jwtSecret || env.jwtSecret === 'dev-change-me' || env.jwtSecret.length < 32) errors.push('JWT_SECRET must be a strong production secret.');
  if (env.adminRequireTwoFactor && (!env.twoFactorEncryptionSecret || env.twoFactorEncryptionSecret.length < 32)) errors.push('TWO_FACTOR_ENCRYPTION_SECRET must be set to a strong secret when admin two-step verification is required.');
  if (isLocalUrl(env.webOrigin)) errors.push('WEB_ORIGIN must not point to localhost in production.');
  if (isLocalUrl(env.webAppUrl)) errors.push('WEB_APP_URL must not point to localhost in production.');
  if (env.plansVisible && !env.plansEnabled) errors.push('PLANS_VISIBLE=true requires PLANS_ENABLED=true in production.');
  const googleClientIdsConfigured = Boolean(env.googleWebClientId || env.googleIosClientId || env.googleAndroidClientId);
  if (env.googleSignInEnabled && !googleClientIdsConfigured) errors.push('GOOGLE_SIGN_IN_ENABLED=true requires at least one Google OAuth client ID.');
  if (!env.googleSignInEnabled && googleClientIdsConfigured) errors.push('Google OAuth client IDs are configured while GOOGLE_SIGN_IN_ENABLED=false. Keep Google sign-in disabled for first launch or explicitly enable it later.');
  const moneyConfigured = env.moneyProvider !== 'none' || env.moneyFeaturesVisible || env.walletVisible || env.payoutsVisible || env.moneyTradesEnabled || env.cashTradesEnabled;
  if (moneyConfigured && !env.moneyProductionEnabled) {
    errors.push('Money/wallet/payout features must stay disabled in production unless MONEY_PRODUCTION_ENABLED=true is explicitly set for a separate money launch.');
  }
  if (errors.length) {
    throw new Error(`Invalid Hellowhen production configuration:\n- ${errors.join('\n- ')}`);
  }
}
