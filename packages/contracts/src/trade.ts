import { z } from 'zod';
import { mediaAssetSchema } from './media.js';

export const needStatusSchema = z.enum(['draft', 'active', 'fulfilled', 'closed', 'expired']);
export const offerStatusSchema = z.enum(['draft', 'active', 'accepted', 'closed', 'expired']);
export const tradePostTypeSchema = z.enum(['need_offer', 'open_need', 'open_offer']);
export const tradeStatusSchema = z.enum(['draft', 'active', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'expired', 'closed', 'cancelled']);
export const tradeActionStatusSchema = z.enum(['active', 'in_progress', 'submitted', 'completed', 'disputed', 'cancelled']);
export const proposalStatusSchema = z.enum(['pending', 'accepted', 'declined', 'withdrawn']);
export const proposalActionStatusSchema = z.enum(['accepted', 'declined', 'withdrawn']);
export const tradeExchangeModeSchema = z.enum(['remote', 'local', 'hybrid']);
export const discoveryLanguageSchema = z.enum(['en', 'fr']);
export const inventoryItemTypeSchema = z.enum(['service', 'goods', 'other']);
export const inventoryTemplateKindSchema = z.enum(['need', 'offer']);
export const inventoryTemplateSourceTypeSchema = z.enum(['hellowhen', 'business', 'brand', 'partner']);
export const inventoryTemplateStatusSchema = z.enum(['draft', 'active', 'archived']);
export const cloneInventoryTemplateStatusSchema = z.enum(['draft', 'active']);
export const tradeNeedSideKindSchema = z.enum(['need', 'money']);
export const tradeOfferSideKindSchema = z.enum(['offer', 'money']);

export const INVENTORY_TITLE_MIN_LENGTH = 3;
export const INVENTORY_TITLE_MAX_LENGTH = 70;
export const INVENTORY_DESCRIPTION_MIN_LENGTH = 10;
export const INVENTORY_DESCRIPTION_MAX_LENGTH = 500;

const tradeTagsSchema = z.array(z.string().trim().min(1).max(32)).max(8).optional();
const needMetadataSchema = z.object({
  itemType: inventoryItemTypeSchema.optional().default('service'),
  category: z.string().trim().min(1).max(80).optional(),
  timing: z.string().trim().min(1).max(80).optional(),
  mode: tradeExchangeModeSchema.optional(),
  locationLabel: z.string().trim().min(1).max(120).optional(),
  tags: tradeTagsSchema
});
const offerMetadataSchema = z.object({
  itemType: inventoryItemTypeSchema.optional().default('service'),
  category: z.string().trim().min(1).max(80).optional(),
  availability: z.string().trim().min(1).max(80).optional(),
  mode: tradeExchangeModeSchema.optional(),
  locationLabel: z.string().trim().min(1).max(120).optional(),
  includes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  tags: tradeTagsSchema
});

export const createNeedRequestSchema = z.object({
  title: z.string().min(INVENTORY_TITLE_MIN_LENGTH).max(INVENTORY_TITLE_MAX_LENGTH),
  description: z.string().min(INVENTORY_DESCRIPTION_MIN_LENGTH).max(INVENTORY_DESCRIPTION_MAX_LENGTH),
  status: needStatusSchema.optional(),
  expiresAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string()).max(5).optional()
}).merge(needMetadataSchema);

export const createOfferRequestSchema = z.object({
  title: z.string().min(INVENTORY_TITLE_MIN_LENGTH).max(INVENTORY_TITLE_MAX_LENGTH),
  description: z.string().min(INVENTORY_DESCRIPTION_MIN_LENGTH).max(INVENTORY_DESCRIPTION_MAX_LENGTH),
  status: offerStatusSchema.optional(),
  expiresAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string()).max(5).optional()
}).merge(offerMetadataSchema);

