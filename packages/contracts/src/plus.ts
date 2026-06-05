import { z } from 'zod';

export const plusSubscriptionTierSchema = z.enum(['free', 'plus', 'plus_later', 'pro', 'business_later']);
export const plusSubscriptionStatusSchema = z.enum(['none', 'trialing', 'active', 'past_due', 'canceled', 'expired']);
export const plusAiAssistTaskTypeSchema = z.enum([
  'need_title',
  'need_description',
  'offer_title',
  'offer_description',
  'proposal_message',
  'translate_text',
  'category_tags',
  'safety_readability',
]);
export const plusAiAssistUsageStatusSchema = z.enum(['reserved', 'completed', 'failed', 'refunded']);
export const plusGateBlockerSchema = z.enum(['plus_disabled', 'plus_hidden', 'not_on_plus_tier', 'subscription_not_active']);

export const plusSubscriptionConfigSchema = z.object({
  plusEnabled: z.boolean(),
  plusPublic: z.boolean(),
  aiAssistEnabled: z.boolean(),
  customizationEnabled: z.boolean(),
  adminGrantsEnabled: z.boolean(),
  monthlyPriceCents: z.number().int().nonnegative(),
  monthlyPriceCurrency: z.string(),
  yearlyPriceCents: z.number().int().nonnegative(),
  yearlyPriceCurrency: z.string(),
  freeMonthlyAiAssistQuota: z.number().int().nonnegative(),
  plusMonthlyAiAssistQuota: z.number().int().nonnegative(),
});

export const plusEntitlementsSchema = z.object({
  aiAssist: z.boolean(),
  customization: z.boolean(),
  monthlyAiAssistQuota: z.number().int().nonnegative(),
});

export const plusAccessSchema = z.object({
  canSeePlusSurfaces: z.boolean(),
  hasPlusAccess: z.boolean(),
  blockers: z.array(plusGateBlockerSchema),
  entitlements: plusEntitlementsSchema,
});

export const plusAiAssistQuotaSummarySchema = z.object({
  periodKey: z.string(),
  resetAt: z.string(),
  used: z.number().int().nonnegative(),
  quota: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  isUnlimited: z.literal(false),
  aiAssistEnabled: z.boolean(),
  planTier: plusSubscriptionTierSchema,
  subscriptionStatus: plusSubscriptionStatusSchema,
});

export const adminPlusAiAssistUsageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  periodKey: z.string(),
  taskType: plusAiAssistTaskTypeSchema,
  status: plusAiAssistUsageStatusSchema,
  planTierAtUse: plusSubscriptionTierSchema,
  quotaLimitAtUse: z.number().int().nonnegative(),
  inputHash: z.string().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  requestedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    profile: z.object({
      displayName: z.string().nullable().optional(),
      handle: z.string().nullable().optional(),
      avatarUrl: z.string().nullable().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
}).passthrough();

export const aiAssistTargetTypeSchema = z.enum(['need', 'offer', 'proposal', 'translation', 'category_tags', 'safety_readability', 'other']);
export const aiAssistRequestSchema = z.object({
  taskType: plusAiAssistTaskTypeSchema,
  targetType: aiAssistTargetTypeSchema.optional(),
  text: z.string().trim().min(1).max(4000),
  context: z.string().trim().max(1500).optional(),
  sourceLanguage: z.enum(['en', 'fr']).optional(),
  targetLanguage: z.enum(['en', 'fr']).optional(),
}).strict();

export const aiAssistSuggestionSchema = z.object({
  text: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  safetyNotes: z.array(z.string()).optional(),
  readabilityNotes: z.array(z.string()).optional(),
}).passthrough();

export const aiAssistResponseSchema = z.object({
  mode: z.literal('stub'),
  taskType: plusAiAssistTaskTypeSchema,
  suggestion: aiAssistSuggestionSchema,
  usage: plusAiAssistQuotaSummarySchema,
  usageRecord: z.object({
    id: z.string(),
    status: plusAiAssistUsageStatusSchema,
    periodKey: z.string(),
    taskType: plusAiAssistTaskTypeSchema,
    requestedAt: z.string(),
    completedAt: z.string().nullable().optional(),
  }),
  message: z.string(),
});

export const plusSubscriptionStateSchema = z.object({
  id: z.string(),
  tier: plusSubscriptionTierSchema,
  status: plusSubscriptionStatusSchema,
  provider: z.string().nullable().optional(),
  currentPeriodStartedAt: z.string().nullable().optional(),
  currentPeriodEndsAt: z.string().nullable().optional(),
  trialStartedAt: z.string().nullable().optional(),
  trialEndsAt: z.string().nullable().optional(),
  canceledAt: z.string().nullable().optional(),
  pastDueAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  lastSyncedAt: z.string().nullable().optional(),
  adminNote: z.string().nullable().optional(),
}).passthrough();

