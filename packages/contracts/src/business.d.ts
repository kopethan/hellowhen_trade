import { z } from 'zod';
export declare const businessProfileTypeSchema: z.ZodEnum<{
    business: "business";
    brand: "brand";
    agency: "agency";
    enterprise: "enterprise";
}>;
export declare const businessProfileStatusSchema: z.ZodEnum<{
    restricted: "restricted";
    active: "active";
    pending_review: "pending_review";
    draft: "draft";
    disabled: "disabled";
    rejected: "rejected";
    verified: "verified";
}>;
export declare const businessProfileMemberRoleSchema: z.ZodEnum<{
    admin: "admin";
    owner: "owner";
    finance: "finance";
    member: "member";
}>;
export declare const createBusinessProfileRequestSchema: z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        business: "business";
        brand: "brand";
        agency: "agency";
        enterprise: "enterprise";
    }>>>;
    displayName: z.ZodString;
    legalName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    handle: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    websiteUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    countryCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    preferredCurrency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const updateBusinessProfileRequestSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        business: "business";
        brand: "brand";
        agency: "agency";
        enterprise: "enterprise";
    }>>>>;
    legalName: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    handle: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    websiteUrl: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    countryCode: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    preferredCurrency: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodString>>>;
    displayName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const requestBusinessReviewRequestSchema: z.ZodObject<{
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const businessProviderOnboardingLinkRequestSchema: z.ZodObject<{
    accountType: z.ZodOptional<z.ZodEnum<{
        business: "business";
        brand: "brand";
    }>>;
    refreshUrl: z.ZodOptional<z.ZodString>;
    returnUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const adminBusinessProfileActionRequestSchema: z.ZodObject<{
    action: z.ZodEnum<{
        reject: "reject";
        verify: "verify";
        restrict: "restrict";
        disable: "disable";
        activate: "activate";
    }>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BusinessProfileType = z.infer<typeof businessProfileTypeSchema>;
export type BusinessProfileStatus = z.infer<typeof businessProfileStatusSchema>;
export type BusinessProfileMemberRole = z.infer<typeof businessProfileMemberRoleSchema>;
export type CreateBusinessProfileRequest = z.infer<typeof createBusinessProfileRequestSchema>;
export type UpdateBusinessProfileRequest = z.infer<typeof updateBusinessProfileRequestSchema>;
export type RequestBusinessReviewRequest = z.infer<typeof requestBusinessReviewRequestSchema>;
export type BusinessProviderOnboardingLinkRequest = z.infer<typeof businessProviderOnboardingLinkRequestSchema>;
export type AdminBusinessProfileActionRequest = z.infer<typeof adminBusinessProfileActionRequestSchema>;
//# sourceMappingURL=business.d.ts.map