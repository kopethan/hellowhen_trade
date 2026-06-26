import { AI_FEATURE_DEFAULTS, PLUS_SUBSCRIPTION_FEATURE_DEFAULTS, PRO_SUBSCRIPTION_FEATURE_DEFAULTS, getProTradePackageEntitlements, normalizeAiProvider } from '@hellowhen/shared';
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
const subscriptionsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED);
const plusEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_PLUS_ENABLED);
const plusSubscriptionFeatures = {
  ...PLUS_SUBSCRIPTION_FEATURE_DEFAULTS,
  plusEnabled,
  plusPublic: plusEnabled && enabled(process.env.EXPO_PUBLIC_PLUS_PUBLIC),
  aiAssistEnabled: plusEnabled && enabled(process.env.EXPO_PUBLIC_AI_ASSIST_ENABLED),
  customizationEnabled: plusEnabled && enabled(process.env.EXPO_PUBLIC_PLUS_CUSTOMIZATION_ENABLED),
  adminGrantsEnabled: false,
  monthlyPriceCents: Number(process.env.EXPO_PUBLIC_PLUS_MONTHLY_PRICE_CENTS ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCents),
  monthlyPriceCurrency: (process.env.EXPO_PUBLIC_PLUS_MONTHLY_PRICE_CURRENCY ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCurrency).toLowerCase(),
  yearlyPriceCents: Number(process.env.EXPO_PUBLIC_PLUS_YEARLY_PRICE_CENTS ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.yearlyPriceCents),
  yearlyPriceCurrency: (process.env.EXPO_PUBLIC_PLUS_YEARLY_PRICE_CURRENCY ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.yearlyPriceCurrency).toLowerCase(),
  freeMonthlyAiAssistQuota: Number(process.env.EXPO_PUBLIC_FREE_MONTHLY_AI_ASSIST_QUOTA ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.freeMonthlyAiAssistQuota),
  plusMonthlyAiAssistQuota: Number(process.env.EXPO_PUBLIC_PLUS_MONTHLY_AI_ASSIST_QUOTA ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.plusMonthlyAiAssistQuota),
} as const;
const savedLibraryEnabled = plusEnabled && enabled(process.env.EXPO_PUBLIC_SAVED_LIBRARY_ENABLED);
const savedCollectionsEnabled = savedLibraryEnabled && enabled(process.env.EXPO_PUBLIC_SAVED_COLLECTIONS_ENABLED);
const agendaEnabled = plusEnabled && enabled(process.env.EXPO_PUBLIC_AGENDA_ENABLED);
const inventoryFoldersEnabled = plusEnabled && enabled(process.env.EXPO_PUBLIC_INVENTORY_FOLDERS_ENABLED);
const proAccountsEnabled = subscriptionsEnabled && enabled(process.env.EXPO_PUBLIC_PRO_ACCOUNTS_ENABLED);
const proSubscriptionFeatures = {
  ...PRO_SUBSCRIPTION_FEATURE_DEFAULTS,
  subscriptionsEnabled,
  proAccountsEnabled,
  proAccountsVisible: proAccountsEnabled && enabled(process.env.EXPO_PUBLIC_PRO_ACCOUNTS_VISIBLE),
  proTrialsEnabled: proAccountsEnabled && enabled(process.env.EXPO_PUBLIC_PRO_TRIALS_ENABLED),
  identityVerificationEnabled: proAccountsEnabled && enabled(process.env.EXPO_PUBLIC_IDENTITY_VERIFICATION_ENABLED),
  monthlyPriceCents: Number(process.env.EXPO_PUBLIC_PRO_MONTHLY_PRICE_CENTS ?? PRO_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCents),
  monthlyPriceCurrency: (process.env.EXPO_PUBLIC_PRO_MONTHLY_PRICE_CURRENCY ?? PRO_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCurrency).toLowerCase(),
  trialDays: Number(process.env.EXPO_PUBLIC_PRO_TRIAL_DAYS ?? PRO_SUBSCRIPTION_FEATURE_DEFAULTS.trialDays),
} as const;
const proTradePackagesEnabled = proAccountsEnabled && enabled(process.env.EXPO_PUBLIC_PRO_TRADE_PACKAGES_ENABLED);
const proTradePackageFeatures = {
  ...getProTradePackageEntitlements({
    enabled: proTradePackagesEnabled,
    requiresProAccess: true,
    maxSupportingNeeds: Number(process.env.EXPO_PUBLIC_PRO_TRADE_PACKAGE_MAX_SUPPORTING_NEEDS ?? 3),
    maxSupportingOffers: Number(process.env.EXPO_PUBLIC_PRO_TRADE_PACKAGE_MAX_SUPPORTING_OFFERS ?? 3),
  }),
  visible: proTradePackagesEnabled && enabled(process.env.EXPO_PUBLIC_PRO_TRADE_PACKAGES_VISIBLE),
} as const;
const moneyFeaturesVisible = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_MONEY_FEATURES_VISIBLE);
const businessAccountsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED);
const plansEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_PLANS_ENABLED);
const plansVisible = plansEnabled && enabled(process.env.EXPO_PUBLIC_PLANS_VISIBLE);
const mainNavPlansMeTrade = plansVisible && enabled(process.env.EXPO_PUBLIC_MAIN_NAV_PLANS_ME_TRADE);
const mobileMembershipVisible = !forceFirstLaunchSafeFlags && (
  enabled(process.env.EXPO_PUBLIC_MOBILE_MEMBERSHIP_VISIBLE)
  || (subscriptionsEnabled && plusSubscriptionFeatures.plusPublic)
);
const iosStoreKitMembershipEnabled = mobileMembershipVisible && !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_IOS_STOREKIT_MEMBERSHIP_ENABLED);
const androidGooglePlayMembershipEnabled = mobileMembershipVisible && !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_ANDROID_GOOGLE_PLAY_MEMBERSHIP_ENABLED);
const iosMembershipPurchasePlaceholderVisible = mobileMembershipVisible && !iosStoreKitMembershipEnabled && enabled(process.env.EXPO_PUBLIC_IOS_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED);
const androidMembershipPurchasePlaceholderVisible = mobileMembershipVisible && !androidGooglePlayMembershipEnabled && enabled(process.env.EXPO_PUBLIC_ANDROID_MEMBERSHIP_PURCHASE_PLACEHOLDER_ENABLED);
const nativeMembershipProductIds = {
  apple: {
    hellowhen_plus_monthly: process.env.EXPO_PUBLIC_APPLE_PLUS_MONTHLY_PRODUCT_ID ?? 'hellowhen.plus.monthly',
    hellowhen_plus_yearly: process.env.EXPO_PUBLIC_APPLE_PLUS_YEARLY_PRODUCT_ID ?? 'hellowhen.plus.yearly',
    hellowhen_pro_monthly: process.env.EXPO_PUBLIC_APPLE_PRO_MONTHLY_PRODUCT_ID ?? 'hellowhen.pro.monthly',
    hellowhen_pro_yearly: process.env.EXPO_PUBLIC_APPLE_PRO_YEARLY_PRODUCT_ID ?? 'hellowhen.pro.yearly',
  },
  google: {
    hellowhen_plus_monthly: process.env.EXPO_PUBLIC_GOOGLE_PLUS_MONTHLY_PRODUCT_ID ?? 'hellowhen_plus_monthly',
    hellowhen_plus_yearly: process.env.EXPO_PUBLIC_GOOGLE_PLUS_YEARLY_PRODUCT_ID ?? 'hellowhen_plus_yearly',
    hellowhen_pro_monthly: process.env.EXPO_PUBLIC_GOOGLE_PRO_MONTHLY_PRODUCT_ID ?? 'hellowhen_pro_monthly',
    hellowhen_pro_yearly: process.env.EXPO_PUBLIC_GOOGLE_PRO_YEARLY_PRODUCT_ID ?? 'hellowhen_pro_yearly',
  },
} as const;

