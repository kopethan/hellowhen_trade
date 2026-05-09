import { prisma } from '../../../lib/prisma.js';
import { createStripeConnectOnboardingLink, createStripeTransferForPayout, isStripeConnectConfigured, syncStripeConnectAccountByAccountId } from '../../stripe/stripeConnect.js';
import { MoneyProviderError, type CreateConnectedAccountInput, type CreateOnboardingLinkInput, type CreatePayoutTransferInput, type CreateTradeHoldInput, type MoneyProviderAdapter, type ProviderAccountDto, type RefundTradeHoldInput, type ReleaseTradeHoldInput, type SyncAccountStatusInput, type SyncPayoutTransferInput, type SyncWalletBalancesInput } from './moneyProvider.types.js';

function mapStripeConnectPayoutAccount(account: null | { status: string; payoutsEnabled: boolean; chargesEnabled: boolean; detailsSubmitted: boolean; createdAt: Date; onboardingCompletedAt: Date | null; stripeAccountId: string; currentlyDue: string[]; eventuallyDue: string[]; pastDue: string[]; disabledReason: string | null; defaultCurrency: string | null; country: string | null; lastSyncedAt: Date | null }): ProviderAccountDto | null {
  if (!account) return null;
  const status = account.status === 'enabled' && account.payoutsEnabled
    ? 'connected'
    : account.status === 'onboarding'
      ? 'onboarding'
      : account.status === 'pending'
        ? 'pending'
        : account.status === 'restricted'
          ? 'restricted'
          : account.status === 'disabled'
            ? 'disabled'
            : 'not_connected';
  return {
    provider: 'stripe_connect_test',
    status,
    connectedAt: account.onboardingCompletedAt ? account.onboardingCompletedAt.toISOString() : account.createdAt.toISOString(),
    providerAccountId: account.stripeAccountId,
    legacyStripeAccountId: account.stripeAccountId,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    detailsSubmitted: account.detailsSubmitted,
    currentlyDue: account.currentlyDue,
    eventuallyDue: account.eventuallyDue,
    pastDue: account.pastDue,
    disabledReason: account.disabledReason,
    defaultCurrency: account.defaultCurrency,
    country: account.country,
    lastSyncedAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
    sandboxOnly: true,
  };
}

export const stripeMoneyProvider: MoneyProviderAdapter = {
  provider: 'stripe',
  environment: 'test',
  sandboxOnly: true,
  capabilities: ['connected_accounts', 'onboarding_links', 'payouts'],

  isConfigured() {
    return isStripeConnectConfigured();
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

  async getConnectedAccount(userId: string, _businessProfileId?: string | null) {
    const account = await prisma.stripeConnectAccount.findUnique({ where: { userId } });
    return mapStripeConnectPayoutAccount(account);
  },

  async createConnectedAccount(_input: CreateConnectedAccountInput) {
    throw new Error('Stripe connected account creation is handled through onboarding links.');
  },

  async createOnboardingLink(input: CreateOnboardingLinkInput) {
    const result = await createStripeConnectOnboardingLink(input.userId);
    const account = await prisma.stripeConnectAccount.findUnique({ where: { id: result.account.id } });
    return { url: result.url, expiresAt: result.expiresAt, account: mapStripeConnectPayoutAccount(account) };
  },

  async syncConnectedAccountStatus(input: SyncAccountStatusInput) {
    const current = input.providerAccountId
      ? await prisma.stripeConnectAccount.findUnique({ where: { stripeAccountId: input.providerAccountId } })
      : input.userId
        ? await prisma.stripeConnectAccount.findUnique({ where: { userId: input.userId } })
        : null;
    const account = current ? await syncStripeConnectAccountByAccountId(current.stripeAccountId) : null;
    return mapStripeConnectPayoutAccount(account);
  },

  async getWalletBalances(_input: SyncWalletBalancesInput) {
    return {
      account: null,
      balances: [],
      syncedAt: null,
      message: 'Stripe provider wallet-balance sync is not part of Phase 21.3. Use legacy Stripe Connect views for test payout account status.',
    };
  },

  async syncWalletBalances(_input: SyncWalletBalancesInput) {
    return this.getWalletBalances(_input);
  },

  async createTradeHold(_input: CreateTradeHoldInput) {
    throw new MoneyProviderError('not_implemented', 'Stripe provider trade-money mirroring is not implemented. Stripe remains a disabled fallback/reference provider.', 501);
  },

  async releaseTradeHold(_input: ReleaseTradeHoldInput) {
    throw new MoneyProviderError('not_implemented', 'Stripe provider trade-money release is not implemented. Stripe remains a disabled fallback/reference provider.', 501);
  },

  async refundTradeHold(_input: RefundTradeHoldInput) {
    throw new MoneyProviderError('not_implemented', 'Stripe provider trade-money refund is not implemented. Stripe remains a disabled fallback/reference provider.', 501);
  },

  async createPayoutTransfer(input: CreatePayoutTransferInput) {
    const transfer = await createStripeTransferForPayout(input);
    if (!transfer) return null;
    return { id: transfer.id, provider: 'stripe', status: 'transfer_created', providerTransactionId: transfer.id, externalStatus: 'transfer_created', sandboxOnly: true };
  },

  async syncPayoutTransfer(_input: SyncPayoutTransferInput) {
    throw new MoneyProviderError('not_implemented', 'Stripe payout status sync remains in the legacy Stripe webhook path. Stripe stays as a disabled fallback/reference provider.', 501);
  },
};
