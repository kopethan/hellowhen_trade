import { env } from '../../config/env.js';
import { buildMoneyProviderStatus } from './providers/moneyProviderRegistry.js';

type MoneyLaunchMode = 'disabled' | 'demo' | 'private_beta' | 'production';
type MoneySafetyAction = 'money_trade' | 'wallet_top_up' | 'wallet_balance_sync' | 'payout_account' | 'payout_request' | 'provider_trade_money' | 'provider_transfer' | 'stripe_transfer';
type PrismaLike = {
  moneyPolicyAcknowledgement: {
    findFirst(args: unknown): Promise<any>;
    upsert(args: unknown): Promise<any>;
    count(args: unknown): Promise<number>;
  };
  wallet?: { aggregate(args: unknown): Promise<any>; count(args: unknown): Promise<number> };
  payoutRequest?: { groupBy(args: unknown): Promise<any[]> };
  stripeConnectAccount?: { groupBy(args: unknown): Promise<any[]> };
};

const validModes = new Set(['disabled', 'demo', 'private_beta', 'production']);

function mode(): MoneyLaunchMode {
  const raw = String(env.moneyLaunchMode ?? 'disabled').toLowerCase();
  return validModes.has(raw) ? raw as MoneyLaunchMode : 'disabled';
}

function userIsPrivateBetaAllowed(userId: string) {
  const allowList = env.moneyPrivateBetaUserIds ?? [];
  return allowList.length === 0 || allowList.includes(userId);
}

export function buildGlobalMoneySafetyConfig() {
  const launchMode = mode();
  const privateBetaUserIds = env.moneyPrivateBetaUserIds ?? [];
  const productionSwitchEnabled = Boolean(env.moneyProductionEnabled);
  const moneyFeaturesVisible = Boolean(env.moneyFeaturesVisible);
  const walletVisible = moneyFeaturesVisible && Boolean(env.walletVisible);
  const payoutsVisible = moneyFeaturesVisible && Boolean(env.payoutsVisible);
  const moneyTradesEnabled = moneyFeaturesVisible && Boolean(env.moneyTradesEnabled);
  const cashTradesEnabled = moneyFeaturesVisible && Boolean(env.cashTradesEnabled);
  const providerStatus = buildMoneyProviderStatus();
  const providerIsNone = providerStatus.provider === 'none';
  const providerConfigured = providerStatus.configured;
  const realMoneyEnabled = moneyFeaturesVisible && launchMode === 'production' && productionSwitchEnabled && !providerIsNone && providerConfigured;
  const providerTradeMoneyEnabled = moneyFeaturesVisible
    && Boolean(env.moneyProviderTradeMoneyEnabled)
    && !providerIsNone
    && providerConfigured
    && providerStatus.capabilities.includes('trade_holds');
  const providerPayoutsFlagEnabled = moneyFeaturesVisible
    && Boolean(env.moneyProviderPayoutsEnabled)
    && !providerIsNone
    && providerConfigured
    && providerStatus.capabilities.includes('payouts');
  const providerCanMovePayouts = providerStatus.provider === 'stripe'
    ? Boolean(env.stripeConnectTransferMode)
    : providerStatus.provider === 'airwallex';
  const sandboxPayoutsAllowed = providerStatus.sandboxOnly && (launchMode === 'demo' || launchMode === 'private_beta');
  const providerTransfersEnabled = providerPayoutsFlagEnabled
    && providerCanMovePayouts
    && (realMoneyEnabled || sandboxPayoutsAllowed);
  return {
    launchMode,
    moneyProvider: providerStatus.provider,
    moneyProviderEnvironment: providerStatus.environment,
    moneyProviderConfigured: providerConfigured,
    moneyProviderSandboxOnly: providerStatus.sandboxOnly,
    moneyProviderCapabilities: providerStatus.capabilities,
    policyVersion: env.moneyPolicyVersion,
    walletTermsVersion: env.moneyWalletTermsVersion,
    payoutTermsVersion: env.moneyPayoutTermsVersion,
    refundPolicyVersion: env.moneyRefundPolicyVersion,
    disputePolicyVersion: env.moneyDisputePolicyVersion,
    policyAcknowledgementRequired: env.moneyPolicyAckRequired,
    requiresManualPayoutReview: env.moneyRequireManualPayoutReview,
    moneyFeaturesVisible,
    walletVisible,
    payoutsVisible,
    moneyTradesEnabled,
    cashTradesEnabled,
    realMoneyEnabled,
    productionSwitchEnabled,
    privateBetaAllowlistCount: privateBetaUserIds.length,
    providerTradeMoneyEnabled,
    providerTransfersEnabled,
    providerWalletSyncEnabled: moneyFeaturesVisible && Boolean(env.moneyProviderWalletSyncEnabled) && !providerIsNone && providerConfigured,
    stripeTransfersEnabled: providerStatus.provider === 'stripe' && providerTransfersEnabled,
    demoMoneyEnabled: moneyFeaturesVisible && (launchMode === 'demo' || launchMode === 'private_beta' || launchMode === 'production'),
  };
}