export const plusSubscriptionSnapshotResponseSchema = z.object({
  config: plusSubscriptionConfigSchema,
  state: z.object({
    subscriptionTier: plusSubscriptionTierSchema,
    subscriptionStatus: plusSubscriptionStatusSchema,
    subscriptionStatusUpdatedAt: z.string().nullable().optional(),
  }),
  subscriptionState: plusSubscriptionStateSchema.nullable(),
  access: plusAccessSchema,
  price: z.object({
    monthlyCents: z.number().int().nonnegative(),
    monthlyCurrency: z.string(),
    yearlyCents: z.number().int().nonnegative(),
    yearlyCurrency: z.string(),
  }),
  aiAssistUsage: plusAiAssistQuotaSummarySchema,
});

export const adminPlusGrantActionSchema = z.enum(['grant_plus', 'start_plus_trial', 'revoke_plus']);

export const adminPlusGrantRequestSchema = z.object({
  action: adminPlusGrantActionSchema,
  note: z.string().trim().min(3).max(500),
  currentPeriodEndsAt: z.string().datetime().nullable().optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  adminNote: z.string().trim().max(500).nullable().optional(),
});

export const adminPlusUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  trustTier: z.string(),
  subscriptionTier: plusSubscriptionTierSchema,
  subscriptionStatus: plusSubscriptionStatusSchema,
  subscriptionStatusUpdatedAt: z.string().nullable().optional(),
  emailVerifiedAt: z.string().nullable().optional(),
  ageConfirmedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  profile: z.object({
    displayName: z.string().nullable().optional(),
    handle: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  }).nullable().optional(),
  subscriptionState: plusSubscriptionStateSchema.nullable().optional(),
  access: plusAccessSchema,
  aiAssistUsage: plusAiAssistQuotaSummarySchema.optional(),
}).passthrough();

export const adminPlusUsersResponseSchema = z.object({
  users: z.array(adminPlusUserSchema),
  config: plusSubscriptionConfigSchema,
});

export const adminPlusGrantResponseSchema = z.object({
  user: adminPlusUserSchema,
  config: plusSubscriptionConfigSchema,
});

export const adminPlusAiAssistUsageResponseSchema = z.object({
  periodKey: z.string(),
  config: plusSubscriptionConfigSchema,
  summary: z.object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    refunded: z.number().int().nonnegative(),
  }),
  usage: z.array(adminPlusAiAssistUsageSchema),
});

export type AiAssistTargetType = z.infer<typeof aiAssistTargetTypeSchema>;
export type AiAssistRequest = z.infer<typeof aiAssistRequestSchema>;
export type AiAssistSuggestion = z.infer<typeof aiAssistSuggestionSchema>;
export type AiAssistResponse = z.infer<typeof aiAssistResponseSchema>;
export type PlusSubscriptionTier = z.infer<typeof plusSubscriptionTierSchema>;
export type PlusSubscriptionStatus = z.infer<typeof plusSubscriptionStatusSchema>;
export type PlusAiAssistTaskType = z.infer<typeof plusAiAssistTaskTypeSchema>;
export type PlusAiAssistUsageStatus = z.infer<typeof plusAiAssistUsageStatusSchema>;
export type PlusGateBlocker = z.infer<typeof plusGateBlockerSchema>;
export type PlusSubscriptionConfig = z.infer<typeof plusSubscriptionConfigSchema>;
export type PlusEntitlementsDto = z.infer<typeof plusEntitlementsSchema>;
export type PlusSubscriptionStateDto = z.infer<typeof plusSubscriptionStateSchema>;
export type PlusAiAssistQuotaSummary = z.infer<typeof plusAiAssistQuotaSummarySchema>;
export type AdminPlusAiAssistUsage = z.infer<typeof adminPlusAiAssistUsageSchema>;
export type PlusSubscriptionSnapshotResponse = z.infer<typeof plusSubscriptionSnapshotResponseSchema>;
export type AdminPlusGrantAction = z.infer<typeof adminPlusGrantActionSchema>;
export type AdminPlusGrantRequest = z.infer<typeof adminPlusGrantRequestSchema>;
export type AdminPlusUser = z.infer<typeof adminPlusUserSchema>;
export type AdminPlusUsersResponse = z.infer<typeof adminPlusUsersResponseSchema>;
export type AdminPlusGrantResponse = z.infer<typeof adminPlusGrantResponseSchema>;
export type AdminPlusAiAssistUsageResponse = z.infer<typeof adminPlusAiAssistUsageResponseSchema>;