export const betaFeatures = {
  moneyProvider: forceFirstLaunchSafeFlags ? 'none' : rawMoneyProvider,
  moneyFeaturesVisible,
  walletVisible: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_WALLET_VISIBLE),
  payoutsVisible: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_PAYOUTS_VISIBLE),
  moneyTradesEnabled: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_MONEY_TRADES_ENABLED),
  cashTradesEnabled: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_CASH_TRADES_ENABLED),
  cashPromiseEnabled: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_CASH_PROMISE_ENABLED),
  cashPromiseVisible: moneyFeaturesVisible && enabled(process.env.EXPO_PUBLIC_CASH_PROMISE_VISIBLE),
  businessAccountsEnabled,
  businessAccountsVisible: businessAccountsEnabled && enabled(process.env.EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE),
  businessSponsoredContentEnabled: businessAccountsEnabled && enabled(process.env.EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED),
  businessCampaignsEnabled: businessAccountsEnabled && enabled(process.env.EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED),
  businessBudgetsEnabled: businessAccountsEnabled && enabled(process.env.EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED),
  savedLibraryEnabled,
  savedCollectionsEnabled,
  agendaEnabled,
  inventoryFoldersEnabled,
  plusSubscriptionFeatures,
  proSubscriptionFeatures,
  proTradePackageFeatures,
  adsProvider: forceFirstLaunchSafeFlags ? 'none' : rawAdsProvider,
  adsEnabled,
  mobileAdsEnabled,
  adsDebugPlaceholders,
  plansEnabled,
  plansVisible,
  mainNavPlansMeTrade,
  mobileMembershipVisible,
  mobileMembershipPurchases: {
    iosStoreKitEnabled: iosStoreKitMembershipEnabled,
    androidGooglePlayEnabled: androidGooglePlayMembershipEnabled,
    iosPlaceholderVisible: iosMembershipPurchasePlaceholderVisible,
    androidPlaceholderVisible: androidMembershipPurchasePlaceholderVisible,
    nativeProductIds: nativeMembershipProductIds,
  },
  aiFeatures,
} as const;