export async function buildMoneySafetyStatus(prisma: PrismaLike, userId: string) {
  const config = buildGlobalMoneySafetyConfig();
  const acknowledgement = await prisma.moneyPolicyAcknowledgement.findFirst({
    where: { userId, policyVersion: config.policyVersion },
    orderBy: { acknowledgedAt: 'desc' },
  });
  const privateBetaAllowed = config.launchMode !== 'private_beta' || userIsPrivateBetaAllowed(userId);
  const policyAcknowledged = !config.policyAcknowledgementRequired || Boolean(acknowledgement);
  const realMoneyEnabled = config.realMoneyEnabled && privateBetaAllowed;
  const demoMoneyEnabled = config.demoMoneyEnabled && privateBetaAllowed;
  const providerTradeMoneyEnabled = config.providerTradeMoneyEnabled && privateBetaAllowed && policyAcknowledged;
  const providerTransfersEnabled = config.providerTransfersEnabled && privateBetaAllowed;
  const providerWalletSyncEnabled = config.providerWalletSyncEnabled && privateBetaAllowed;
  const stripeTransfersEnabled = config.moneyProvider === 'stripe' && providerTransfersEnabled;
  const message = config.launchMode === 'disabled'
    ? 'Money features are disabled for this launch.'
    : !privateBetaAllowed
      ? 'Money features are currently limited to the private beta.'
      : !policyAcknowledged
        ? 'Review and accept the wallet, payout, refund, and dispute policies before using money features.'
        : config.launchMode === 'production'
          ? 'Production money mode is enabled. Keep limits low and monitor payouts closely.'
          : 'Money features are in demo or beta safety mode. No production money movement is enabled by default.';
  return {
    ...config,
    privateBetaAllowed,
    policyAcknowledged,
    acknowledgedAt: acknowledgement?.acknowledgedAt ? acknowledgement.acknowledgedAt.toISOString() : null,
    realMoneyEnabled,
    demoMoneyEnabled,
    providerTradeMoneyEnabled,
    providerTransfersEnabled,
    providerWalletSyncEnabled,
    stripeTransfersEnabled,
    message,
  };
}

