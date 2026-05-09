import { z } from 'zod';


export const userTrustTierSchema = z.enum(['new', 'email_verified', 'stripe_verified', 'trusted', 'restricted']);

export const moneyLaunchModeSchema = z.enum(['disabled', 'demo', 'private_beta', 'production']);

export const moneySafetyStatusSchema = z.object({
  launchMode: moneyLaunchModeSchema,
  policyVersion: z.string(),
  walletTermsVersion: z.string(),
  payoutTermsVersion: z.string(),
  refundPolicyVersion: z.string(),
  disputePolicyVersion: z.string(),
  policyAcknowledgementRequired: z.boolean(),
  policyAcknowledged: z.boolean(),
  acknowledgedAt: z.string().nullable().optional(),
  privateBetaAllowed: z.boolean(),
  requiresManualPayoutReview: z.boolean(),
  moneyFeaturesVisible: z.boolean().optional().default(false),
  walletVisible: z.boolean().optional().default(false),
  payoutsVisible: z.boolean().optional().default(false),
  moneyTradesEnabled: z.boolean().optional().default(false),
  cashTradesEnabled: z.boolean().optional().default(false),
  realMoneyEnabled: z.boolean(),
  demoMoneyEnabled: z.boolean(),
  stripeTransfersEnabled: z.boolean(),
  productionSwitchEnabled: z.boolean().optional().default(false),
  privateBetaAllowlistCount: z.number().int().optional().default(0),
  message: z.string(),
});

export const acknowledgeMoneySafetyRequestSchema = z.object({
  accepted: z.literal(true),
});

export const adminUpdateTrustTierRequestSchema = z.object({
  trustTier: userTrustTierSchema,
  note: z.string().max(500).optional(),
});

export const walletLimitsSchema = z.object({
  trustTier: userTrustTierSchema,
  effectiveTrustTier: userTrustTierSchema,
  serviceActiveTradeLimit: z.number().int(),
  moneyActiveTradeLimit: z.number().int(),
  perTradeMoneyCapCents: z.number().int(),
  walletBalanceCapCents: z.number().int(),
  weeklyPayoutCapCents: z.number().int(),
  minimumPayoutCents: z.number().int(),
  payoutsEnabled: z.boolean(),
  moneyTradesEnabled: z.boolean(),
  walletTopUpsEnabled: z.boolean(),
  activeServiceTradeCount: z.number().int().default(0),
  activeMoneyTradeCount: z.number().int().default(0),
  walletExposureCents: z.number().int().default(0),
  weeklyRequestedPayoutGrossCents: z.number().int().default(0),
});

export const walletSchema = z.object({
  id: z.string(), userId: z.string(),
  // Legacy credit fields are kept for old clients/admin history.
  purchasedAvailableCredits: z.number().int(), earnedPendingCredits: z.number().int(), earnedAvailableCredits: z.number().int(), heldCredits: z.number().int(),
  // Money wallet fields used by the current mobile app.
  availableBalanceCents: z.number().int().default(0), heldBalanceCents: z.number().int().default(0), pendingPayoutCents: z.number().int().default(0), currency: z.string().default('eur'),
  updatedAt: z.string(),
});

export const ledgerEntrySchema = z.object({
  id: z.string(), userId: z.string(), walletId: z.string(), tradeId: z.string().nullable().optional(),
  type: z.enum(['starting_demo_credits', 'test_credit_grant', 'credit_purchase', 'trade_hold', 'trade_release', 'trade_refund', 'earned_pending', 'platform_fee', 'platform_fee_placeholder', 'payout_requested', 'payout_paid', 'adjustment']),
  balanceType: z.enum(['purchased', 'earned_pending', 'earned_available', 'held']),
  amount: z.number().int(), amountCents: z.number().int().default(0), currency: z.string().default('eur'), description: z.string().nullable().optional(), createdAt: z.string(),
});

export const demoTopUpRequestSchema = z.object({
  amountCents: z.number().int().min(100).max(100000),
  currency: z.string().trim().length(3).optional().default('eur'),
});

export const demoPayoutRequestSchema = z.object({
  amountCents: z.number().int().min(100).max(10000000),
  currency: z.string().trim().length(3).optional().default('eur'),
});

export const payoutRequestStatusSchema = z.enum(['draft', 'requested', 'approved', 'paid', 'rejected', 'cancelled']);
export const adminPayoutActionSchema = z.enum(['approve', 'pause', 'reject', 'cancel', 'mark_paid', 'retry']);
export const adminPayoutActionRequestSchema = z.object({
  action: adminPayoutActionSchema,
  note: z.string().trim().max(1000).optional(),
});

export const adminPayoutStatusFilterSchema = z.enum(['all', 'draft', 'requested', 'approved', 'paid', 'rejected', 'cancelled']);

