export const needStatuses = ['draft', 'active', 'fulfilled', 'closed', 'expired'] as const;
export type NeedStatus = (typeof needStatuses)[number];

export const offerStatuses = ['draft', 'active', 'accepted', 'closed', 'expired'] as const;
export type OfferStatus = (typeof offerStatuses)[number];

export const tradeStatuses = [
  'draft',
  'active',
  'funded',
  'in_progress',
  'submitted',
  'completed',
  'disputed',
  'expired',
  'closed',
  'cancelled',
] as const;
export type TradeStatus = (typeof tradeStatuses)[number];

export const ledgerEntryTypes = [
  'test_credit_grant',
  'credit_purchase',
  'trade_hold',
  'trade_release',
  'trade_refund',
  'platform_fee',
  'payout_requested',
  'payout_paid',
  'adjustment',
] as const;
export type LedgerEntryType = (typeof ledgerEntryTypes)[number];

export const ledgerBalanceTypes = ['purchased', 'earned_pending', 'earned_available', 'held'] as const;
export type LedgerBalanceType = (typeof ledgerBalanceTypes)[number];
