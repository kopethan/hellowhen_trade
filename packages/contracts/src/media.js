import { z } from 'zod';
export const mediaEntityTypeSchema = z.enum(['need', 'offer', 'trade', 'inventory_template', 'profile', 'support_ticket', 'support_message', 'plan', 'plan_place']);
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
export const listMyMediaQuerySchema = z.object({
    status: mediaAssetStatusSchema.optional(),
    entityType: mediaEntityTypeSchema.optional(),
    entityId: z.string().min(1).optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
});
export const adminListMediaQuerySchema = z.object({
    status: mediaAssetStatusSchema.optional(),
    entityType: mediaEntityTypeSchema.optional(),
    entityId: z.string().min(1).optional(),
    ownerId: z.string().min(1).optional(),
    take: z.coerce.number().int().min(1).max(200).optional(),
});
export const updateMediaStatusRequestSchema = z.object({
    status: mediaAssetStatusSchema,
    reviewNote: z.string().trim().max(500).optional(),
}).refine((value) => Boolean(value.reviewNote && value.reviewNote.length >= 3), {
    message: 'Add a short review note before changing an image moderation status.',
    path: ['reviewNote'],
});
//# sourceMappingURL=media.js.map