export const payoutRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  amount: z.number().int(),
  // amountCents is kept as the requested gross earnings amount for old clients.
  amountCents: z.number().int(),
  grossAmountCents: z.number().int().default(0),
  platformFeeCents: z.number().int().default(0),
  netAmountCents: z.number().int().default(0),
  platformFeeRateBps: z.number().int().default(1000),
  currency: z.string(),
  status: payoutRequestStatusSchema,
  requestedAt: z.string(),
  reviewedAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  stripeConnectAccountId: z.string().nullable().optional(),
  stripeTransferId: z.string().nullable().optional(),
  stripePayoutId: z.string().nullable().optional(),
  stripeEventId: z.string().nullable().optional(),
  stripeFailureCode: z.string().nullable().optional(),
  stripeFailureMessage: z.string().nullable().optional(),
  stripeExternalStatus: z.string().nullable().optional(),
});

export const stripeConnectPayoutAccountSchema = z.object({
  provider: z.literal('stripe_connect_test'),
  status: z.enum(['not_connected', 'onboarding', 'pending', 'connected', 'restricted', 'disabled']),
  connectedAt: z.string().nullable().optional(),
  stripeAccountId: z.string().optional(),
  chargesEnabled: z.boolean().optional().default(false),
  payoutsEnabled: z.boolean().optional().default(false),
  detailsSubmitted: z.boolean().optional().default(false),
  currentlyDue: z.array(z.string()).optional().default([]),
  eventuallyDue: z.array(z.string()).optional().default([]),
  pastDue: z.array(z.string()).optional().default([]),
  disabledReason: z.string().nullable().optional(),
  defaultCurrency: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  lastSyncedAt: z.string().nullable().optional(),
});

export const payoutAccountSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('stripe_demo'),
    status: z.enum(['not_connected', 'connected']),
    connectedAt: z.string().nullable().optional(),
  }),
  stripeConnectPayoutAccountSchema,
]);

export const stripeConnectAccountLinkResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().nullable().optional(),
  account: stripeConnectPayoutAccountSchema.nullable().optional(),
  stripeConnectConfigured: z.boolean().optional().default(false),
});

export const payoutSummarySchema = z.object({
  currency: z.string(),
  platformFeeRateBps: z.number().int().default(1000),
  availableForPayoutCents: z.number().int(),
  availableGrossEarningsCents: z.number().int().default(0),
  estimatedPlatformFeeCents: z.number().int().default(0),
  estimatedNetPayoutCents: z.number().int().default(0),
  pendingPayoutRequestsCents: z.number().int(),
  pendingPayoutRequestsGrossCents: z.number().int().default(0),
  pendingPayoutRequestsFeeCents: z.number().int().default(0),
  pendingPayoutRequestsNetCents: z.number().int().default(0),
  paidOutCents: z.number().int(),
  paidOutGrossCents: z.number().int().default(0),
  paidOutFeeCents: z.number().int().default(0),
  paidOutNetCents: z.number().int().default(0),
  payoutAccount: payoutAccountSchema,
  stripeConnectConfigured: z.boolean().optional().default(false),
  stripeConnectTransferMode: z.boolean().optional().default(false),
  limits: walletLimitsSchema.optional(),
  moneySafety: moneySafetyStatusSchema.optional(),
});

export type MoneyLaunchMode = z.infer<typeof moneyLaunchModeSchema>;
export type MoneySafetyStatusDto = z.infer<typeof moneySafetyStatusSchema>;
export type AcknowledgeMoneySafetyRequest = z.infer<typeof acknowledgeMoneySafetyRequestSchema>;
export type UserTrustTier = z.infer<typeof userTrustTierSchema>;
export type AdminUpdateTrustTierRequest = z.infer<typeof adminUpdateTrustTierRequestSchema>;
export type WalletLimitsDto = z.infer<typeof walletLimitsSchema>;
export type WalletDto = z.infer<typeof walletSchema>;
export type LedgerEntryDto = z.infer<typeof ledgerEntrySchema>;
export type DemoTopUpRequest = z.infer<typeof demoTopUpRequestSchema>;
export type DemoPayoutRequest = z.infer<typeof demoPayoutRequestSchema>;
export type PayoutRequestStatus = z.infer<typeof payoutRequestStatusSchema>;
export type AdminPayoutAction = z.infer<typeof adminPayoutActionSchema>;
export type AdminPayoutActionRequest = z.infer<typeof adminPayoutActionRequestSchema>;
export type AdminPayoutStatusFilter = z.infer<typeof adminPayoutStatusFilterSchema>;
export type PayoutRequestDto = z.infer<typeof payoutRequestSchema>;
export type StripeConnectPayoutAccountDto = z.infer<typeof stripeConnectPayoutAccountSchema>;
export type StripeConnectAccountLinkResponse = z.infer<typeof stripeConnectAccountLinkResponseSchema>;
export type PayoutAccountDto = z.infer<typeof payoutAccountSchema>;
export type PayoutSummaryDto = z.infer<typeof payoutSummarySchema>;
