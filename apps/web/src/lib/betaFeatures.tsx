const enabled = (value: string | undefined) => value?.toLowerCase() === 'true';
const disabled = (value: string | undefined) => value?.toLowerCase() === 'false';
const firstLaunchGuardsEnabled = !disabled(process.env.NEXT_PUBLIC_FIRST_LAUNCH_GUARDS_ENABLED);
const forceFirstLaunchSafeFlags = process.env.NODE_ENV === 'production' && firstLaunchGuardsEnabled;

const rawMoneyProvider = (process.env.NEXT_PUBLIC_MONEY_PROVIDER ?? 'none').toLowerCase() as 'none' | 'stripe' | 'airwallex';
const moneyFeaturesVisible = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_MONEY_FEATURES_VISIBLE);
const plansEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_PLANS_ENABLED);

export const betaFeatures = {
  moneyProvider: forceFirstLaunchSafeFlags ? 'none' : rawMoneyProvider,
  moneyFeaturesVisible,
  walletVisible: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_WALLET_VISIBLE),
  payoutsVisible: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_PAYOUTS_VISIBLE),
  moneyTradesEnabled: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_MONEY_TRADES_ENABLED),
  cashTradesEnabled: moneyFeaturesVisible && enabled(process.env.NEXT_PUBLIC_CASH_TRADES_ENABLED),
  businessAccountsVisible: !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE),
  plansEnabled,
  plansVisible: plansEnabled && enabled(process.env.NEXT_PUBLIC_PLANS_VISIBLE),
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
