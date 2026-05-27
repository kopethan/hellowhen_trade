import { AI_FEATURE_DEFAULTS, normalizeAiProvider } from '@hellowhen/shared';
const enabled = (value: string | undefined) => value?.toLowerCase() === 'true';
const disabled = (value: string | undefined) => value?.toLowerCase() === 'false';
const firstLaunchGuardsEnabled = !disabled(process.env.EXPO_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED);
const forceFirstLaunchSafeFlags = process.env.NODE_ENV === 'production' && firstLaunchGuardsEnabled;

const rawMoneyProvider = (process.env.EXPO_PUBLIC_MONEY_PROVIDER ?? 'none').toLowerCase() as 'none' | 'stripe' | 'airwallex';
const rawAdsProviderValue = (process.env.EXPO_PUBLIC_ADS_PROVIDER ?? 'none').toLowerCase();
const rawAdsProvider = (['none', 'adsense', 'admob'].includes(rawAdsProviderValue) ? rawAdsProviderValue : 'none') as 'none' | 'adsense' | 'admob';
const adsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_ADS_ENABLED);
const mobileAdsEnabled = adsEnabled && enabled(process.env.EXPO_PUBLIC_MOBILE_ADS_ENABLED);
const adsDebugPlaceholders = process.env.NODE_ENV !== 'production' && mobileAdsEnabled && enabled(process.env.EXPO_PUBLIC_ADS_DEBUG_PLACEHOLDERS);
const rawAiProvider = normalizeAiProvider(process.env.EXPO_PUBLIC_AI_PROVIDER);
const aiEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_AI_ENABLED) && rawAiProvider !== 'none';
const aiFeatures = {
  ...AI_FEATURE_DEFAULTS,
  enabled: aiEnabled,
  provider: forceFirstLaunchSafeFlags ? 'none' : rawAiProvider,
  moderationEnabled: aiEnabled && enabled(process.env.EXPO_PUBLIC_AI_MODERATION_ENABLED),
  suggestionsEnabled: aiEnabled && enabled(process.env.EXPO_PUBLIC_AI_SUGGESTIONS_ENABLED),
  adminAssistEnabled: aiEnabled && enabled(process.env.EXPO_PUBLIC_AI_ADMIN_ASSIST_ENABLED),
  safetyClassifierEnabled: aiEnabled && enabled(process.env.EXPO_PUBLIC_AI_SAFETY_CLASSIFIER_ENABLED),
  privateContentEnabled: false,
  debugPlaceholders: process.env.NODE_ENV !== 'production' && aiEnabled && enabled(process.env.EXPO_PUBLIC_AI_DEBUG_PLACEHOLDERS),
} as const;
const moneyFeaturesVisible = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_MONEY_FEATURES_VISIBLE);
const plansEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_PLANS_ENABLED);

export const betaFeatures = {
  moneyProvider: forceFirstLaunchSafeFlags ? 'none' : rawMoneyProvider,
  moneyFeaturesVisible,
  walletVisible: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_WALLET_VISIBLE),
  payoutsVisible: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_PAYOUTS_VISIBLE),
  moneyTradesEnabled: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_MONEY_TRADES_ENABLED),
  cashTradesEnabled: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_CASH_TRADES_ENABLED),
  businessAccountsVisible: !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE),
  adsProvider: forceFirstLaunchSafeFlags ? 'none' : rawAdsProvider,
  adsEnabled,
  mobileAdsEnabled,
  adsDebugPlaceholders,
  plansEnabled,
  plansVisible: plansEnabled && enabled(process.env.EXPO_PUBLIC_PLANS_VISIBLE),
  aiFeatures,
} as const;
