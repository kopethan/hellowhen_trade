const enabled = (value: string | undefined) => value?.toLowerCase() === 'true';

export const betaFeatures = {
  moneyFeaturesVisible: enabled(process.env.EXPO_PUBLIC_MONEY_FEATURES_VISIBLE),
  walletVisible: enabled(process.env.EXPO_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.EXPO_PUBLIC_WALLET_VISIBLE),
  payoutsVisible: enabled(process.env.EXPO_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.EXPO_PUBLIC_PAYOUTS_VISIBLE),
  moneyTradesEnabled: enabled(process.env.EXPO_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.EXPO_PUBLIC_MONEY_TRADES_ENABLED),
  cashTradesEnabled: enabled(process.env.EXPO_PUBLIC_MONEY_FEATURES_VISIBLE) && enabled(process.env.EXPO_PUBLIC_CASH_TRADES_ENABLED),
} as const;
