import { z } from 'zod';
import { userTrustTierSchema, walletLimitsSchema } from './wallet.js';

export const adminProfilePreviewSchema = z.object({
  displayName: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  handleChangedAt: z.string().nullable().optional(),
  handleChangeCount: z.number().int().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  preferredCurrency: z.string().nullable().optional(),
}).passthrough().nullable().optional();

export const adminWalletPreviewSchema = z.object({
  availableBalanceCents: z.number().int().optional(),
  heldBalanceCents: z.number().int().optional(),
  pendingPayoutCents: z.number().int().optional(),
  currency: z.string().optional(),
}).passthrough().nullable().optional();

export const adminUserPreviewSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['user', 'admin']).optional(),
  trustTier: userTrustTierSchema.optional(),
  emailVerifiedAt: z.string().nullable().optional(),
  ageConfirmedAt: z.string().nullable().optional(),
  declaredAgeBucket: z.string().nullable().optional(),
  twoFactorEnabled: z.boolean().optional(),
  createdAt: z.string().optional(),
  profile: adminProfilePreviewSchema,
}).passthrough();

export const adminUserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['user', 'admin']),
  trustTier: userTrustTierSchema,
  trustTierUpdatedAt: z.string().nullable().optional(),
  trustTierNote: z.string().nullable().optional(),
  emailVerifiedAt: z.string().nullable().optional(),
  ageConfirmedAt: z.string().nullable().optional(),
  declaredAgeBucket: z.string().nullable().optional(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable().optional(),
  profile: adminProfilePreviewSchema,
  wallet: adminWalletPreviewSchema,
  _count: z.object({ needs: z.number().int(), offers: z.number().int(), trades: z.number().int(), supportTickets: z.number().int(), mediaAssets: z.number().int() }).optional(),
  limits: walletLimitsSchema.optional(),
}).passthrough();

export const adminSupportTicketPreviewSchema = z.object({
  id: z.string(),
  subject: z.string(),
  status: z.string(),
  priority: z.string(),
  category: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string(),
  user: adminUserPreviewSchema.nullable().optional(),
  _count: z.object({ messages: z.number().int().optional() }).optional(),
}).passthrough();

export const adminAuditLogSchema = z.object({
  id: z.string(),
  adminId: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  previousValue: z.unknown().optional(),
  nextValue: z.unknown().optional(),
  metadata: z.unknown().optional(),
  createdAt: z.string(),
  admin: adminUserPreviewSchema.nullable().optional(),
}).passthrough();

export const adminOverviewResponseSchema = z.object({
  summary: z.object({
    users: z.object({ total: z.number().int(), new24h: z.number().int(), new7d: z.number().int(), admins: z.number().int(), restricted: z.number().int() }),
    content: z.object({ activeTrades: z.number().int(), disputedTrades: z.number().int(), activeNeeds: z.number().int(), activeOffers: z.number().int() }),
    support: z.object({ open: z.number().int(), urgent: z.number().int() }),
    reports: z.object({ pending: z.number().int(), reviewing: z.number().int() }),
    media: z.object({ pendingReview: z.number().int(), flagged: z.number().int() }),
    money: z.object({
      moneyFeaturesVisible: z.boolean(),
      walletVisible: z.boolean(),
      payoutsVisible: z.boolean(),
      moneyTradesEnabled: z.boolean(),
      realMoneyEnabled: z.boolean(),
      moneyProvider: z.string(),
      moneyProviderEnvironment: z.string(),
    }),
  }),
  recentUsers: z.array(adminUserSummarySchema).default([]),
  recentTickets: z.array(adminSupportTicketPreviewSchema).default([]),
  recentAuditLogs: z.array(adminAuditLogSchema).default([]),
});

export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserSummarySchema),
});

export const adminAuditLogResponseSchema = z.object({
  logs: z.array(adminAuditLogSchema),
});

export const adminUserModerationActionRequestSchema = z.object({
  action: z.enum(['suspend', 'restore', 'mark_reviewed', 'force_logout']),
  note: z.string().trim().min(3).max(1200).optional(),
  trustTier: userTrustTierSchema.optional(),
});

