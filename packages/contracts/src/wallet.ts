import { z } from 'zod';

export const walletSchema = z.object({
  id: z.string(), userId: z.string(), purchasedAvailableCredits: z.number().int(), earnedPendingCredits: z.number().int(), earnedAvailableCredits: z.number().int(), heldCredits: z.number().int(), updatedAt: z.string(),
});

export const ledgerEntrySchema = z.object({
  id: z.string(), userId: z.string(), walletId: z.string(), tradeId: z.string().nullable().optional(),
  type: z.enum(['starting_demo_credits', 'test_credit_grant', 'credit_purchase', 'trade_hold', 'trade_release', 'trade_refund', 'earned_pending', 'platform_fee', 'platform_fee_placeholder', 'payout_requested', 'payout_paid', 'adjustment']),
  balanceType: z.enum(['purchased', 'earned_pending', 'earned_available', 'held']),
  amount: z.number().int(), description: z.string().nullable().optional(), createdAt: z.string(),
});

export type WalletDto = z.infer<typeof walletSchema>;
export type LedgerEntryDto = z.infer<typeof ledgerEntrySchema>;
