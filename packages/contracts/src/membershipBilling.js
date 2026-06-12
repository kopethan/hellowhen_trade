import { z } from 'zod';
export const membershipCheckoutProductHandleSchema = z.enum([
    'hellowhen_plus_monthly',
    'hellowhen_plus_yearly',
    'hellowhen_pro_monthly',
    'hellowhen_pro_yearly',
]);
export const membershipCheckoutTierSchema = z.enum(['plus', 'pro']);
export const membershipCheckoutIntervalSchema = z.enum(['monthly', 'yearly']);
export const membershipCheckoutProviderSchema = z.enum(['stripe']);
export const createMembershipCheckoutSessionRequestSchema = z.object({
    productHandle: membershipCheckoutProductHandleSchema,
}).strict();
export const membershipCheckoutSessionResponseSchema = z.object({
    provider: membershipCheckoutProviderSchema,
    mode: z.literal('subscription'),
    testMode: z.boolean(),
    sessionId: z.string(),
    checkoutUrl: z.string().url(),
    productHandle: membershipCheckoutProductHandleSchema,
    tier: membershipCheckoutTierSchema,
    interval: membershipCheckoutIntervalSchema,
});
export const membershipCustomerPortalSessionResponseSchema = z.object({
    provider: z.literal('stripe'),
    mode: z.literal('customer_portal'),
    testMode: z.boolean(),
    sessionId: z.string(),
    portalUrl: z.string().url(),
});
export const appleStoreKitPurchaseSourceSchema = z.enum(['purchase', 'restore']);
export const appleStoreKitEnvironmentSchema = z.enum(['Sandbox', 'Production', 'Xcode', 'LocalTesting', 'Unknown']);
export const syncAppleStoreKitPurchaseRequestSchema = z.object({
    source: appleStoreKitPurchaseSourceSchema.default('purchase'),
    productId: z.string().min(1).max(160),
    transactionId: z.string().min(1).max(160),
    originalTransactionId: z.string().min(1).max(160).optional().nullable(),
    purchaseToken: z.string().min(1).max(12000).optional().nullable(),
    environment: appleStoreKitEnvironmentSchema.optional().nullable(),
    appAccountToken: z.string().min(1).max(160).optional().nullable(),
    transactionDate: z.number().int().positive().optional().nullable(),
    expirationDate: z.number().int().positive().optional().nullable(),
}).strict();
export const appleStoreKitSyncStatusSchema = z.enum([
    'accepted',
    'pending_validation',
    'invalid',
    'expired',
    'revoked',
    'not_configured',
]);
export const appleStoreKitSyncResponseSchema = z.object({
    provider: z.literal('apple_app_store'),
    mode: z.literal('storekit_sync'),
    testMode: z.boolean(),
    accepted: z.boolean(),
    grantApplied: z.boolean(),
    status: appleStoreKitSyncStatusSchema,
    message: z.string(),
    productId: z.string().optional(),
    productHandle: membershipCheckoutProductHandleSchema.optional(),
    tier: membershipCheckoutTierSchema.optional(),
    subscriptionStatus: z.enum(['trialing', 'active', 'past_due', 'canceled', 'expired', 'none']).optional(),
    originalTransactionId: z.string().optional(),
    currentPeriodEndsAt: z.string().datetime().optional().nullable(),
});
//# sourceMappingURL=membershipBilling.js.map