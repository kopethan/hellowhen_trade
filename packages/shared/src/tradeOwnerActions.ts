export type OwnerActionTradeLike = {
  status?: string | null;
  isPublic?: boolean | null;
  providerId?: string | null;
  expiresAt?: string | Date | null;
  _count?: { proposals?: number | null } | null;
};

export function isTradeOwnerCloseAllowed(trade: OwnerActionTradeLike) {
  return ['draft', 'active', 'expired'].includes(trade.status ?? '');
}

export function isTradeOwnerRenewAllowed(trade: OwnerActionTradeLike) {
  return !trade.providerId && ['active', 'expired', 'closed'].includes(trade.status ?? '');
}

export function getTradeOwnerVisibilityState(trade: OwnerActionTradeLike) {
  if (trade.status === 'active' && trade.isPublic) return 'public' as const;
  if (trade.status === 'active' && !trade.isPublic) return 'review_or_hidden' as const;
  if (['in_progress', 'submitted', 'completed'].includes(trade.status ?? '')) return 'private' as const;
  if (['closed', 'cancelled', 'expired'].includes(trade.status ?? '')) return trade.status as 'closed' | 'cancelled' | 'expired';
  return 'private' as const;
}
