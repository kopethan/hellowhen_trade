import type { LedgerBalanceType, LedgerEntryType } from './statuses';

export type LedgerDraft = { type: LedgerEntryType; balanceType: LedgerBalanceType; amount: number; userId: string; tradeId?: string | null; description?: string | null };

export function makeFakeCreditGrant(userId: string, amount = 100): LedgerDraft {
  return { userId, amount, type: 'starting_demo_credits', balanceType: 'purchased', description: 'Starting demo credits for fake/test trades.' };
}

export function isWithdrawableBalanceType(balanceType: LedgerBalanceType): boolean {
  return balanceType === 'earned_available';
}
