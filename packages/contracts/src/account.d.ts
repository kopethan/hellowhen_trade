import { z } from 'zod';
export declare const accountDeletionRequestStatusSchema: z.ZodEnum<{
    completed: "completed";
    cancelled: "cancelled";
    requested: "requested";
    rejected: "rejected";
    in_review: "in_review";
}>;
export declare const createAccountDeletionRequestSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const accountDeletionRequestSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        cancelled: "cancelled";
        requested: "requested";
        rejected: "rejected";
        in_review: "in_review";
    }>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    details: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    supportTicketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    requestedAt: z.ZodString;
    reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cancelledAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$loose>;
export declare const accountDeletionRequestResponseSchema: z.ZodObject<{
    request: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            cancelled: "cancelled";
            requested: "requested";
            rejected: "rejected";
            in_review: "in_review";
        }>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        details: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        supportTicketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        requestedAt: z.ZodString;
        reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        cancelledAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$loose>>;
    duplicate: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AccountDeletionRequestStatus = z.infer<typeof accountDeletionRequestStatusSchema>;
export type CreateAccountDeletionRequest = z.infer<typeof createAccountDeletionRequestSchema>;
export type AccountDeletionRequestDto = z.infer<typeof accountDeletionRequestSchema>;
export type AccountDeletionRequestResponse = z.infer<typeof accountDeletionRequestResponseSchema>;
//# sourceMappingURL=account.d.ts.map