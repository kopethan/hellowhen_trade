import { z } from 'zod';
import { mediaAssetSchema } from './media.js';
import { publicProfileTradeSummarySchema, publicVerificationBadgeSchema } from './users.js';
import { createNeedRequestSchema, createOfferRequestSchema, discoveryLanguageSchema, inventoryAvailabilityPresetSchema, inventoryDurationPresetSchema, inventoryItemTypeSchema, inventoryTemplateKindSchema, tradeExchangeModeSchema, updateNeedRequestSchema, updateOfferRequestSchema } from './trade.js';

export const businessProfileTypeSchema = z.enum(['business', 'agency', 'brand', 'enterprise']);
export const businessProfileStatusSchema = z.enum(['draft', 'active', 'pending_review', 'verified', 'restricted', 'disabled', 'rejected']);
export const businessProfileMemberRoleSchema = z.enum(['owner', 'admin', 'finance', 'member']);
export const businessProfileInvitationStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);
export const businessSponsoredPlacementSurfaceSchema = z.enum(['trades_feed', 'starter_library', 'needs_list', 'offers_list', 'business_profile']);
export const businessSponsoredPlacementTargetTypeSchema = z.enum(['need', 'offer', 'inventory_template']);
export const businessSponsoredPlacementStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'paused', 'archived']);
export const businessCampaignOpportunityTypeSchema = z.enum(['collaboration', 'creator_request', 'service_request', 'community', 'research', 'other']);
export const businessCampaignStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'paused', 'archived', 'completed']);
export const businessCampaignItemTargetTypeSchema = z.enum(['need', 'offer', 'inventory_template']);
export const businessCampaignApplicationStatusSchema = z.enum(['pending', 'reviewed', 'accepted', 'declined', 'withdrawn', 'archived']);
export const businessBudgetStatusSchema = z.enum(['draft', 'pending_provider_review', 'pending_admin_review', 'sandbox_ready', 'rejected', 'paused', 'archived']);
export const businessBudgetLedgerEntryTypeSchema = z.enum(['requested', 'reserved_preview', 'spend_preview', 'refund_preview', 'platform_fee_preview', 'adjustment']);
export const businessBudgetProviderSchema = z.enum(['none', 'stripe', 'airwallex']);

const optionalDateTime = z.string().trim().datetime().optional().nullable();
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const createBusinessProfileRequestSchema = z.object({
  type: businessProfileTypeSchema.optional().default('business'),
  displayName: z.string().trim().min(2).max(100),
  legalName: optionalText(160),
  handle: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).optional().nullable(),
  description: optionalText(1000),
  websiteUrl: z.string().trim().url().optional().nullable(),
  countryCode: z.string().trim().length(2).optional().nullable(),
  preferredCurrency: z.string().trim().length(3).optional().default('eur'),
});

export const updateBusinessProfileRequestSchema = createBusinessProfileRequestSchema.partial().extend({
  displayName: z.string().trim().min(2).max(100).optional(),
});


export const publicBusinessInventoryItemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  businessProfileId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  itemType: inventoryItemTypeSchema.optional().default('service'),
  category: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  availabilityPreset: inventoryAvailabilityPresetSchema.nullable().optional(),
  availabilityStartAt: z.string().nullable().optional(),
  availabilityEndAt: z.string().nullable().optional(),
  estimatedDurationPreset: inventoryDurationPresetSchema.nullable().optional(),
  estimatedDurationMinutes: z.number().int().nullable().optional(),
  typicalDurationPreset: inventoryDurationPresetSchema.nullable().optional(),
  typicalDurationMinutes: z.number().int().nullable().optional(),
  durationPreset: inventoryDurationPresetSchema.nullable().optional(),
  durationMinutes: z.number().int().nullable().optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  media: z.array(mediaAssetSchema).optional(),
}).passthrough();

export const publicBusinessProfileResponseSchema = z.object({
  businessProfile: z.object({
    id: z.string(),
    ownerId: z.string(),
    displayName: z.string(),
    legalName: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    handle: z.string().nullable().optional(),
    type: businessProfileTypeSchema,
    status: businessProfileStatusSchema,
    description: z.string().nullable().optional(),
    websiteUrl: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
    verifiedAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    badges: z.array(publicVerificationBadgeSchema).optional().default([]),
    counts: z.object({
      needs: z.number().int().nonnegative().optional(),
      offers: z.number().int().nonnegative().optional(),
      trades: z.number().int().nonnegative().optional(),
      inventoryTemplates: z.number().int().nonnegative().optional(),
      campaigns: z.number().int().nonnegative().optional(),
    }).optional(),
  }),
  stats: z.object({
    activeTradesCount: z.number().int().nonnegative(),
    openNeedsCount: z.number().int().nonnegative(),
    openOffersCount: z.number().int().nonnegative(),
  }),
  sections: z.object({
    activeTrades: z.array(publicProfileTradeSummarySchema),
    openNeeds: z.array(publicBusinessInventoryItemSchema),
    openOffers: z.array(publicBusinessInventoryItemSchema),
  }),
});

