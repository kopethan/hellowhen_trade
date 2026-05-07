import { z } from 'zod';

export const mediaEntityTypeSchema = z.enum(['need', 'offer', 'trade']);
export const mediaAssetStatusSchema = z.enum(['active', 'flagged', 'removed', 'pending_review']);

export const mediaAssetSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  entityType: mediaEntityTypeSchema.nullable().optional(),
  entityId: z.string().nullable().optional(),
  url: z.string(),
  storageKey: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  status: mediaAssetStatusSchema,
  reviewNote: z.string().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  owner: z.unknown().optional(),
  reviewer: z.unknown().optional(),
});

export const updateMediaStatusRequestSchema = z.object({
  status: mediaAssetStatusSchema,
  reviewNote: z.string().max(500).optional(),
});

export type MediaEntityType = z.infer<typeof mediaEntityTypeSchema>;
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>;
export type MediaAssetDto = z.infer<typeof mediaAssetSchema>;
export type UpdateMediaStatusRequest = z.infer<typeof updateMediaStatusRequestSchema>;
