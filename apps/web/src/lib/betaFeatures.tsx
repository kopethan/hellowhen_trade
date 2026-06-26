import { AI_FEATURE_DEFAULTS, PLUS_SUBSCRIPTION_FEATURE_DEFAULTS, PRO_SUBSCRIPTION_FEATURE_DEFAULTS, getProTradePackageEntitlements, normalizeAiProvider } from '@hellowhen/shared';
const enabled = (value: string | undefined) => value?.toLowerCase() === 'true';
const disabled = (value: string | undefined) => value?.toLowerCase() === 'false';
const firstLaunchGuardsEnabled = !disabled(process.env.NEXT_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED);
const forceFirstLaunchSafeFlags = process.env.NODE_ENV === 'production' && firstLaunchGuardsEnabled;

const rawMoneyProvider = (process.env.NEXT_PUBLIC_MONEY_PROVIDER ?? 'none').toLowerCase() as 'none' | 'stripe' | 'airwallex';
const rawAdsProviderValue = (process.env.NEXT_PUBLIC_ADS_PROVIDER ?? 'none').toLowerCase();
const rawAdsProvider = (['none', 'adsense', 'admob'].includes(rawAdsProviderValue) ? rawAdsProviderValue : 'none') as 'none' | 'adsense' | 'admob';
const adsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_ADS_ENABLED);
const webAdsEnabled = adsEnabled && enabled(process.env.NEXT_PUBLIC_WEB_ADS_ENABLED);
const adsDebugPlaceholders = process.env.NODE_ENV !== 'production' && webAdsEnabled && enabled(process.env.NEXT_PUBLIC_ADS_DEBUG_PLACEHOLDERS);
const rawAiProvider = normalizeAiProvider(process.env.NEXT_PUBLIC_AI_PROVIDER);
const aiEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_AI_ENABLED) && rawAiProvider !== 'none';
const aiFeatures = {
  ...AI_FEATURE_DEFAULTS,
  enabled: aiEnabled,
  provider: forceFirstLaunchSafeFlags ? 'none' : rawAiProvider,
  moderationEnabled: aiEnabled && enabled(process.env.NEXT_PUBLIC_AI_MODERATION_ENABLED),
  suggestionsEnabled: aiEnabled && enabled(process.env.NEXT_PUBLIC_AI_SUGGESTIONS_ENABLED),
  adminAssistEnabled: aiEnabled && enabled(process.env.NEXT_PUBLIC_AI_ADMIN_ASSIST_ENABLED),
  safetyClassifierEnabled: aiEnabled && enabled(process.env.NEXT_PUBLIC_AI_SAFETY_CLASSIFIER_ENABLED),
  privateContentEnabled: false,
  debugPlaceholders: process.env.NODE_ENV !== 'production' && aiEnabled && enabled(process.env.NEXT_PUBLIC_AI_DEBUG_PLACEHOLDERS),
} as const;
const subscriptionsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED);
const stripeMembershipCheckoutEnabled = subscriptionsEnabled && !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_STRIPE_MEMBERSHIP_CHECKOUT_ENABLED);
const stripeMembershipPortalEnabled = subscriptionsEnabled && !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_STRIPE_MEMBERSHIP_PORTAL_ENABLED);
const plusEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_PLUS_ENABLED);
const plusSubscriptionFeatures = {
  ...PLUS_SUBSCRIPTION_FEATURE_DEFAULTS,
  plusEnabled,
  plusPublic: plusEnabled && enabled(process.env.NEXT_PUBLIC_PLUS_PUBLIC),
  aiAssistEnabled: plusEnabled && enabled(process.env.NEXT_PUBLIC_AI_ASSIST_ENABLED),
  customizationEnabled: plusEnabled && enabled(process.env.NEXT_PUBLIC_PLUS_CUSTOMIZATION_ENABLED),
  adminGrantsEnabled: false,
  monthlyPriceCents: Number(process.env.NEXT_PUBLIC_PLUS_MONTHLY_PRICE_CENTS ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCents),
  monthlyPriceCurrency: (process.env.NEXT_PUBLIC_PLUS_MONTHLY_PRICE_CURRENCY ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCurrency).toLowerCase(),
  yearlyPriceCents: Number(process.env.NEXT_PUBLIC_PLUS_YEARLY_PRICE_CENTS ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.yearlyPriceCents),
  yearlyPriceCurrency: (process.env.NEXT_PUBLIC_PLUS_YEARLY_PRICE_CURRENCY ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.yearlyPriceCurrency).toLowerCase(),
  freeMonthlyAiAssistQuota: Number(process.env.NEXT_PUBLIC_FREE_MONTHLY_AI_ASSIST_QUOTA ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.freeMonthlyAiAssistQuota),
  plusMonthlyAiAssistQuota: Number(process.env.NEXT_PUBLIC_PLUS_MONTHLY_AI_ASSIST_QUOTA ?? PLUS_SUBSCRIPTION_FEATURE_DEFAULTS.plusMonthlyAiAssistQuota),
} as const;
const savedLibraryEnabled = plusEnabled && enabled(process.env.NEXT_PUBLIC_SAVED_LIBRARY_ENABLED);
const savedCollectionsEnabled = savedLibraryEnabled && enabled(process.env.NEXT_PUBLIC_SAVED_COLLECTIONS_ENABLED);
const agendaEnabled = plusEnabled && enabled(process.env.NEXT_PUBLIC_AGENDA_ENABLED);
const inventoryFoldersEnabled = plusEnabled && enabled(process.env.NEXT_PUBLIC_INVENTORY_FOLDERS_ENABLED);
const proAccountsEnabled = subscriptionsEnabled && enabled(process.env.NEXT_PUBLIC_PRO_ACCOUNTS_ENABLED);
const proSubscriptionFeatures = {
  ...PRO_SUBSCRIPTION_FEATURE_DEFAULTS,
  subscriptionsEnabled,
  proAccountsEnabled,
  proAccountsVisible: proAccountsEnabled && enabled(process.env.NEXT_PUBLIC_PRO_ACCOUNTS_VISIBLE),
  proTrialsEnabled: proAccountsEnabled && enabled(process.env.NEXT_PUBLIC_PRO_TRIALS_ENABLED),
  identityVerificationEnabled: proAccountsEnabled && enabled(process.env.NEXT_PUBLIC_IDENTITY_VERIFICATION_ENABLED),
  monthlyPriceCents: Number(process.env.NEXT_PUBLIC_PRO_MONTHLY_PRICE_CENTS ?? PRO_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCents),
  monthlyPriceCurrency: (process.env.NEXT_PUBLIC_PRO_MONTHLY_PRICE_CURRENCY ?? PRO_SUBSCRIPTION_FEATURE_DEFAULTS.monthlyPriceCurrency).toLowerCase(),
  trialDays: Number(process.env.NEXT_PUBLIC_PRO_TRIAL_DAYS ?? PRO_SUBSCRIPTION_FEATURE_DEFAULTS.trialDays),
} as const;
const proTradePackagesEnabled = proAccountsEnabled && enabled(process.env.NEXT_PUBLIC_PRO_TRADE_PACKAGES_ENABLED);
const proTradePackageFeatures = {
  ...getProTradePackageEntitlements({
    enabled: proTradePackagesEnabled,
    requiresProAccess: true,
    maxSupportingNeeds: Number(process.env.NEXT_PUBLIC_PRO_TRADE_PACKAGE_MAX_SUPPORTING_NEEDS ?? 3),
    maxSupportingOffers: Number(process.env.NEXT_PUBLIC_PRO_TRADE_PACKAGE_MAX_SUPPORTING_OFFERS ?? 3),
  }),
  visible: proTradePackagesEnabled && enabled(process.env.NEXT_PUBLIC_PRO_TRADE_PACKAGES_VISIBLE),
} as const;
const moneyFeaturesVisible = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_MONEY_FEATURES_VISIBLE);
const businessAccountsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED);
const plansEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_PLANS_ENABLED);
const plansVisible = plansEnabled && enabled(process.env.NEXT_PUBLIC_PLANS_VISIBLE);
const mainNavPlansMeTrade = plansVisible && enabled(process.env.NEXT_PUBLIC_MAIN_NAV_PLANS_ME_TRADE);

