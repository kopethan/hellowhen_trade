import type { MediaAssetDto, NeedDto, OfferDto, ProposalMessageDto, TradeDto, TradeProposalDto } from '@hellowhen/contracts';
export type TradeOwnerPreview = { id?: string; profile?: { displayName?: string | null; handle?: string | null; avatarUrl?: string | null } | null };
export type TradePaymentPreview = { id: string; buyerId: string; sellerId?: string | null; creditAmount: number; amountCents?: number; currency?: string; platformFee?: number; platformFeeCents?: number; status: string };
export type TradeEscrowPreview = { id: string; heldCredits: number; heldAmountCents?: number; currency?: string; holdReleasedAt?: string | null };
export type ProposalMessageItem = ProposalMessageDto & { sender?: TradeOwnerPreview | null };
export type TradeProposalItem = TradeProposalDto & { applicant?: TradeOwnerPreview | null; trade?: TradeDeckItem; messages?: ProposalMessageItem[] };
export type NeedItem = NeedDto & { media?: MediaAssetDto[] };
export type OfferItem = OfferDto & { media?: MediaAssetDto[] };
export type TradeDeckItem = TradeDto & { owner?: TradeOwnerPreview | null; provider?: TradeOwnerPreview | null; need?: NeedItem | null; offer?: OfferItem | null; payment?: TradePaymentPreview | null; escrow?: TradeEscrowPreview | null; media?: MediaAssetDto[]; amountCents?: number; currency?: string };
