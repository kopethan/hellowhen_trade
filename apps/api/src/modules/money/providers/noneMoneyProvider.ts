import { MoneyProviderError, type CreateConnectedAccountInput, type CreateOnboardingLinkInput, type CreatePayoutTransferInput, type CreateTradeHoldInput, type MoneyProviderAdapter, type ProviderAccountDto, type RefundTradeHoldInput, type ReleaseTradeHoldInput, type SyncAccountStatusInput, type SyncPayoutTransferInput, type SyncWalletBalancesInput } from './moneyProvider.types.js';

function unavailable(): never {
  throw new MoneyProviderError('provider_none', 'Money provider is set to none. Wallets, onboarding, transfers, and payouts are disabled for this launch.', 403);
}

export const noneMoneyProvider: MoneyProviderAdapter = {
  provider: 'none',
  environment: 'none',
  sandboxOnly: true,
  capabilities: [],

  isConfigured() {
    return false;
  },

  getPublicStatus() {
    return {
      provider: this.provider,
      environment: this.environment,
      configured: this.isConfigured(),
      sandboxOnly: this.sandboxOnly,
      capabilities: this.capabilities,
    };
  },

  async getConnectedAccount(_userId: string, _businessProfileId?: string | null): Promise<ProviderAccountDto | null> {
    return {
      provider: 'none',
      status: 'not_connected',
      connectedAt: null,
      sandboxOnly: true,
      message: 'Money provider is none. Provider accounts are disabled for the beta money-off launch.',
    };
  },

  async createConnectedAccount(_input: CreateConnectedAccountInput) {
    return unavailable();
  },

  async createOnboardingLink(_input: CreateOnboardingLinkInput) {
    return unavailable();
  },

  async syncConnectedAccountStatus(_input: SyncAccountStatusInput) {
    return this.getConnectedAccount('none');
  },

  async getWalletBalances(_input: SyncWalletBalancesInput) {
    return {
      account: await this.getConnectedAccount('none'),
      balances: [],
      syncedAt: null,
      message: 'Money provider is none. No provider wallet balances exist for the beta money-off launch.',
    };
  },

  async syncWalletBalances(_input: SyncWalletBalancesInput) {
    return unavailable();
  },

  async createTradeHold(_input: CreateTradeHoldInput) {
    return unavailable();
  },

  async releaseTradeHold(_input: ReleaseTradeHoldInput) {
    return unavailable();
  },

  async refundTradeHold(_input: RefundTradeHoldInput) {
    return unavailable();
  },

  async createPayoutTransfer(_input: CreatePayoutTransferInput) {
    return unavailable();
  },

  async syncPayoutTransfer(_input: SyncPayoutTransferInput) {
    return unavailable();
  },
};