export const betaFeatures = {
  moneyProvider: forceFirstLaunchSafeFlags ? 'none' : rawMoneyProvider,
  moneyFeaturesVisible,
  walletVisible: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_WALLET_VISIBLE),
  payoutsVisible: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_PAYOUTS_VISIBLE),
  moneyTradesEnabled: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_MONEY_TRADES_ENABLED),
  cashTradesEnabled: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_CASH_TRADES_ENABLED),
  cashPromiseEnabled: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_CASH_PROMISE_ENABLED),
  cashPromiseVisible: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_CASH_PROMISE_VISIBLE),
  businessAccountsEnabled,
  businessAccountsVisible: businessAccountsEnabled && enabled(process.env.NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE),
  businessSponsoredContentEnabled: businessAccountsEnabled && enabled(process.env.NEXT_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED),
  businessCampaignsEnabled: businessAccountsEnabled && enabled(process.env.NEXT_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED),
  businessBudgetsEnabled: businessAccountsEnabled && enabled(process.env.NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED),
  savedLibraryEnabled,
  savedCollectionsEnabled,
  agendaEnabled,
  inventoryFoldersEnabled,
  plusSubscriptionFeatures,
  proSubscriptionFeatures,
  proTradePackageFeatures,
  stripeMembershipCheckoutEnabled,
  stripeMembershipPortalEnabled,
  adsProvider: forceFirstLaunchSafeFlags ? 'none' : rawAdsProvider,
  adsEnabled,
  webAdsEnabled,
  adsDebugPlaceholders,
  plansEnabled,
  plansVisible,
  mainNavPlansMeTrade,
  aiFeatures,
} as const;

export function MoneyOffNotice({ title = 'Need + Offer beta' }: { title?: string }) {
  return (
    <section className="mobile-card mobile-card--soft">
      <span className="semantic-badge instruction">Beta</span>
      <h3>{title}</h3>
      <p>This beta focuses on Need + Offer exchanges for services, goods, and other everyday items.</p>
    </section>
  );
}
