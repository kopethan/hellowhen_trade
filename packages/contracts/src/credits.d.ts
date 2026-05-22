import { z } from 'zod';
export declare const creditPurchaseStatusSchema: z.ZodEnum<{
    expired: "expired";
    pending: "pending";
    paid: "paid";
    failed: "failed";
}>;
export declare const creditPackageSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    creditAmount: z.ZodNumber;
    amountCents: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createCheckoutSessionRequestSchema: z.ZodObject<{
    packageId: z.ZodString;
}, z.core.$strip>;
export declare const creditPurchaseSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    stripeCheckoutSessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stripePaymentIntentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    creditAmount: z.ZodNumber;
    amountCents: z.ZodNumber;
    currency: z.ZodString;
    status: z.ZodEnum<{
        expired: "expired";
        pending: "pending";
        paid: "paid";
        failed: "failed";
    }>;
    checkoutUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type CreditPurchaseStatus = z.infer<typeof creditPurchaseStatusSchema>;
export type CreditPackageDto = z.infer<typeof creditPackageSchema>;
export type CreateCheckoutSessionRequest = z.infer<typeof createCheckoutSessionRequestSchema>;
export type CreditPurchaseDto = z.infer<typeof creditPurchaseSchema>;
//# sourceMappingURL=credits.d.ts.map