export const adminUpdateUsernameRequestSchema = z.object({
  handle: z.string().trim().min(3).max(32),
  note: z.string().trim().min(3).max(1200),
});

export const adminContentTypeSchema = z.enum(['trade', 'need', 'offer']);
export const adminContentActionRequestSchema = z.object({
  action: z.enum(['approve', 'reject', 'hide', 'restore', 'close', 'mark_reviewed']),
  note: z.string().trim().min(3).max(1200).optional(),
});
export const adminListContentQuerySchema = z.object({
  type: z.enum(['all', 'trade', 'need', 'offer']).optional().default('all'),
  q: z.string().trim().min(1).max(120).optional(),
  ownerId: z.string().trim().min(1).optional(),
  businessProfileId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  take: z.coerce.number().int().min(1).max(250).optional().default(100),
});

export const adminContentOwnerSchema = adminUserPreviewSchema.passthrough().nullable().optional();
export const adminContentItemSchema = z.object({
  id: z.string(),
  type: adminContentTypeSchema,
  ownerId: z.string(),
  businessProfileId: z.string().nullable().optional(),
  businessProfile: z.unknown().nullable().optional(),
  title: z.string(),
  description: z.string().optional().default(''),
  status: z.string(),
  isPublic: z.boolean().optional(),
  postType: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  itemType: z.string().nullable().optional(),
  mode: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  owner: adminContentOwnerSchema,
  mediaCount: z.number().int().optional().default(0),
  proposalCount: z.number().int().optional().default(0),
  linkedTradeCount: z.number().int().optional().default(0),
  publicDiscoverable: z.boolean().optional(),
  visibilityBlockers: z.array(z.string()).optional().default([]),
}).passthrough();

export const adminContentResponseSchema = z.object({
  content: z.array(adminContentItemSchema),
});
export const adminContentActionResponseSchema = z.object({
  item: adminContentItemSchema,
});


export const adminContentClassificationTargetTypeSchema = z.enum(['need', 'offer', 'trade', 'profile', 'business_template', 'business_need', 'business_offer', 'business_campaign']);
export const adminContentClassificationSourceSchema = z.enum(['rules', 'ai', 'admin']);
export const adminContentClassificationStatusSchema = z.enum(['pending', 'completed', 'failed', 'reviewed', 'overridden']);
export const adminContentPlacementSignalStatusSchema = z.enum(['pending', 'active', 'disabled', 'archived']);
export const adminContentSafetyCategorySchema = z.enum(['safe', 'adult', 'sexual', 'violence', 'hate_or_harassment', 'self_harm', 'illegal_or_regulated', 'spam_or_scam', 'unknown']);
export const adminContentSafetySeveritySchema = z.enum(['none', 'low', 'medium', 'high', 'critical']);
export const adminContentSuggestedActionSchema = z.enum(['allow', 'review', 'hide']);
export const adminContentDomainCategorySchema = z.enum(['design', 'development', 'photography_video', 'writing_copywriting', 'translation_language', 'marketing_social', 'business_startup', 'education_tutoring', 'local_help', 'events_community', 'creative_art', 'health_wellness', 'home_practical', 'other']);

export const adminContentIntelligenceTargetSchema = z.object({
  id: z.string(),
  type: adminContentClassificationTargetTypeSchema,
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  owner: adminUserPreviewSchema.nullable().optional(),
  businessProfileId: z.string().nullable().optional(),
  businessProfile: z.unknown().nullable().optional(),
  href: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
}).passthrough().nullable();


