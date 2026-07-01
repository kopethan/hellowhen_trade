import { z } from 'zod';
export declare const mediaEntityTypeSchema: z.ZodEnum<{
    need: "need";
    offer: "offer";
    trade: "trade";
    inventory_template: "inventory_template";
    profile: "profile";
    support_ticket: "support_ticket";
    support_message: "support_message";
    plan: "plan";
    plan_place: "plan_place";
}>;
export declare const mediaAssetStatusSchema: z.ZodEnum<{
    active: "active";
    flagged: "flagged";
    removed: "removed";
    pending_review: "pending_review";
}>;

export declare const mediaVariantKindSchema: z.ZodEnum<{
    thumb: "thumb";
    card: "card";
    full: "full";
}>;
export declare const mediaVariantSchema: z.ZodObject<{
    url: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    storageKey: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    mimeType: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    sizeBytes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const mediaVariantsSchema: z.ZodObject<{
    thumb: z.ZodOptional<typeof mediaVariantSchema>;
    card: z.ZodOptional<typeof mediaVariantSchema>;
    full: z.ZodOptional<typeof mediaVariantSchema>;
}, z.core.$strip>;
export declare const mediaAssetSchema: z.ZodObject<{
    id: z.ZodString;
    ownerId: z.ZodString;
    entityType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        need: "need";
        offer: "offer";
        trade: "trade";
        inventory_template: "inventory_template";
        profile: "profile";
        support_ticket: "support_ticket";
        support_message: "support_message";
        plan: "plan";
        plan_place: "plan_place";
    }>>>;
    entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodString;
    storageKey: z.ZodString;
    filename: z.ZodString;
    mimeType: z.ZodString;
    sizeBytes: z.ZodNumber;
    variants: z.ZodOptional<typeof mediaVariantsSchema>;
    status: z.ZodEnum<{
        active: "active";
        flagged: "flagged";
        removed: "removed";
        pending_review: "pending_review";
    }>;
    reviewNote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reviewedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reviewerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodUnknown>;
    reviewer: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const listMyMediaQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        flagged: "flagged";
        removed: "removed";
        pending_review: "pending_review";
    }>>;
    entityType: z.ZodOptional<z.ZodEnum<{
        need: "need";
        offer: "offer";
        trade: "trade";
        inventory_template: "inventory_template";
        profile: "profile";
        support_ticket: "support_ticket";
        support_message: "support_message";
        plan: "plan";
        plan_place: "plan_place";
    }>>;
    entityId: z.ZodOptional<z.ZodString>;
    take: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const adminListMediaQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        flagged: "flagged";
        removed: "removed";
        pending_review: "pending_review";
    }>>;
    entityType: z.ZodOptional<z.ZodEnum<{
        need: "need";
        offer: "offer";
        trade: "trade";
        inventory_template: "inventory_template";
        profile: "profile";
        support_ticket: "support_ticket";
        support_message: "support_message";
        plan: "plan";
        plan_place: "plan_place";
    }>>;
    entityId: z.ZodOptional<z.ZodString>;
    ownerId: z.ZodOptional<z.ZodString>;
    take: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const updateMediaStatusRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        active: "active";
        flagged: "flagged";
        removed: "removed";
        pending_review: "pending_review";
    }>;
    reviewNote: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type MediaEntityType = z.infer<typeof mediaEntityTypeSchema>;
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>;
export type MediaVariantKind = z.infer<typeof mediaVariantKindSchema>;
export type MediaVariantDto = z.infer<typeof mediaVariantSchema>;
export type MediaVariantsDto = z.infer<typeof mediaVariantsSchema>;
export type MediaAssetDto = z.infer<typeof mediaAssetSchema>;
export type ListMyMediaQuery = z.infer<typeof listMyMediaQuerySchema>;
export type AdminListMediaQuery = z.infer<typeof adminListMediaQuerySchema>;
export type UpdateMediaStatusRequest = z.infer<typeof updateMediaStatusRequestSchema>;
//# sourceMappingURL=media.d.ts.map