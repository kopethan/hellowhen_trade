import type { NeedStatus, OfferStatus, ProposalStatus, TradeStatus, TradeExchangeMode } from './statuses';

export type TradeVisibility = 'public' | 'owner_private';

export type Need = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string | null;
  timing?: string | null;
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