export const adminContentPlacementSignalSchema = z.object({
  id: z.string(),
  targetType: adminContentClassificationTargetTypeSchema,
  targetId: z.string(),
  source: adminContentClassificationSourceSchema,
  status: adminContentPlacementSignalStatusSchema,
  sourceClassificationId: z.string().nullable().optional(),
  category: adminContentDomainCategorySchema.nullable().optional(),
  tags: z.array(z.string()).default([]),
  suggestedNewTags: z.array(z.string()).default([]),
  safetyCategory: adminContentSafetyCategorySchema,
  safetySeverity: adminContentSafetySeveritySchema,
  adultRelated: z.boolean(),
  childSafe: z.boolean(),
  spamOrScamRisk: z.boolean(),
  regulatedRisk: z.boolean(),
  contextualEligible: z.boolean(),
  businessPlacementEligible: z.boolean(),
  adsPlacementEligible: z.boolean(),
  surfaces: z.array(z.string()).default([]),
  reason: z.string().nullable().optional(),
  approvedById: z.string().nullable().optional(),
  approvedBy: adminUserPreviewSchema.nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const adminContentClassificationSchema = z.object({
  id: z.string(),
  targetType: adminContentClassificationTargetTypeSchema,
  targetId: z.string(),
  source: adminContentClassificationSourceSchema,
  status: adminContentClassificationStatusSchema,
  userCategory: z.string().nullable().optional(),
  systemCategory: adminContentDomainCategorySchema.nullable().optional(),
  categoryConfidence: z.number().nullable().optional(),
  categoryMismatch: z.boolean(),
  suggestedTags: z.array(z.string()).default([]),
  suggestedNewTags: z.array(z.string()).default([]),
  safetyCategory: adminContentSafetyCategorySchema,
  safetySeverity: adminContentSafetySeveritySchema,
  adultRelated: z.boolean(),
  childSafe: z.boolean(),
  spamOrScamRisk: z.boolean(),
  regulatedRisk: z.boolean(),
  suggestedAction: adminContentSuggestedActionSchema,
  reason: z.string().nullable().optional(),
  reviewedById: z.string().nullable().optional(),
  reviewedBy: adminUserPreviewSchema.nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  adminNote: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  target: adminContentIntelligenceTargetSchema.optional(),
  placementSignal: adminContentPlacementSignalSchema.nullable().optional(),
}).passthrough();

export const adminListContentClassificationsQuerySchema = z.object({
  targetType: z.union([z.literal('all'), adminContentClassificationTargetTypeSchema]).optional().default('all'),
  source: z.union([z.literal('all'), adminContentClassificationSourceSchema]).optional().default('all'),
  status: z.union([z.literal('all'), adminContentClassificationStatusSchema]).optional().default('all'),
  safetyCategory: z.union([z.literal('all'), adminContentSafetyCategorySchema]).optional().default('all'),
  safetySeverity: z.union([z.literal('all'), adminContentSafetySeveritySchema]).optional().default('all'),
  suggestedAction: z.union([z.literal('all'), adminContentSuggestedActionSchema]).optional().default('all'),
  systemCategory: z.union([z.literal('all'), adminContentDomainCategorySchema]).optional().default('all'),
  categoryMismatch: z.enum(['all', 'true', 'false']).optional().default('all'),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(250).optional().default(100),
});

export const adminContentClassificationSummarySchema = z.object({
  total: z.number().int(),
  needsReview: z.number().int(),
  highRisk: z.number().int(),
  categoryMismatch: z.number().int(),
  adultOrSexual: z.number().int(),
  spamOrScam: z.number().int(),
  regulated: z.number().int(),
  failed: z.number().int(),
});

export const adminContentClassificationsResponseSchema = z.object({
  flags: z.object({
    contentIntelligenceEnabled: z.boolean(),
    contentClassificationEnabled: z.boolean(),
    aiModerationSuggestionsEnabled: z.boolean(),
    autoModerationActionsEnabled: z.boolean(),
    aiProvider: z.enum(['none', 'openai', 'gemini', 'groq']).optional(),
    aiAdminOnlySuggestionsAvailable: z.boolean().optional(),
    aiAdminOnlySuggestionsDisabledReason: z.string().nullable().optional(),
    contentPlacementSignalsEnabled: z.boolean().optional(),
    businessContextualSignalsEnabled: z.boolean().optional(),
    contextualAdSignalsEnabled: z.boolean().optional(),
    placementSignalsAvailable: z.boolean().optional(),
    placementSignalsDisabledReason: z.string().nullable().optional(),
  }),
  summary: adminContentClassificationSummarySchema,
  classifications: z.array(adminContentClassificationSchema),
});

export const adminContentClassificationActionRequestSchema = z.object({
  action: z.enum(['mark_reviewed', 'override']),
  adminNote: z.string().trim().min(3).max(1200).optional(),
  systemCategory: adminContentDomainCategorySchema.nullable().optional(),
  safetyCategory: adminContentSafetyCategorySchema.optional(),
  safetySeverity: adminContentSafetySeveritySchema.optional(),
  suggestedAction: adminContentSuggestedActionSchema.optional(),
  categoryMismatch: z.boolean().optional(),
  suggestedTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  suggestedNewTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  adultRelated: z.boolean().optional(),
  childSafe: z.boolean().optional(),
  spamOrScamRisk: z.boolean().optional(),
  regulatedRisk: z.boolean().optional(),
});

export const adminContentClassificationActionResponseSchema = z.object({
  classification: adminContentClassificationSchema,
});

export const adminContentClassificationAiSuggestionRequestSchema = z.object({
  adminNote: z.string().trim().min(3).max(1200).optional(),
});

export const adminContentClassificationAiSuggestionResponseSchema = z.object({
  classification: adminContentClassificationSchema,
});

export const adminContentClassificationPlacementSignalResponseSchema = z.object({
  signal: adminContentPlacementSignalSchema,
});


export const adminLaunchChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['pass', 'warning', 'fail']),
  detail: z.string(),
  action: z.string().optional(),
});