export async function acknowledgeMoneySafety(prisma: PrismaLike, userId: string, context: { ipAddress?: string | null; userAgent?: string | null } = {}) {
  const config = buildGlobalMoneySafetyConfig();
  const record = await prisma.moneyPolicyAcknowledgement.upsert({
    where: { userId_policyVersion: { userId, policyVersion: config.policyVersion } },
    update: {
      walletTermsVersion: config.walletTermsVersion,
      payoutTermsVersion: config.payoutTermsVersion,
      refundPolicyVersion: config.refundPolicyVersion,
      disputePolicyVersion: config.disputePolicyVersion,
      launchMode: config.launchMode,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      acknowledgedAt: new Date(),
    },
    create: {
      userId,
      policyVersion: config.policyVersion,
      walletTermsVersion: config.walletTermsVersion,
      payoutTermsVersion: config.payoutTermsVersion,
      refundPolicyVersion: config.refundPolicyVersion,
      disputePolicyVersion: config.disputePolicyVersion,
      launchMode: config.launchMode,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });
  return record;
}

export function getMoneySafetyBlock(status: Awaited<ReturnType<typeof buildMoneySafetyStatus>>, action: MoneySafetyAction) {
  if (!status.moneyFeaturesVisible || status.launchMode === 'disabled') return { statusCode: 403, error: 'money_launch_disabled', message: 'Money features are disabled for this launch.' };
  if (!status.privateBetaAllowed) return { statusCode: 403, error: 'money_private_beta_required', message: 'Money features are currently limited to approved private beta users.' };
  if (status.policyAcknowledgementRequired && !status.policyAcknowledged) return { statusCode: 403, error: 'money_policy_acknowledgement_required', message: 'Review and accept the wallet, payout, refund, and dispute policies before using money features.' };
  if (action === 'money_trade' && !status.moneyTradesEnabled) return { statusCode: 403, error: 'money_trades_disabled', message: 'Money trades are disabled for the beta launch.' };
  if (action === 'wallet_top_up' && !status.walletVisible) return { statusCode: 403, error: 'wallet_disabled', message: 'Wallet top-ups are disabled for the beta launch.' };
  if (action === 'wallet_balance_sync' && !status.walletVisible) return { statusCode: 403, error: 'wallet_disabled', message: 'Provider wallet balance sync is disabled for the beta launch.' };
  if ((action === 'payout_account' || action === 'payout_request') && !status.payoutsVisible) return { statusCode: 403, error: 'payouts_disabled', message: 'Payouts are disabled for the beta launch.' };
  if ((action === 'wallet_top_up' || action === 'wallet_balance_sync' || action === 'money_trade' || action === 'payout_account' || action === 'payout_request') && !status.demoMoneyEnabled) return { statusCode: 403, error: 'money_features_unavailable', message: 'Money features are not available in the current launch mode.' };
  if (status.moneyProvider === 'none' && (action === 'wallet_top_up' || action === 'wallet_balance_sync' || action === 'money_trade' || action === 'payout_account' || action === 'payout_request' || action === 'provider_trade_money' || action === 'provider_transfer' || action === 'stripe_transfer')) return { statusCode: 403, error: 'money_provider_none', message: 'Money provider is set to none for the beta money-off launch.' };
  if (action === 'wallet_balance_sync' && !status.providerWalletSyncEnabled) return { statusCode: 403, error: 'provider_wallet_sync_disabled', message: 'Provider wallet balance sync is disabled by launch safety settings.' };
  if (action === 'provider_trade_money' && !status.providerTradeMoneyEnabled) return { statusCode: 403, error: 'provider_trade_money_disabled', message: 'Provider trade-money sandbox movement is disabled by launch safety settings.' };
  if (action === 'provider_transfer' && !status.providerTransfersEnabled) return { statusCode: 403, error: 'provider_transfers_disabled', message: 'Provider transfers are disabled by launch safety settings.' };
  if (action === 'stripe_transfer' && !status.stripeTransfersEnabled) return { statusCode: 403, error: 'stripe_transfers_disabled', message: 'Stripe transfers are disabled by launch safety settings.' };
  return null;
}

export async function buildAdminMoneySafetySummary(prisma: PrismaLike) {
  const config = buildGlobalMoneySafetyConfig();
  const [acknowledgementCount, walletAggregate, walletCount, payoutsByStatus, stripeAccountsByStatus] = await Promise.all([
    prisma.moneyPolicyAcknowledgement.count({ where: { policyVersion: config.policyVersion } }),
    prisma.wallet?.aggregate({ _sum: { availableBalanceCents: true, heldBalanceCents: true, pendingPayoutCents: true } }) ?? Promise.resolve(null),
    prisma.wallet?.count({}) ?? Promise.resolve(0),
    prisma.payoutRequest?.groupBy({ by: ['status'], _count: { _all: true }, _sum: { grossAmountCents: true, netAmountCents: true } }) ?? Promise.resolve([]),
    prisma.stripeConnectAccount?.groupBy({ by: ['status'], _count: { _all: true } }) ?? Promise.resolve([]),
  ]);
  return { config, metrics: { acknowledgementCount, walletCount, walletAggregate, payoutsByStatus, stripeAccountsByStatus } };
}
