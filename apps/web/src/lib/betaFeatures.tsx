const enabled = (value: string | undefined) => value?.toLowerCase() === 'true';

export const betaFeatures = {
  moneyProvider: (process.env.NEXT_PUBLIC_MONEY_PROVIDER ?? 'none').toLowerCase() as 'none' | 'stripe' | 'airwallex',
  moneyFeaturesVisible: enabled(process.env.NEXT_PUBLIC_MONEY_FEATURES_VISIBLE),
  walletVisible: enabled(process.env.NEXT_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.NEXT_PUBLIC_WALLET_VISIBLE),
  payoutsVisible: enabled(process.env.NEXT_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.NEXT_PUBLIC_PAYOUTS_VISIBLE),
  moneyTradesEnabled: enabled(process.env.NEXT_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.NEXT_PUBLIC_MONEY_TRADES_ENABLED),
  cashTradesEnabled: enabled(process.env.NEXT_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.NEXT_PUBLIC_CASH_TRADES_ENABLED),
  businessAccountsVisible: enabled(process.env.NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE),
  plansEnabled: enabled(process.env.NEXT_PUBLIC_PLANS_ENABLED),
  plansVisible: enabled(process.env.NEXT_PUBLIC_PLANS_ENABLED) && enabled(process.env.NEXT_PUBLIC_PLANS_VISIBLE),
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
