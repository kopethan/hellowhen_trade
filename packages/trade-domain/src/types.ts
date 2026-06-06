import type { NeedStatus, OfferStatus, ProposalStatus, TradeStatus, TradeExchangeMode } from './statuses';

export type TradeVisibility = 'public' | 'owner_private';
export type InventoryAvailabilityPreset = 'today' | 'this_week' | 'this_month' | 'flexible' | 'custom';
export type InventoryDurationPreset = 'min_15' | 'min_30' | 'hour_1' | 'hour_2' | 'half_day' | 'day_1' | 'flexible' | 'not_sure' | 'depends';

export type Need = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string | null;
  timing?: string | null;
  availabilityPreset?: InventoryAvailabilityPreset | null;
  availabilityStartAt?: string | null;
  availabilityEndAt?: string | null;
  estimatedDurationPreset?: InventoryDurationPreset | null;
  estimatedDurationMinutes?: number | null;
  mode?: TradeExchangeMode | null;
  locationLabel?: string | null;
  tags?: string[];
  status: NeedStatus;
  createdAt: string;
  expiresAt?: string | null;
};

export type Offer = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string | null;
  availability?: string | null;
  availabilityPreset?: InventoryAvailabilityPreset | null;
  availabilityStartAt?: string | null;
  availabilityEndAt?: string | null;
  typicalDurationPreset?: InventoryDurationPreset | null;
  typicalDurationMinutes?: number | null;
  mode?: TradeExchangeMode | null;
  locationLabel?: string | null;
  includes?: string[];
  tags?: string[];
  status: OfferStatus;
  createdAt: string;
  expiresAt?: string | null;
};

export type Trade = {
  id: string;
  ownerId: string;
  providerId?: string | null;
  needId?: string | null;
  offerId?: string | null;
  title: string;
  description: string;
  creditAmount: number;
  status: TradeStatus;
  isPublic: boolean;
  createdAt: string;
  expiresAt?: string | null;
  need?: Need | null;
  offer?: Offer | null;
};

export type TradeProposal = { id: string; tradeId: string; applicantId: string; message: string; status: ProposalStatus; createdAt: string; updatedAt: string; };
export type ProposalMessage = { id: string; proposalId: string; senderId: string; body: string; createdAt: string; };