export const adminLaunchChecklistResponseSchema = z.object({
  overallStatus: z.enum(['pass', 'warning', 'fail']),
  generatedAt: z.string(),
  items: z.array(adminLaunchChecklistItemSchema),
  summary: z.object({
    pass: z.number().int(),
    warning: z.number().int(),
    fail: z.number().int(),
  }),
});


export const adminRuntimeQaCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['pass', 'warning', 'fail']),
  detail: z.string(),
  action: z.string().optional(),
});

export const adminRuntimeQaResponseSchema = z.object({
  overallStatus: z.enum(['pass', 'warning', 'fail']),
  generatedAt: z.string(),
  launchMode: z.object({
    nodeEnv: z.string(),
    moneyLaunchMode: z.string(),
    moneyFeaturesVisible: z.boolean(),
    walletVisible: z.boolean(),
    payoutsVisible: z.boolean(),
    moneyTradesEnabled: z.boolean(),
    realMoneyEnabled: z.boolean(),
    adminRequireTwoFactor: z.boolean(),
  }),
  counts: z.object({
    restrictedUsersWithOpenSessions: z.number().int(),
    activePublicMoneyTradesWhileMoneyOff: z.number().int(),
    publicVisibilityLeaks: z.number().int(),
    pendingReports: z.number().int(),
    urgentSupportTickets: z.number().int(),
    pendingOrFlaggedMedia: z.number().int(),
  }),
  checks: z.array(adminRuntimeQaCheckSchema),
  rehearsal: z.array(z.object({
    step: z.number().int(),
    label: z.string(),
    expected: z.string(),
    operatorAction: z.string().optional(),
  })),
  summary: z.object({
    pass: z.number().int(),
    warning: z.number().int(),
    fail: z.number().int(),
  }),
});

export const adminModerationSmokeResponseSchema = z.object({
  checks: z.object({
    restrictedOwnersHiddenFromFeed: z.boolean(),
    closedNeedsHiddenFromFeed: z.boolean(),
    closedOffersHiddenFromFeed: z.boolean(),
    publicFeedUsesDiscoverableFilter: z.boolean(),
  }),
  counts: z.object({
    feedEligibleTrades: z.number().int(),
    feedEligibleRestrictedOwnerTrades: z.number().int(),
    feedEligibleClosedNeedTrades: z.number().int(),
    feedEligibleClosedOfferTrades: z.number().int(),
    publicTradesOwnedByRestrictedUsers: z.number().int(),
    publicTradesWithClosedNeeds: z.number().int(),
    publicTradesWithClosedOffers: z.number().int(),
    restrictedUsers: z.number().int(),
    activeNeedsOwnedByRestrictedUsers: z.number().int(),
    activeOffersOwnedByRestrictedUsers: z.number().int(),
  }),
  samples: z.object({
    publicTradesOwnedByRestrictedUsers: z.array(adminContentItemSchema).default([]),
    publicTradesWithClosedInventory: z.array(adminContentItemSchema).default([]),
  }),
});

