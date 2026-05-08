import { z } from 'zod';

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
export const payoutRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  amount: z.number().int(),
  amountCents: z.number().int(),
  currency: z.string(),
  status: payoutRequestStatusSchema,
  requestedAt: z.string(),
  reviewedAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const payoutAccountSchema = z.object({
  provider: z.literal('stripe_demo'),
  status: z.enum(['not_connected', 'connected']),
  connectedAt: z.string().nullable().optional(),
});

export const payoutSummarySchema = z.object({
  currency: z.string(),
  availableForPayoutCents: z.number().int(),
  pendingPayoutRequestsCents: z.number().int(),
  paidOutCents: z.number().int(),
  payoutAccount: payoutAccountSchema,
});

export type WalletDto = z.infer<typeof walletSchema>;
export type LedgerEntryDto = z.infer<typeof ledgerEntrySchema>;
export type DemoTopUpRequest = z.infer<typeof demoTopUpRequestSchema>;
export type DemoPayoutRequest = z.infer<typeof demoPayoutRequestSchema>;
export type PayoutRequestStatus = z.infer<typeof payoutRequestStatusSchema>;
export type PayoutRequestDto = z.infer<typeof payoutRequestSchema>;
export type PayoutAccountDto = z.infer<typeof payoutAccountSchema>;
export type PayoutSummaryDto = z.infer<typeof payoutSummarySchema>;
