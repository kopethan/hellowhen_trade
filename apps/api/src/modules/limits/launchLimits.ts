import { env } from '../../config/env.js';

type TrustTier = 'new' | 'email_verified' | 'stripe_verified' | 'trusted' | 'restricted';
type PrismaLike = {
  user: { findUnique(args: unknown): Promise<any> };
  trade: { count(args: unknown): Promise<number> };
  wallet: { findUnique(args: unknown): Promise<any> };
  payoutRequest: { aggregate(args: unknown): Promise<any> };
};

const ACTIVE_TRADE_STATUSES = ['active', 'funded', 'in_progress', 'submitted'] as const;
const ACTIVE_PAYOUT_STATUSES = ['requested', 'approved', 'paid'] as const;

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function tierFromUser(user: { trustTier?: TrustTier | null; emailVerifiedAt?: Date | string | null } | null): TrustTier {
  if (!user) return 'new';
  if (user.trustTier === 'restricted') return 'restricted';
  if (user.trustTier === 'trusted') return 'trusted';
  if (user.trustTier === 'stripe_verified') return 'stripe_verified';
  if (user.trustTier === 'email_verified' || user.emailVerifiedAt) return 'email_verified';
  return 'new';
}

function tierConfig(tier: TrustTier) {
  if (tier === 'restricted') {
    return {
      serviceActiveTradeLimit: 0,
      moneyActiveTradeLimit: 0,
      perTradeMoneyCapCents: 0,
      walletBalanceCapCents: 0,
      weeklyPayoutCapCents: 0,
      minimumPayoutCents: numberOrZero(env.limitMinimumPayoutCents),
    };
  }
  if (tier === 'trusted') {
    return {
      serviceActiveTradeLimit: numberOrZero(env.limitTrustedActiveServiceTrades),
      moneyActiveTradeLimit: numberOrZero(env.limitTrustedActiveMoneyTrades),
      perTradeMoneyCapCents: numberOrZero(env.limitTrustedPerTradeMoneyCents),
      walletBalanceCapCents: numberOrZero(env.limitTrustedWalletBalanceCents),
      weeklyPayoutCapCents: numberOrZero(env.limitTrustedWeeklyPayoutCents),
      minimumPayoutCents: numberOrZero(env.limitMinimumPayoutCents),
    };
  }
  if (tier === 'stripe_verified') {
    return {
      serviceActiveTradeLimit: numberOrZero(env.limitStripeActiveServiceTrades),
      moneyActiveTradeLimit: numberOrZero(env.limitStripeActiveMoneyTrades),
      perTradeMoneyCapCents: numberOrZero(env.limitStripePerTradeMoneyCents),
      walletBalanceCapCents: numberOrZero(env.limitStripeWalletBalanceCents),
      weeklyPayoutCapCents: numberOrZero(env.limitStripeWeeklyPayoutCents),
      minimumPayoutCents: numberOrZero(env.limitMinimumPayoutCents),
    };
  }
  if (tier === 'email_verified') {
    return {
      serviceActiveTradeLimit: numberOrZero(env.limitEmailActiveServiceTrades),
      moneyActiveTradeLimit: numberOrZero(env.limitEmailActiveMoneyTrades),
      perTradeMoneyCapCents: numberOrZero(env.limitEmailPerTradeMoneyCents),
      walletBalanceCapCents: numberOrZero(env.limitEmailWalletBalanceCents),
      weeklyPayoutCapCents: numberOrZero(env.limitEmailWeeklyPayoutCents),
      minimumPayoutCents: numberOrZero(env.limitMinimumPayoutCents),
    };
  }
  return {
    serviceActiveTradeLimit: numberOrZero(env.limitNewActiveServiceTrades),
    moneyActiveTradeLimit: numberOrZero(env.limitNewActiveMoneyTrades),
    perTradeMoneyCapCents: numberOrZero(env.limitNewPerTradeMoneyCents),
    walletBalanceCapCents: numberOrZero(env.limitNewWalletBalanceCents),
    weeklyPayoutCapCents: numberOrZero(env.limitNewWeeklyPayoutCents),
    minimumPayoutCents: numberOrZero(env.limitMinimumPayoutCents),
  };
}

export async function buildLaunchLimits(prisma: PrismaLike, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustTier: true, emailVerifiedAt: true } });
  const effectiveTrustTier = tierFromUser(user);
  const rawConfig = tierConfig(effectiveTrustTier);
  const config = env.moneyFeaturesVisible
    ? rawConfig
    : {
      ...rawConfig,
      moneyActiveTradeLimit: 0,
      perTradeMoneyCapCents: 0,
      walletBalanceCapCents: 0,
      weeklyPayoutCapCents: 0,
      minimumPayoutCents: 0,
    };
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [activeServiceTradeCount, activeMoneyTradeCount, wallet, weeklyPayouts] = await Promise.all([
    prisma.trade.count({ where: { ownerId: userId, status: { in: ACTIVE_TRADE_STATUSES }, amountCents: { lte: 0 } } }),
    prisma.trade.count({ where: { ownerId: userId, status: { in: ACTIVE_TRADE_STATUSES }, amountCents: { gt: 0 } } }),
    prisma.wallet.findUnique({ where: { userId }, select: { availableBalanceCents: true, heldBalanceCents: true, pendingPayoutCents: true } }),
    prisma.payoutRequest.aggregate({
      where: { userId, requestedAt: { gte: weekStart }, status: { in: ACTIVE_PAYOUT_STATUSES } },
      _sum: { grossAmountCents: true, amountCents: true },
    }),
  ]);
  const walletExposureCents = numberOrZero(wallet?.availableBalanceCents) + numberOrZero(wallet?.heldBalanceCents) + numberOrZero(wallet?.pendingPayoutCents);
  const weeklyRequestedPayoutGrossCents = numberOrZero(weeklyPayouts?._sum?.grossAmountCents) || numberOrZero(weeklyPayouts?._sum?.amountCents);
  return {
    trustTier: (user?.trustTier ?? 'new') as TrustTier,
    effectiveTrustTier,
    ...config,
    payoutsEnabled: env.moneyFeaturesVisible && env.payoutsVisible && effectiveTrustTier !== 'restricted' && config.weeklyPayoutCapCents > 0,
    moneyTradesEnabled: env.moneyFeaturesVisible && env.moneyTradesEnabled && effectiveTrustTier !== 'restricted' && config.moneyActiveTradeLimit > 0 && config.perTradeMoneyCapCents > 0,
    walletTopUpsEnabled: env.moneyFeaturesVisible && env.walletVisible && effectiveTrustTier !== 'restricted' && config.walletBalanceCapCents > 0,
    activeServiceTradeCount,
    activeMoneyTradeCount,
    walletExposureCents,
    weeklyRequestedPayoutGrossCents,
  };
}

export function limitExceeded(message: string, details: Record<string, unknown> = {}) {
  return { error: 'launch_limit_exceeded', message, ...details };
}
