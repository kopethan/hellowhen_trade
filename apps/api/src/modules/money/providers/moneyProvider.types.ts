import type { MoneyProvider as MoneyProviderName, MoneyProviderEnvironment } from '@hellowhen/contracts';

export class MoneyProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly statusCode = 400,
  ) {
    super(publicMessage);
    this.name = 'MoneyProviderError';
  }
}

export type MoneyProviderCapability =
  | 'connected_accounts'
  | 'onboarding_links'
  | 'wallet_balances'
  | 'payins'
  | 'trade_holds'
  | 'platform_fees'
  | 'payouts'
  | 'webhooks'
  | 'refunds'
  | 'disputes';

export type MoneyProviderAccountStatus = 'not_connected' | 'onboarding' | 'pending' | 'connected' | 'restricted' | 'disabled';

export type MoneyProviderPublicStatus = {
  provider: MoneyProviderName;
  environment: MoneyProviderEnvironment;
  configured: boolean;
  sandboxOnly: boolean;
  capabilities: MoneyProviderCapability[];
};

export type ProviderAccountDto = {
  provider: MoneyProviderName | 'stripe_demo' | 'stripe_connect_test' | 'airwallex_demo';
  status: MoneyProviderAccountStatus;
  connectedAt?: string | null;
  providerAccountId?: string;
  businessProfileId?: string | null;
  accountType?: 'individual' | 'business' | 'brand';
  legacyStripeAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  currentlyDue?: string[];
  eventuallyDue?: string[];
  pastDue?: string[];
  disabledReason?: string | null;
  defaultCurrency?: string | null;
  country?: string | null;
  lastSyncedAt?: string | null;
  sandboxOnly?: boolean;
  message?: string;
};

export type ProviderWalletBalanceDto = {
  provider: MoneyProviderName | 'stripe_connect_test' | 'airwallex_demo';
  providerAccountId?: string;
  currency: string;
  availableCents: number;
  reservedCents: number;
  pendingCents: number;
  totalCents: number;
  externalUpdatedAt?: string | null;
  lastSyncedAt?: string | null;
  source: 'stored' | 'provider_sync' | 'not_supported';
  sandboxOnly?: boolean;
};

export type ProviderTradeMoneyStatus = 'not_started' | 'recorded' | 'pending' | 'succeeded' | 'failed' | 'reversed' | 'skipped';

export type ProviderTradeMoneyResult = {
  provider: MoneyProviderName;
  providerTransactionId?: string | null;
  status: ProviderTradeMoneyStatus;
  externalStatus?: string | null;
  sandboxOnly?: boolean;
  message?: string;
};

export type CreateConnectedAccountInput = {
  userId: string;
  businessProfileId?: string | null;
  accountType?: 'individual' | 'business' | 'brand';
  country?: string | null;
  defaultCurrency?: string | null;
};

export type CreateOnboardingLinkInput = {
  userId: string;
  businessProfileId?: string | null;
  accountType?: 'individual' | 'business' | 'brand';
  refreshUrl?: string;
  returnUrl?: string;
};

export type ProviderOnboardingLinkResult = {
  url: string;
  expiresAt?: string | null;
  account?: ProviderAccountDto | null;
};

export type SyncAccountStatusInput = {
  userId?: string;
  businessProfileId?: string | null;
  providerAccountId?: string;
};

export type SyncWalletBalancesInput = {
  userId?: string;
  businessProfileId?: string | null;
  providerAccountId?: string;
  scaToken?: string;
};

export type ProviderWalletBalanceSyncResult = {
  account: ProviderAccountDto | null;
  balances: ProviderWalletBalanceDto[];
  syncedAt?: string | null;
  message?: string;
};

export type CreatePayoutTransferInput = {
  userId: string;
  payoutId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
  currency: string;
  scaToken?: string | null;
  requestedById?: string | null;
};

export type SyncPayoutTransferInput = {
  payoutId?: string;
  providerTransferId?: string;
  scaToken?: string | null;
};

export type ProviderTransferResult = {
  id: string;
  provider: MoneyProviderName;
  status: string;
  providerTransactionId?: string | null;
  externalStatus?: string | null;
  payoutRequestStatus?: string | null;
  sandboxOnly?: boolean;
  message?: string;
};

export type CreateTradeHoldInput = {
  tradeId: string;
  buyerId: string;
  sellerId: string;
  amountCents: number;
  currency: string;
  proposalId?: string | null;
  moneySide?: 'need' | 'offer' | 'legacy_optional' | null;
};

export type ReleaseTradeHoldInput = {
  tradeId: string;
  buyerId: string;
  sellerId: string;
  amountCents: number;
  currency: string;
  platformFeeCents?: number;
  confirmedById?: string | null;
};

export type RefundTradeHoldInput = {
  tradeId: string;
  buyerId: string;
  sellerId?: string | null;
  amountCents: number;
  currency: string;
  refundedById?: string | null;
  wasReleased?: boolean;
  reason?: string | null;
};

export interface MoneyProviderAdapter {
  provider: MoneyProviderName;
  environment: MoneyProviderEnvironment;
  sandboxOnly: boolean;
  capabilities: MoneyProviderCapability[];
  isConfigured(): boolean;
  getPublicStatus(): {
    provider: MoneyProviderName;
    environment: MoneyProviderEnvironment;
    configured: boolean;
    sandboxOnly: boolean;
    capabilities: MoneyProviderCapability[];
  };

  getConnectedAccount(userId: string, businessProfileId?: string | null): Promise<ProviderAccountDto | null>;
  createConnectedAccount(input: CreateConnectedAccountInput): Promise<ProviderAccountDto>;
  createOnboardingLink(input: CreateOnboardingLinkInput): Promise<ProviderOnboardingLinkResult>;
  syncConnectedAccountStatus(input: SyncAccountStatusInput): Promise<ProviderAccountDto | null>;
  getWalletBalances(input: SyncWalletBalancesInput): Promise<ProviderWalletBalanceSyncResult>;
  syncWalletBalances(input: SyncWalletBalancesInput): Promise<ProviderWalletBalanceSyncResult>;
  createTradeHold(input: CreateTradeHoldInput): Promise<ProviderTradeMoneyResult | null>;
  releaseTradeHold(input: ReleaseTradeHoldInput): Promise<ProviderTradeMoneyResult | null>;
  refundTradeHold(input: RefundTradeHoldInput): Promise<ProviderTradeMoneyResult | null>;
  createPayoutTransfer(input: CreatePayoutTransferInput): Promise<ProviderTransferResult | null>;
  syncPayoutTransfer(input: SyncPayoutTransferInput): Promise<ProviderTransferResult | null>;
}
