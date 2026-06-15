import { z } from 'zod';

export const MODERATION_MAX_REASON_LENGTH = 1200;
export const MODERATION_MAX_TEXT_LENGTH = 8000;
export const MODERATION_MAX_IMAGE_URL_LENGTH = 2000;

export const moderationContentTypeSchema = z.enum([
  'user',
  'profile',
  'trade',
  'need',
  'offer',
  'proposal',
  'message',
  'public_message',
  'media',
  'plan',
  'plan_place',
  'profile_image',
  'trade_image',
  'need_image',
  'offer_image',
  'support_ticket',
  'support_message',
]);

export const moderationContentVisibilitySchema = z.enum(['public', 'private', 'reported_private', 'admin_internal']);
export const moderationCaseSourceSchema = z.enum(['upload', 'report', 'automatic', 'admin', 'backfill']);
export const moderationCaseStatusSchema = z.enum(['pending', 'approved', 'rejected', 'needs_review', 'limited', 'removed', 'skipped', 'failed']);
export const moderationProviderSchema = z.enum(['none', 'mock', 'openai', 'aws_rekognition', 'google_vision', 'azure_content_safety', 'human_review']);
export const moderationScanTypeSchema = z.enum(['text', 'image', 'combined']);
export const moderationLabelCategorySchema = z.enum([
  'safe',
  'adult',
  'sexual',
  'violence',
  'hate_or_harassment',
  'self_harm',
  'illegal_or_regulated',
  'spam_or_scam',
  'personal_data',
  'unknown',
]);
export const moderationSeveritySchema = z.enum(['none', 'low', 'medium', 'high', 'critical']);
export const moderationSuggestedActionSchema = z.enum(['allow', 'review', 'limit', 'reject', 'remove', 'no_action']);
export const moderationTextReviewSurfaceSchema = z.enum(['trade', 'need', 'offer', 'profile', 'public_message', 'private_message']);
export const moderationTextReviewModeSchema = z.enum(['create', 'edit', 'report', 'manual']);
export const moderationTextReviewDecisionStatusSchema = z.enum(['approved', 'needs_review', 'rejected', 'skipped', 'provider_failed']);
export const moderationTextReviewContentActionSchema = z.enum(['allow', 'hold_pending', 'reject', 'none']);
export const moderationTextFailModeSchema = z.enum(['allow_with_case', 'hold_pending', 'reject']);
export const moderationActionTypeSchema = z.enum([
  'case_created',
  'provider_scan_skipped',
  'provider_scan_failed',
  'provider_result_stored',
  'mark_needs_review',
  'approve',
  'reject',
  'limit',
  'remove',
  'restore',
  'resolve',
  'admin_note',
]);

export const moderationTextInputSchema = z.object({
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(MODERATION_MAX_TEXT_LENGTH).optional(),
  message: z.string().trim().max(MODERATION_MAX_TEXT_LENGTH).optional(),
  locale: z.enum(['en', 'fr', 'es']).optional(),
}).strict();

export const moderationImageInputSchema = z.object({
  temporaryUrl: z.string().trim().max(MODERATION_MAX_IMAGE_URL_LENGTH).optional(),
  mediaId: z.string().trim().min(1).max(160).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
}).strict();

export const moderationContextSchema = z.object({
  country: z.string().trim().length(2).optional(),
  appArea: z.string().trim().min(1).max(80).optional(),
  relatedTradeId: z.string().trim().min(1).max(160).optional(),
  relatedReportId: z.string().trim().min(1).max(160).optional(),
}).strict();

export const moderationProviderPayloadSchema = z.object({
  contentId: z.string().trim().min(1).max(160),
  contentType: moderationContentTypeSchema,
  visibility: moderationContentVisibilitySchema,
  scanType: moderationScanTypeSchema,
  text: moderationTextInputSchema.optional(),
  image: moderationImageInputSchema.optional(),
  context: moderationContextSchema.optional(),
}).strict().refine((value) => value.scanType !== 'text' || Boolean(value.text), { message: 'Text moderation payloads require text.' })
  .refine((value) => value.scanType !== 'image' || Boolean(value.image), { message: 'Image moderation payloads require image.' })
  .refine((value) => value.scanType !== 'combined' || Boolean(value.text || value.image), { message: 'Combined moderation payloads require text or image.' });

export const moderationProviderLabelSchema = z.object({
  category: moderationLabelCategorySchema,
  severity: moderationSeveritySchema,
  confidence: z.number().min(0).max(1).optional(),
  sourceLabel: z.string().trim().max(160).optional(),
}).strict();

export const moderationProviderResultSchema = z.object({
  provider: moderationProviderSchema,
  scanType: moderationScanTypeSchema,
  status: z.enum(['skipped', 'completed', 'failed']),
  labels: z.array(moderationProviderLabelSchema).default([]),
  highestSeverity: moderationSeveritySchema.default('none'),
  suggestedAction: moderationSuggestedActionSchema.default('no_action'),
  reason: z.string().trim().max(MODERATION_MAX_REASON_LENGTH).optional(),
  raw: z.unknown().optional(),
  errorCode: z.string().trim().max(120).optional(),
  errorMessage: z.string().trim().max(500).optional(),
  providerRequestId: z.string().trim().max(180).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  attemptCount: z.number().int().min(1).max(10).optional(),
  retriable: z.boolean().optional(),
}).strict();

