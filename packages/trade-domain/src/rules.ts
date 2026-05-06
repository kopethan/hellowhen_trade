import type { TradeStatus } from './statuses';

export function isPublicTradeStatus(status: TradeStatus): boolean {
  return status === 'active' || status === 'funded' || status === 'in_progress' || status === 'submitted';
}

export function canOwnerCloseTrade(status: TradeStatus): boolean {
  return status === 'draft' || status === 'active' || status === 'funded' || status === 'in_progress';
}

export function canExpireTrade(status: TradeStatus): boolean {
  return status === 'draft' || status === 'active' || status === 'funded';
}

export function assertPositiveCreditAmount(creditAmount: number): void {
  if (!Number.isInteger(creditAmount) || creditAmount <= 0) {
    throw new Error('Credit amount must be a positive integer.');
  }
}