export type AdminProfilePreview = z.infer<typeof adminProfilePreviewSchema>;
export type AdminWalletPreview = z.infer<typeof adminWalletPreviewSchema>;
export type AdminUserPreview = z.infer<typeof adminUserPreviewSchema>;
export type AdminAuditLogDto = z.infer<typeof adminAuditLogSchema>;
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;
export type AdminUserSummaryDto = z.infer<typeof adminUserSummarySchema>;
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;
export type AdminAuditLogResponse = z.infer<typeof adminAuditLogResponseSchema>;

export type AdminUserModerationActionRequest = z.infer<typeof adminUserModerationActionRequestSchema>;
export type AdminContentType = z.infer<typeof adminContentTypeSchema>;
export type AdminContentItemDto = z.infer<typeof adminContentItemSchema>;
export type AdminContentResponse = z.infer<typeof adminContentResponseSchema>;
export type AdminContentActionRequest = z.infer<typeof adminContentActionRequestSchema>;
export type AdminContentActionResponse = z.infer<typeof adminContentActionResponseSchema>;
export type AdminContentClassificationTargetType = z.infer<typeof adminContentClassificationTargetTypeSchema>;
export type AdminContentClassificationSource = z.infer<typeof adminContentClassificationSourceSchema>;
export type AdminContentClassificationStatus = z.infer<typeof adminContentClassificationStatusSchema>;
export type AdminContentPlacementSignalStatus = z.infer<typeof adminContentPlacementSignalStatusSchema>;
export type AdminContentSafetyCategory = z.infer<typeof adminContentSafetyCategorySchema>;
export type AdminContentSafetySeverity = z.infer<typeof adminContentSafetySeveritySchema>;
export type AdminContentSuggestedAction = z.infer<typeof adminContentSuggestedActionSchema>;
export type AdminContentDomainCategory = z.infer<typeof adminContentDomainCategorySchema>;
export type AdminContentIntelligenceTargetDto = z.infer<typeof adminContentIntelligenceTargetSchema>;
export type AdminContentPlacementSignalDto = z.infer<typeof adminContentPlacementSignalSchema>;
export type AdminContentClassificationDto = z.infer<typeof adminContentClassificationSchema>;
export type AdminContentClassificationsResponse = z.infer<typeof adminContentClassificationsResponseSchema>;
export type AdminContentClassificationActionRequest = z.infer<typeof adminContentClassificationActionRequestSchema>;
export type AdminContentClassificationActionResponse = z.infer<typeof adminContentClassificationActionResponseSchema>;
export type AdminContentClassificationAiSuggestionRequest = z.infer<typeof adminContentClassificationAiSuggestionRequestSchema>;
export type AdminContentClassificationAiSuggestionResponse = z.infer<typeof adminContentClassificationAiSuggestionResponseSchema>;
export type AdminContentClassificationPlacementSignalResponse = z.infer<typeof adminContentClassificationPlacementSignalResponseSchema>;
export type AdminRuntimeQaCheckDto = z.infer<typeof adminRuntimeQaCheckSchema>;
export type AdminRuntimeQaResponse = z.infer<typeof adminRuntimeQaResponseSchema>;
export type AdminModerationSmokeResponse = z.infer<typeof adminModerationSmokeResponseSchema>;
export type AdminLaunchChecklistItemDto = z.infer<typeof adminLaunchChecklistItemSchema>;
export type AdminLaunchChecklistResponse = z.infer<typeof adminLaunchChecklistResponseSchema>;

