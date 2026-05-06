import type { LedgerBalanceType, LedgerEntryType } from './statuses';

export type LedgerDraft = {
  type: LedgerEntryType;
  balanceType: LedgerBalanceType;
  amount: number;
  userId: string;
  tradeId?: string | null;
  description?: string | null;
};

export function makeFakeCreditGrant(userId: string, amount = 100): LedgerDraft {
  return {
    userId,
    amount,
    type: 'test_credit_grant',
    balanceType: 'purchased',
    description: 'Patch 1 fake starting credits for development.',
  };
}

export function isWithdrawableBalanceType(balanceType: LedgerBalanceType): boolean {
  return balanceType === 'earned_available';
}