export const createTradeRequestSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(2000).optional(),
  creditAmount: z.number().int().min(0).max(100000).optional().default(0),
  amountCents: z.number().int().min(0).max(10000000).optional().default(0),
  currency: z.string().trim().length(3).optional().default('eur'),
  postType: tradePostTypeSchema.optional().default('need_offer'),
  needKind: tradeNeedSideKindSchema.optional().default('need'),
  offerKind: tradeOfferSideKindSchema.optional().default('offer'),
  needId: z.string().min(1).optional(),
  offerId: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  // Deprecated for the new mobile create flow. Trade deck images come from the selected Need and Offer.
  mediaIds: z.array(z.string()).max(5).optional()
}).superRefine((value, ctx) => {
  const needIsMoney = value.needKind === 'money';
  const offerIsMoney = value.offerKind === 'money';
  const postType = value.postType ?? 'need_offer';

  if (needIsMoney && offerIsMoney) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A trade cannot request and offer wallet money at the same time.', path: ['offerKind'] });
  }

  if (postType === 'need_offer') {
    if (!needIsMoney && !value.needId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a saved Need or select money for I need.', path: ['needId'] });
    }
    if (!offerIsMoney && !value.offerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a saved Offer or select money for I offer.', path: ['offerId'] });
    }
  }

  if (postType === 'open_need') {
    if (needIsMoney) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Open Need posts must use one of your saved Needs.', path: ['needKind'] });
    }
    if (!value.needId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a saved Need to publish an Open Need.', path: ['needId'] });
    }
    if (value.offerId || offerIsMoney) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Open Need posts cannot include your own Offer. Others will propose offers.', path: ['offerId'] });
    }
  }

  if (postType === 'open_offer') {
    if (offerIsMoney) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Open Offer posts must use one of your saved Offers.', path: ['offerKind'] });
    }
    if (!value.offerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a saved Offer to publish an Open Offer.', path: ['offerId'] });
    }
    if (value.needId || needIsMoney) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Open Offer posts cannot include your own Need. Others will propose needs.', path: ['needId'] });
    }
  }

  if ((needIsMoney || offerIsMoney) && value.amountCents <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Money trades must include an amount greater than zero.', path: ['amountCents'] });
  }
  if (postType !== 'need_offer' && (value.amountCents > 0 || value.creditAmount > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Open Need and Open Offer posts cannot include wallet money yet.', path: ['amountCents'] });
  }
});

const inventoryUpdateBaseSchema = z.object({
  title: z.string().min(INVENTORY_TITLE_MIN_LENGTH).max(INVENTORY_TITLE_MAX_LENGTH).optional(),
  description: z.string().min(INVENTORY_DESCRIPTION_MIN_LENGTH).max(INVENTORY_DESCRIPTION_MAX_LENGTH).optional(),
  status: z.string().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  itemType: inventoryItemTypeSchema.optional(),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  timing: z.string().trim().min(1).max(80).nullable().optional(),
  availability: z.string().trim().min(1).max(80).nullable().optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().trim().min(1).max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  includes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  mediaIds: z.array(z.string()).max(5).optional(),
});

