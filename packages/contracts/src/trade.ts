import { z } from 'zod';
import { mediaAssetSchema } from './media.js';

export const needStatusSchema = z.enum(['draft', 'active', 'fulfilled', 'closed', 'expired']);
export const offerStatusSchema = z.enum(['draft', 'active', 'accepted', 'closed', 'expired']);
export const tradeStatusSchema = z.enum(['draft', 'active', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'expired', 'closed', 'cancelled']);
export const tradeActionStatusSchema = z.enum(['active', 'in_progress', 'completed', 'cancelled']);
export const proposalStatusSchema = z.enum(['pending', 'accepted', 'declined', 'withdrawn']);
export const proposalActionStatusSchema = z.enum(['accepted', 'declined', 'withdrawn']);
export const tradeExchangeModeSchema = z.enum(['remote', 'local', 'hybrid']);

const tradeTagsSchema = z.array(z.string().trim().min(1).max(32)).max(8).optional();
const needMetadataSchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  timing: z.string().trim().min(1).max(80).optional(),
  mode: tradeExchangeModeSchema.optional(),
  locationLabel: z.string().trim().min(1).max(120).optional(),
  tags: tradeTagsSchema
});
const offerMetadataSchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  availability: z.string().trim().min(1).max(80).optional(),
  mode: tradeExchangeModeSchema.optional(),
  locationLabel: z.string().trim().min(1).max(120).optional(),
  includes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  tags: tradeTagsSchema
});

export const createNeedRequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  status: needStatusSchema.optional(),
  expiresAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string()).max(5).optional()
}).merge(needMetadataSchema);

export const createOfferRequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  status: offerStatusSchema.optional(),
  expiresAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string()).max(5).optional()
}).merge(offerMetadataSchema);

export const createTradeRequestSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(2000).optional(),
  creditAmount: z.number().int().positive().max(100000),
  needId: z.string().min(1).optional(),
  offerId: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  // Deprecated for the new mobile create flow. Trade deck images come from the selected Need and Offer.
  mediaIds: z.array(z.string()).max(5).optional()
}).refine((value) => Boolean(value.needId && value.offerId), {
  message: 'A trade must be created from one saved Need and one saved Offer.',
  path: ['needId']
});
export const updateTradeStatusRequestSchema = z.object({ status: tradeActionStatusSchema });
export const createTradeProposalRequestSchema = z.object({ message: z.string().min(3).max(1200) });
export const updateProposalStatusRequestSchema = z.object({ status: proposalActionStatusSchema });
export const createProposalMessageRequestSchema = z.object({ body: z.string().min(1).max(2000) });

export const profilePreviewSchema = z.object({ displayName: z.string().nullable().optional(), handle: z.string().nullable().optional(), avatarUrl: z.string().nullable().optional() }).nullable().optional();
export const userPreviewSchema = z.object({ id: z.string(), profile: profilePreviewSchema });

export const needSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: needStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  media: z.array(mediaAssetSchema).optional()
});

export const offerSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  includes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: offerStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  media: z.array(mediaAssetSchema).optional()
});

export const tradeSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  providerId: z.string().nullable().optional(),
  needId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  creditAmount: z.number().int(),
  status: tradeStatusSchema,
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  owner: userPreviewSchema.optional(),
  provider: userPreviewSchema.nullable().optional(),
  need: needSchema.nullable().optional(),
  offer: offerSchema.nullable().optional(),
  // Deprecated. Kept for legacy trades/admin compatibility; new deck UI should use need.media and offer.media.
  media: z.array(mediaAssetSchema).optional()
});
export const proposalMessageSchema = z.object({ id: z.string(), proposalId: z.string(), senderId: z.string(), body: z.string(), createdAt: z.string(), sender: userPreviewSchema.optional() });
export const tradeProposalSchema = z.object({ id: z.string(), tradeId: z.string(), applicantId: z.string(), message: z.string(), status: proposalStatusSchema, createdAt: z.string(), updatedAt: z.string(), respondedAt: z.string().nullable().optional(), applicant: userPreviewSchema.optional(), trade: tradeSchema.optional(), messages: z.array(proposalMessageSchema).optional() });

export type NeedDto = z.infer<typeof needSchema>;
export type OfferDto = z.infer<typeof offerSchema>;
export type TradeDto = z.infer<typeof tradeSchema>;
export type TradeStatus = z.infer<typeof tradeStatusSchema>;
export type TradeActionStatus = z.infer<typeof tradeActionStatusSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
export type ProposalActionStatus = z.infer<typeof proposalActionStatusSchema>;
export type TradeExchangeMode = z.infer<typeof tradeExchangeModeSchema>;
export type TradeProposalDto = z.infer<typeof tradeProposalSchema>;
export type ProposalMessageDto = z.infer<typeof proposalMessageSchema>;
export type CreateNeedRequest = z.infer<typeof createNeedRequestSchema>;
export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;
export type CreateTradeRequest = z.infer<typeof createTradeRequestSchema>;
export type UpdateTradeStatusRequest = z.infer<typeof updateTradeStatusRequestSchema>;
export type CreateTradeProposalRequest = z.infer<typeof createTradeProposalRequestSchema>;
export type UpdateProposalStatusRequest = z.infer<typeof updateProposalStatusRequestSchema>;
export type CreateProposalMessageRequest = z.infer<typeof createProposalMessageRequestSchema>;
