import type { Need, Offer } from './types';
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

export function assertTradeHasNeedAndOffer(input: { needId?: string | null; offerId?: string | null }): void {
  if (!input.needId || !input.offerId) {
    throw new Error('A trade must be created from one saved Need and one saved Offer.');
  }
}

export function buildNeedMetaSummary(need: Pick<Need, 'category' | 'timing' | 'mode' | 'locationLabel'>): string {
  return [need.category, need.timing, need.mode, need.locationLabel].filter(Boolean).join(' - ');
}

export function buildOfferMetaSummary(offer: Pick<Offer, 'category' | 'availability' | 'mode' | 'locationLabel'>): string {
  return [offer.category, offer.availability, offer.mode, offer.locationLabel].filter(Boolean).join(' - ');
}