export const updateNeedRequestSchema = inventoryUpdateBaseSchema.extend({ status: needStatusSchema.optional() });
export const updateOfferRequestSchema = inventoryUpdateBaseSchema.extend({ status: offerStatusSchema.optional() });
export const listInventoryTemplatesQuerySchema = z.object({
  kind: inventoryTemplateKindSchema.optional(),
  itemType: inventoryItemTypeSchema.optional(),
  sourceType: inventoryTemplateSourceTypeSchema.optional(),
  businessProfileId: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  language: discoveryLanguageSchema.optional(),
  countryCode: z.string().trim().min(2).max(2).transform((value) => value.toUpperCase()).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export const cloneInventoryTemplateRequestSchema = z.object({
  status: cloneInventoryTemplateStatusSchema.optional().default('active'),
});
const feedSeenTradeIdsSchema = z.preprocess((value: unknown) => {
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(','));
  if (typeof value === 'string') return value.split(',');
  return value;
}, z.array(z.string().trim().min(1).max(120)).max(100).optional().transform((ids: string[] | undefined) => ids?.map((id: string) => id.trim()).filter(Boolean)));

export const listTradesFeedQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  language: discoveryLanguageSchema.optional(),
  countryCode: z.string().trim().min(2).max(2).transform((value) => value.toUpperCase()).optional(),
  mode: tradeExchangeModeSchema.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  hasImages: z.coerce.boolean().optional(),
  hasMoney: z.coerce.boolean().optional(),
  postType: tradePostTypeSchema.optional(),
  refreshSeed: z.string().trim().min(1).max(80).optional(),
  seenTradeIds: feedSeenTradeIdsSchema,
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export const updateTradeStatusRequestSchema = z.object({ status: tradeActionStatusSchema });
export const adminTradeDisputeActionRequestSchema = z.object({ action: z.enum(['refund_payer', 'release_seller', 'mark_resolved']), note: z.string().trim().max(1200).optional() });
export const createTradeProposalRequestSchema = z.object({
  message: z.string().min(3).max(1200),
  proposedNeedId: z.string().min(1).optional(),
  proposedOfferId: z.string().min(1).optional()
});
export const updateProposalStatusRequestSchema = z.object({ status: proposalActionStatusSchema });
export const createProposalMessageRequestSchema = z.object({ body: z.string().min(1).max(2000) });

export const profilePreviewSchema = z.object({ displayName: z.string().nullable().optional(), handle: z.string().nullable().optional(), avatarUrl: z.string().nullable().optional(), countryCode: z.string().nullable().optional() }).nullable().optional();
export const userPreviewSchema = z.object({ id: z.string(), profile: profilePreviewSchema });

export const needSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  sourceTemplateId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  itemType: inventoryItemTypeSchema.optional().default('service'),
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
  sourceTemplateId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  itemType: inventoryItemTypeSchema.optional().default('service'),
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

export const inventoryTemplateBusinessProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  handle: z.string().nullable().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
}).passthrough().nullable().optional();

export const inventoryTemplateSchema = z.object({
  id: z.string(),
  key: z.string(),
  kind: inventoryTemplateKindSchema,
  sourceType: inventoryTemplateSourceTypeSchema,
  businessProfileId: z.string().nullable().optional(),
  languageCode: discoveryLanguageSchema.optional().default('en'),
  countryCode: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  itemType: inventoryItemTypeSchema.optional().default('service'),
  category: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  status: inventoryTemplateStatusSchema,
  sortOrder: z.number().int().optional().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  businessProfile: inventoryTemplateBusinessProfileSchema,
});

export const cloneInventoryTemplateResponseSchema = z.object({
  template: inventoryTemplateSchema,
  need: needSchema.optional(),
  offer: offerSchema.optional(),
});

export const tradePaymentSchema = z.object({
  id: z.string(),
  tradeId: z.string().optional(),
  buyerId: z.string(),
  sellerId: z.string().nullable().optional(),
  creditAmount: z.number().int().optional().default(0),
  amountCents: z.number().int().optional().default(0),
  currency: z.string().optional().default('eur'),
  platformFee: z.number().int().optional().default(0),
  platformFeeCents: z.number().int().optional().default(0),
  status: z.string(),
}).passthrough();

export const tradeEscrowSchema = z.object({
  id: z.string(),
  tradeId: z.string().optional(),
  heldCredits: z.number().int().optional().default(0),
  heldAmountCents: z.number().int().optional().default(0),
  currency: z.string().optional().default('eur'),
  holdReleasedAt: z.string().nullable().optional(),
}).passthrough();

