import { z } from 'zod';
const reportUserProfilePreviewSchema = z.object({
  displayName: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  preferredCurrency: z.string().nullable().optional(),
}).passthrough().nullable().optional();

export const reportUserPreviewSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
  trustTier: z.string().optional(),
  emailVerifiedAt: z.string().nullable().optional(),
  twoFactorEnabled: z.boolean().optional(),
  createdAt: z.string().optional(),
  profile: reportUserProfilePreviewSchema,
}).passthrough();

export const reportTargetTypeSchema = z.enum(['user', 'profile', 'trade', 'need', 'offer', 'proposal', 'message', 'media']);
export const reportReasonSchema = z.enum(['spam', 'scam', 'harassment', 'illegal_unsafe', 'fake_profile', 'inappropriate_image', 'other']);
export const reportStatusSchema = z.enum(['pending', 'reviewing', 'resolved', 'dismissed']);

export const createReportRequestSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().trim().min(1).max(120),
  reason: reportReasonSchema,
  details: z.string().trim().min(3).max(2000).optional(),
});

export const reportTargetSummarySchema = z.object({
  type: reportTargetTypeSchema,
  id: z.string(),
  label: z.string(),
  ownerId: z.string().nullable().optional(),
  owner: reportUserPreviewSchema.nullable().optional(),
  status: z.string().nullable().optional(),
  isPublic: z.boolean().nullable().optional(),
  url: z.string().nullable().optional(),
}).passthrough();

export const reportSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  targetType: reportTargetTypeSchema,
  targetId: z.string(),
  targetOwnerId: z.string().nullable().optional(),
  reason: reportReasonSchema,
  details: z.string().nullable().optional(),
  status: reportStatusSchema,
  reviewedById: z.string().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  escalatedSupportTicketId: z.string().nullable().optional(),
  escalatedAt: z.string().nullable().optional(),
  escalatedById: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reporter: reportUserPreviewSchema.nullable().optional(),
  reviewer: reportUserPreviewSchema.nullable().optional(),
  target: reportTargetSummarySchema.nullable().optional(),
}).passthrough();

export const createReportResponseSchema = z.object({
  report: reportSchema,
  duplicate: z.boolean().optional().default(false),
});

export const adminListReportsQuerySchema = z.object({
  status: z.enum(['all', 'pending', 'reviewing', 'resolved', 'dismissed']).optional().default('pending'),
  targetType: reportTargetTypeSchema.optional(),
  reason: reportReasonSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(250).optional().default(100),
});

export const adminReportActionRequestSchema = z.object({
  action: z.enum(['mark_reviewing', 'resolve', 'dismiss', 'hide_target', 'suspend_target_owner', 'escalate_to_support']),
  note: z.string().trim().min(3).max(1200).optional(),
});

export const adminReportsResponseSchema = z.object({ reports: z.array(reportSchema) });
export const adminReportActionResponseSchema = z.object({ report: reportSchema });

export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
export type CreateReportResponse = z.infer<typeof createReportResponseSchema>;
export type ReportDto = z.infer<typeof reportSchema>;
export type AdminReportsResponse = z.infer<typeof adminReportsResponseSchema>;
export type AdminReportActionRequest = z.infer<typeof adminReportActionRequestSchema>;
export type AdminReportActionResponse = z.infer<typeof adminReportActionResponseSchema>;