export const moderationFeatureFlagsSchema = z.object({
  enabled: z.boolean(),
  provider: moderationProviderSchema,
  textEnabled: z.boolean(),
  imageEnabled: z.boolean(),
  privateMessageScanEnabled: z.boolean(),
  storeRawProviderResult: z.boolean(),
  providerTimeoutMs: z.number().int().positive(),
  providerMaxRetries: z.number().int().min(0).max(3),
  textReviewOnCreateEnabled: z.boolean().optional().default(false),
  textReviewOnEditEnabled: z.boolean().optional().default(false),
  textReviewPublicMessagesEnabled: z.boolean().optional().default(false),
  textReviewProfileEnabled: z.boolean().optional().default(false),
  textReviewPrivateMessagesEnabled: z.boolean().optional().default(false),
  textReviewEnforcementEnabled: z.boolean().optional().default(false),
  textFailMode: moderationTextFailModeSchema.optional().default('allow_with_case'),
}).strict();

export const moderationTextReviewDecisionSchema = z.object({
  status: moderationTextReviewDecisionStatusSchema,
  contentAction: moderationTextReviewContentActionSchema,
  caseStatus: moderationCaseStatusSchema,
  highestSeverity: moderationSeveritySchema,
  suggestedAction: moderationSuggestedActionSchema,
  reason: z.string().trim().max(MODERATION_MAX_REASON_LENGTH).optional(),
}).strict();

export const moderationTextReviewResultSchema = z.object({
  enabled: z.boolean(),
  caseId: z.string().nullable().optional(),
  decision: moderationTextReviewDecisionSchema,
  providerResult: moderationProviderResultSchema.nullable().optional(),
}).strict();

export const moderationCaseSchema = z.object({
  id: z.string(),
  contentType: moderationContentTypeSchema,
  contentId: z.string(),
  contentOwnerId: z.string().nullable().optional(),
  status: moderationCaseStatusSchema,
  source: moderationCaseSourceSchema,
  priority: z.number().int(),
  visibility: moderationContentVisibilitySchema,
  reason: z.string().nullable().optional(),
  resolvedById: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();


const adminModerationUserPreviewSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
  trustTier: z.string().optional(),
  profile: z.object({
    displayName: z.string().nullable().optional(),
    handle: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
}).passthrough().nullable().optional();

export const adminModerationTargetSummarySchema = z.object({
  type: z.string(),
  id: z.string(),
  label: z.string(),
  ownerId: z.string().nullable().optional(),
  owner: adminModerationUserPreviewSchema,
  status: z.string().nullable().optional(),
  isPublic: z.boolean().nullable().optional(),
  url: z.string().nullable().optional(),
}).passthrough().nullable().optional();

export const adminModerationResultSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  provider: moderationProviderSchema,
  scanType: moderationScanTypeSchema,
  status: z.string(),
  labelsJson: z.unknown().nullable().optional(),
  scoresJson: z.unknown().nullable().optional(),
  highestSeverity: moderationSeveritySchema,
  suggestedAction: moderationSuggestedActionSchema,
  reason: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  providerRequestId: z.string().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  attemptCount: z.number().int().nullable().optional(),
  retriable: z.boolean().nullable().optional(),
  createdAt: z.string(),
}).passthrough();

export const adminModerationActionSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  action: moderationActionTypeSchema,
  actorType: z.string(),
  actorId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  previousStatus: moderationCaseStatusSchema.nullable().optional(),
  nextStatus: moderationCaseStatusSchema.nullable().optional(),
  metadata: z.unknown().optional(),
  createdAt: z.string(),
  actor: adminModerationUserPreviewSchema,
}).passthrough();

export const adminModerationReportPreviewSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  targetOwnerId: z.string().nullable().optional(),
  reason: z.string(),
  details: z.string().nullable().optional(),
  status: z.string(),
  reviewedAt: z.string().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  escalatedSupportTicketId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reporter: adminModerationUserPreviewSchema,
  reviewer: adminModerationUserPreviewSchema,
}).passthrough().nullable().optional();

export const adminModerationCaseSchema = moderationCaseSchema.extend({
  contentOwner: adminModerationUserPreviewSchema,
  resolvedBy: adminModerationUserPreviewSchema,
  report: adminModerationReportPreviewSchema,
  target: adminModerationTargetSummarySchema,
  latestResult: adminModerationResultSchema.nullable().optional(),
  recentResults: z.array(adminModerationResultSchema).default([]),
  recentActions: z.array(adminModerationActionSchema).default([]),
  resultCount: z.number().int().optional().default(0),
  actionCount: z.number().int().optional().default(0),
}).passthrough();

export const adminListModerationCasesQuerySchema = z.object({
  status: z.enum(['all', 'pending', 'approved', 'rejected', 'needs_review', 'limited', 'removed', 'skipped', 'failed']).optional().default('needs_review'),
  contentType: moderationContentTypeSchema.optional(),
  source: moderationCaseSourceSchema.optional(),
  q: z.string().trim().min(1).max(160).optional(),
  take: z.coerce.number().int().min(1).max(250).optional().default(100),
});

export const adminModerationCaseActionRequestSchema = z.object({
  action: z.enum(['mark_needs_review', 'approve', 'reject', 'limit', 'remove', 'restore', 'resolve', 'add_note']),
  note: z.string().trim().min(3).max(MODERATION_MAX_REASON_LENGTH).optional(),
});

export const adminModerationCasesResponseSchema = z.object({
  cases: z.array(adminModerationCaseSchema),
});

export const adminModerationCaseActionResponseSchema = z.object({
  case: adminModerationCaseSchema,
  targetActionApplied: z.boolean().optional().default(false),
});
