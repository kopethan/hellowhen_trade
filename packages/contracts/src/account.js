import { z } from 'zod';
export const accountDeletionRequestStatusSchema = z.enum(['requested', 'in_review', 'completed', 'cancelled', 'rejected']);
export const createAccountDeletionRequestSchema = z.object({
    reason: z.string().trim().max(120).optional(),
    details: z.string().trim().max(2000).optional(),
});
export const accountDeletionRequestSchema = z.object({
    id: z.string(),
    userId: z.string(),
    status: accountDeletionRequestStatusSchema,
    reason: z.string().nullable().optional(),
    details: z.string().nullable().optional(),
    supportTicketId: z.string().nullable().optional(),
    requestedAt: z.string(),
    reviewedAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    cancelledAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
}).passthrough();
export const accountDeletionRequestResponseSchema = z.object({
    request: accountDeletionRequestSchema.nullable(),
    duplicate: z.boolean().optional(),
});
//# sourceMappingURL=account.js.map