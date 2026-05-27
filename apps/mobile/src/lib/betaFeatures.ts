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
} as const;