export const tradeSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  providerId: z.string().nullable().optional(),
  needId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  creditAmount: z.number().int(),
  amountCents: z.number().int().optional().default(0),
  currency: z.string().optional().default('eur'),
  postType: tradePostTypeSchema.optional().default('need_offer'),
  status: tradeStatusSchema,
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  deliverySubmittedById: z.string().nullable().optional(),
  deliverySubmittedAt: z.string().nullable().optional(),
  confirmedById: z.string().nullable().optional(),
  confirmedAt: z.string().nullable().optional(),
  disputedById: z.string().nullable().optional(),
  disputedAt: z.string().nullable().optional(),
  disputeTicketId: z.string().nullable().optional(),
  owner: userPreviewSchema.optional(),
  provider: userPreviewSchema.nullable().optional(),
  need: needSchema.nullable().optional(),
  offer: offerSchema.nullable().optional(),
  payment: tradePaymentSchema.nullable().optional(),
  escrow: tradeEscrowSchema.nullable().optional(),
  // Deprecated. Kept for legacy trades/admin compatibility; new deck UI should use need.media and offer.media.
  media: z.array(mediaAssetSchema).optional()
});
export const proposalMessageSchema = z.object({ id: z.string(), proposalId: z.string(), senderId: z.string(), body: z.string(), createdAt: z.string(), sender: userPreviewSchema.optional() });
export const tradeProposalSchema = z.object({
  id: z.string(),
  tradeId: z.string(),
  applicantId: z.string(),
  proposedNeedId: z.string().nullable().optional(),
  proposedOfferId: z.string().nullable().optional(),
  message: z.string(),
  status: proposalStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  respondedAt: z.string().nullable().optional(),
  applicant: userPreviewSchema.optional(),
  trade: tradeSchema.optional(),
  proposedNeed: needSchema.nullable().optional(),
  proposedOffer: offerSchema.nullable().optional(),
  messages: z.array(proposalMessageSchema).optional()
});

export type NeedDto = z.infer<typeof needSchema>;
export type OfferDto = z.infer<typeof offerSchema>;
export type InventoryTemplateDto = z.infer<typeof inventoryTemplateSchema>;
export type CloneInventoryTemplateResponse = z.infer<typeof cloneInventoryTemplateResponseSchema>;
export type TradeDto = z.infer<typeof tradeSchema>;
export type TradePostType = z.infer<typeof tradePostTypeSchema>;
export type TradeStatus = z.infer<typeof tradeStatusSchema>;
export type TradeActionStatus = z.infer<typeof tradeActionStatusSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
export type ProposalActionStatus = z.infer<typeof proposalActionStatusSchema>;
export type TradeExchangeMode = z.infer<typeof tradeExchangeModeSchema>;
export type DiscoveryLanguage = z.infer<typeof discoveryLanguageSchema>;
export type InventoryItemType = z.infer<typeof inventoryItemTypeSchema>;
export type InventoryTemplateKind = z.infer<typeof inventoryTemplateKindSchema>;
export type InventoryTemplateSourceType = z.infer<typeof inventoryTemplateSourceTypeSchema>;
export type InventoryTemplateStatus = z.infer<typeof inventoryTemplateStatusSchema>;
export type TradeNeedSideKind = z.infer<typeof tradeNeedSideKindSchema>;
export type TradeOfferSideKind = z.infer<typeof tradeOfferSideKindSchema>;
export type TradeProposalDto = z.infer<typeof tradeProposalSchema>;
export type ProposalMessageDto = z.infer<typeof proposalMessageSchema>;
export type CreateNeedRequest = z.infer<typeof createNeedRequestSchema>;
export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;
export type CreateTradeRequest = z.infer<typeof createTradeRequestSchema>;
export type UpdateNeedRequest = z.infer<typeof updateNeedRequestSchema>;
export type UpdateOfferRequest = z.infer<typeof updateOfferRequestSchema>;
export type ListInventoryTemplatesQuery = z.infer<typeof listInventoryTemplatesQuerySchema>;
export type CloneInventoryTemplateRequest = z.infer<typeof cloneInventoryTemplateRequestSchema>;
export type ListTradesFeedQuery = z.infer<typeof listTradesFeedQuerySchema>;
export type UpdateTradeStatusRequest = z.infer<typeof updateTradeStatusRequestSchema>;
export type AdminTradeDisputeActionRequest = z.infer<typeof adminTradeDisputeActionRequestSchema>;
export type CreateTradeProposalRequest = z.infer<typeof createTradeProposalRequestSchema>;
export type UpdateProposalStatusRequest = z.infer<typeof updateProposalStatusRequestSchema>;
export type CreateProposalMessageRequest = z.infer<typeof createProposalMessageRequestSchema>;