export const requestBusinessReviewRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const businessProviderOnboardingLinkRequestSchema = z.object({
  accountType: z.enum(['business', 'brand']).optional(),
  refreshUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

export const businessInviteMemberRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'finance', 'member']).optional().default('member'),
  note: z.string().trim().max(1000).optional(),
});

export const businessUpdateMemberRequestSchema = z.object({
  role: z.enum(['admin', 'finance', 'member']),
  note: z.string().trim().max(1000).optional(),
});

export const businessRemoveMemberRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const businessInvitationActionRequestSchema = z.object({
  action: z.enum(['revoke']),
  note: z.string().trim().max(1000).optional(),
});

export const businessAcceptInvitationRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

const businessInventoryTemplateBaseSchema = z.object({
  kind: inventoryTemplateKindSchema,
  title: z.string().trim().min(3).max(70),
  description: z.string().trim().min(10).max(500),
  itemType: inventoryItemTypeSchema.optional().default('service'),
  languageCode: discoveryLanguageSchema.optional().default('en'),
  countryCode: z.string().trim().length(2).optional().nullable(),
  category: z.string().trim().min(1).max(80).optional().nullable(),
  timing: z.string().trim().min(1).max(80).optional().nullable(),
  availability: z.string().trim().min(1).max(80).optional().nullable(),
  availabilityPreset: inventoryAvailabilityPresetSchema.optional().nullable(),
  availabilityStartAt: z.string().datetime().optional().nullable(),
  availabilityEndAt: z.string().datetime().optional().nullable(),
  durationPreset: inventoryDurationPresetSchema.optional().nullable(),
  durationMinutes: z.number().int().min(1).max(43200).optional().nullable(),
  mode: tradeExchangeModeSchema.optional().nullable(),
  locationLabel: z.string().trim().min(1).max(120).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional().default([]),
  includes: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  mediaIds: z.array(z.string().trim().min(1).max(128)).max(5).optional().default([]),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).optional().default(0),
});

export const businessCreateInventoryTemplateRequestSchema = businessInventoryTemplateBaseSchema;
export const businessUpdateInventoryTemplateRequestSchema = businessInventoryTemplateBaseSchema.partial().refine((value) => Object.keys(value).length > 0, { message: 'Update at least one template field.' });
export const businessListInventoryTemplatesQuerySchema = z.object({
  kind: z.enum(['all', 'need', 'offer']).optional().default('all'),
  status: z.enum(['all', 'draft', 'pending_review', 'active', 'rejected', 'archived']).optional().default('all'),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export const businessInventoryTemplateReviewRequestSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});
export const businessInventoryTemplateArchiveRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});


const businessOwnedInventoryCreateStatusSchema = z.enum(['draft', 'pending_review']);
const businessOwnedNeedManageStatusSchema = z.enum(['draft', 'pending_review', 'rejected', 'closed']);
const businessOwnedOfferManageStatusSchema = z.enum(['draft', 'pending_review', 'rejected', 'closed']);
const businessOwnedInventoryStatusFilterSchema = z.enum(['all', 'draft', 'pending_review', 'active', 'rejected', 'closed', 'expired', 'fulfilled', 'accepted']);

export const businessCreateNeedRequestSchema = createNeedRequestSchema.omit({ status: true }).extend({
  status: businessOwnedInventoryCreateStatusSchema.optional().default('draft'),
});
export const businessCreateOfferRequestSchema = createOfferRequestSchema.omit({ status: true }).extend({
  status: businessOwnedInventoryCreateStatusSchema.optional().default('draft'),
});
export const businessUpdateNeedRequestSchema = updateNeedRequestSchema.omit({ status: true }).extend({
  status: businessOwnedNeedManageStatusSchema.optional(),
});
export const businessUpdateOfferRequestSchema = updateOfferRequestSchema.omit({ status: true }).extend({
  status: businessOwnedOfferManageStatusSchema.optional(),
});
export const businessListOwnedInventoryQuerySchema = z.object({
  status: businessOwnedInventoryStatusFilterSchema.optional().default('all'),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export const businessOwnedInventoryReviewRequestSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});
export const businessOwnedInventoryArchiveRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const businessSponsoredPlacementListQuerySchema = z.object({
  status: z.enum(['all', 'draft', 'pending_review', 'approved', 'rejected', 'paused', 'archived']).optional().default('all'),
  surface: z.enum(['all', 'trades_feed', 'starter_library', 'needs_list', 'offers_list', 'business_profile']).optional().default('all'),
  targetType: z.enum(['all', 'need', 'offer', 'inventory_template']).optional().default('all'),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const businessSponsoredPlacementBaseSchema = z.object({
  targetType: businessSponsoredPlacementTargetTypeSchema,
  targetId: z.string().trim().min(1).max(128),
  surface: businessSponsoredPlacementSurfaceSchema,
  label: z.string().trim().min(2).max(40).optional().default('Sponsored'),
  priority: z.coerce.number().int().min(-1000).max(1000).optional().default(0),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
});

export const businessCreateSponsoredPlacementRequestSchema = businessSponsoredPlacementBaseSchema.extend({
  status: z.enum(['draft', 'pending_review']).optional().default('draft'),
  note: z.string().trim().max(1000).optional(),
}).refine((value) => !value.startsAt || !value.endsAt || new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime(), { message: 'The end date must be after the start date.', path: ['endsAt'] });

export const businessUpdateSponsoredPlacementRequestSchema = businessSponsoredPlacementBaseSchema.partial().extend({
  note: z.string().trim().max(1000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Update at least one sponsored placement field.' }).refine((value) => !value.startsAt || !value.endsAt || new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime(), { message: 'The end date must be after the start date.', path: ['endsAt'] });

export const businessSponsoredPlacementReviewRequestSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});

export const businessSponsoredPlacementArchiveRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});


const businessCampaignBaseSchema = z.object({
  opportunityType: businessCampaignOpportunityTypeSchema.optional().default('collaboration'),
  title: z.string().trim().min(3).max(100),
  summary: z.string().trim().max(240).optional().nullable(),
  description: z.string().trim().min(20).max(2000),
  eligibility: z.string().trim().max(1000).optional().nullable(),
  deliverables: z.string().trim().max(1000).optional().nullable(),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
});

function validDateWindow(value: { startsAt?: string | null; endsAt?: string | null }) {
  return !value.startsAt || !value.endsAt || new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime();
}

export const businessCampaignListQuerySchema = z.object({
  status: z.enum(['all', 'draft', 'pending_review', 'approved', 'rejected', 'paused', 'archived', 'completed']).optional().default('all'),
  opportunityType: z.enum(['all', 'collaboration', 'creator_request', 'service_request', 'community', 'research', 'other']).optional().default('all'),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const businessCreateCampaignRequestSchema = businessCampaignBaseSchema.extend({
  status: z.enum(['draft', 'pending_review']).optional().default('draft'),
  note: z.string().trim().max(1000).optional(),
}).refine(validDateWindow, { message: 'The end date must be after the start date.', path: ['endsAt'] });

export const businessUpdateCampaignRequestSchema = businessCampaignBaseSchema.partial().extend({
  note: z.string().trim().max(1000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Update at least one campaign field.' }).refine(validDateWindow, { message: 'The end date must be after the start date.', path: ['endsAt'] });

export const businessCampaignReviewRequestSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});

export const businessCampaignArchiveRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const businessCreateCampaignItemRequestSchema = z.object({
  targetType: businessCampaignItemTargetTypeSchema,
  targetId: z.string().trim().min(1).max(128),
  note: z.string().trim().max(1000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).optional().default(0),
});

export const businessUpdateCampaignItemRequestSchema = z.object({
  note: z.string().trim().max(1000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Update at least one campaign item field.' });

export const businessCampaignItemActionRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const businessBudgetListQuerySchema = z.object({
  status: z.enum(['all', 'draft', 'pending_provider_review', 'pending_admin_review', 'sandbox_ready', 'rejected', 'paused', 'archived']).optional().default('all'),
  provider: z.enum(['all', 'none', 'stripe', 'airwallex']).optional().default('all'),
  campaignId: z.string().trim().min(1).max(128).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const businessBudgetBaseSchema = z.object({
  campaignId: z.string().trim().min(1).max(128).optional().nullable(),
  provider: businessBudgetProviderSchema.optional().default('none'),
  providerAccountId: z.string().trim().min(1).max(128).optional().nullable(),
  currency: z.string().trim().length(3).optional().default('eur'),
  requestedAmountCents: z.coerce.number().int().min(0).max(100000000).optional().default(0),
  platformFeeRateBps: z.coerce.number().int().min(0).max(10000).optional().default(1000),
  purpose: z.string().trim().min(3).max(1000).optional().nullable(),
  riskNote: z.string().trim().max(1000).optional().nullable(),
});

export const businessCreateBudgetRequestSchema = businessBudgetBaseSchema.extend({
  status: z.enum(['draft', 'pending_provider_review', 'pending_admin_review']).optional().default('draft'),
  note: z.string().trim().max(1000).optional(),
});

export const businessUpdateBudgetRequestSchema = businessBudgetBaseSchema.partial().extend({
  note: z.string().trim().max(1000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Update at least one Business budget field.' });

export const businessBudgetReviewRequestSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});

export const businessBudgetArchiveRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const adminBusinessCampaignListQuerySchema = businessCampaignListQuerySchema.extend({
  businessProfileId: z.string().trim().min(1).max(128).optional(),
});

export const adminBusinessBudgetListQuerySchema = businessBudgetListQuerySchema.extend({
  businessProfileId: z.string().trim().min(1).max(128).optional(),
});

export const adminBusinessBudgetActionRequestSchema = z.object({
  action: z.enum(['approve', 'reject', 'pause', 'archive', 'restore']),
  note: z.string().trim().min(3).max(1000),
});

export const adminBusinessCampaignActionRequestSchema = z.object({
  action: z.enum(['approve', 'reject', 'pause', 'archive', 'restore', 'complete']),
  note: z.string().trim().min(3).max(1000),
});

export const adminBusinessSponsoredPlacementListQuerySchema = businessSponsoredPlacementListQuerySchema.extend({
  businessProfileId: z.string().trim().min(1).max(128).optional(),
});

export const adminBusinessSponsoredPlacementActionRequestSchema = z.object({
  action: z.enum(['approve', 'reject', 'pause', 'archive', 'restore']),
  note: z.string().trim().min(3).max(1000),
});

export const adminBusinessProfileActionRequestSchema = z.object({
  action: z.enum(['verify', 'restrict', 'disable', 'reject', 'activate']),
  note: z.string().trim().min(3).max(1000),
  disablePublicContent: z.boolean().optional().default(false),
});

export type BusinessProfileType = z.infer<typeof businessProfileTypeSchema>;
export type BusinessProfileStatus = z.infer<typeof businessProfileStatusSchema>;
export type BusinessProfileMemberRole = z.infer<typeof businessProfileMemberRoleSchema>;
export type BusinessProfileInvitationStatus = z.infer<typeof businessProfileInvitationStatusSchema>;
export type BusinessSponsoredPlacementSurface = z.infer<typeof businessSponsoredPlacementSurfaceSchema>;
export type BusinessSponsoredPlacementTargetType = z.infer<typeof businessSponsoredPlacementTargetTypeSchema>;
export type BusinessSponsoredPlacementStatus = z.infer<typeof businessSponsoredPlacementStatusSchema>;
export type BusinessCampaignOpportunityType = z.infer<typeof businessCampaignOpportunityTypeSchema>;
export type BusinessCampaignStatus = z.infer<typeof businessCampaignStatusSchema>;
export type BusinessCampaignItemTargetType = z.infer<typeof businessCampaignItemTargetTypeSchema>;
export type BusinessCampaignApplicationStatus = z.infer<typeof businessCampaignApplicationStatusSchema>;
export type BusinessBudgetStatus = z.infer<typeof businessBudgetStatusSchema>;
export type BusinessBudgetLedgerEntryType = z.infer<typeof businessBudgetLedgerEntryTypeSchema>;
export type CreateBusinessProfileRequest = z.infer<typeof createBusinessProfileRequestSchema>;
export type UpdateBusinessProfileRequest = z.infer<typeof updateBusinessProfileRequestSchema>;
export type RequestBusinessReviewRequest = z.infer<typeof requestBusinessReviewRequestSchema>;
export type PublicBusinessInventoryItem = z.infer<typeof publicBusinessInventoryItemSchema>;
export type PublicBusinessProfileResponse = z.infer<typeof publicBusinessProfileResponseSchema>;
export type BusinessProviderOnboardingLinkRequest = z.infer<typeof businessProviderOnboardingLinkRequestSchema>;
export type BusinessInviteMemberRequest = z.infer<typeof businessInviteMemberRequestSchema>;
export type BusinessUpdateMemberRequest = z.infer<typeof businessUpdateMemberRequestSchema>;
export type BusinessRemoveMemberRequest = z.infer<typeof businessRemoveMemberRequestSchema>;
export type BusinessInvitationActionRequest = z.infer<typeof businessInvitationActionRequestSchema>;
export type BusinessAcceptInvitationRequest = z.infer<typeof businessAcceptInvitationRequestSchema>;
export type BusinessCreateInventoryTemplateRequest = z.infer<typeof businessCreateInventoryTemplateRequestSchema>;
export type BusinessUpdateInventoryTemplateRequest = z.infer<typeof businessUpdateInventoryTemplateRequestSchema>;
export type BusinessListInventoryTemplatesQuery = z.infer<typeof businessListInventoryTemplatesQuerySchema>;
export type BusinessInventoryTemplateReviewRequest = z.infer<typeof businessInventoryTemplateReviewRequestSchema>;
export type BusinessInventoryTemplateArchiveRequest = z.infer<typeof businessInventoryTemplateArchiveRequestSchema>;
export type BusinessCreateNeedRequest = z.infer<typeof businessCreateNeedRequestSchema>;
export type BusinessCreateOfferRequest = z.infer<typeof businessCreateOfferRequestSchema>;
export type BusinessUpdateNeedRequest = z.infer<typeof businessUpdateNeedRequestSchema>;
export type BusinessUpdateOfferRequest = z.infer<typeof businessUpdateOfferRequestSchema>;
export type BusinessListOwnedInventoryQuery = z.infer<typeof businessListOwnedInventoryQuerySchema>;
export type BusinessOwnedInventoryReviewRequest = z.infer<typeof businessOwnedInventoryReviewRequestSchema>;
export type BusinessOwnedInventoryArchiveRequest = z.infer<typeof businessOwnedInventoryArchiveRequestSchema>;
export type BusinessSponsoredPlacementListQuery = z.infer<typeof businessSponsoredPlacementListQuerySchema>;
export type BusinessCreateSponsoredPlacementRequest = z.infer<typeof businessCreateSponsoredPlacementRequestSchema>;
export type BusinessUpdateSponsoredPlacementRequest = z.infer<typeof businessUpdateSponsoredPlacementRequestSchema>;
export type BusinessSponsoredPlacementReviewRequest = z.infer<typeof businessSponsoredPlacementReviewRequestSchema>;
export type BusinessSponsoredPlacementArchiveRequest = z.infer<typeof businessSponsoredPlacementArchiveRequestSchema>;
export type BusinessCampaignListQuery = z.infer<typeof businessCampaignListQuerySchema>;
export type BusinessCreateCampaignRequest = z.infer<typeof businessCreateCampaignRequestSchema>;
export type BusinessUpdateCampaignRequest = z.infer<typeof businessUpdateCampaignRequestSchema>;
export type BusinessCampaignReviewRequest = z.infer<typeof businessCampaignReviewRequestSchema>;
export type BusinessCampaignArchiveRequest = z.infer<typeof businessCampaignArchiveRequestSchema>;
export type BusinessCreateCampaignItemRequest = z.infer<typeof businessCreateCampaignItemRequestSchema>;
export type BusinessUpdateCampaignItemRequest = z.infer<typeof businessUpdateCampaignItemRequestSchema>;
export type BusinessCampaignItemActionRequest = z.infer<typeof businessCampaignItemActionRequestSchema>;
export type BusinessBudgetListQuery = z.infer<typeof businessBudgetListQuerySchema>;
export type BusinessCreateBudgetRequest = z.infer<typeof businessCreateBudgetRequestSchema>;
export type BusinessUpdateBudgetRequest = z.infer<typeof businessUpdateBudgetRequestSchema>;
export type BusinessBudgetReviewRequest = z.infer<typeof businessBudgetReviewRequestSchema>;
export type BusinessBudgetArchiveRequest = z.infer<typeof businessBudgetArchiveRequestSchema>;
export type AdminBusinessCampaignListQuery = z.infer<typeof adminBusinessCampaignListQuerySchema>;
export type AdminBusinessCampaignActionRequest = z.infer<typeof adminBusinessCampaignActionRequestSchema>;
export type AdminBusinessBudgetListQuery = z.infer<typeof adminBusinessBudgetListQuerySchema>;
export type AdminBusinessBudgetActionRequest = z.infer<typeof adminBusinessBudgetActionRequestSchema>;
export type AdminBusinessSponsoredPlacementListQuery = z.infer<typeof adminBusinessSponsoredPlacementListQuerySchema>;
export type AdminBusinessSponsoredPlacementActionRequest = z.infer<typeof adminBusinessSponsoredPlacementActionRequestSchema>;
export type AdminBusinessProfileActionRequest = z.infer<typeof adminBusinessProfileActionRequestSchema>;
