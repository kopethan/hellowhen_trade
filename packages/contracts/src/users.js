import { z } from 'zod';
import { mediaAssetSchema } from './media.js';
import { tradePostTypeSchema, tradeStatusSchema, needStatusSchema, offerStatusSchema, tradeExchangeModeSchema, inventoryItemTypeSchema } from './trade.js';
export const publicProfileSchema = z.object({
    displayName: z.string().nullable().optional(),
    handle: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
});
export const publicUserProfileSchema = z.object({
    id: z.string(),
    memberSince: z.string(),
    profile: publicProfileSchema.nullable().optional(),
});
const publicNeedSummarySchema = z.object({
    id: z.string(),
    ownerId: z.string(),
    title: z.string(),
    description: z.string(),
    itemType: inventoryItemTypeSchema.optional().default('service'),
    category: z.string().nullable().optional(),
    timing: z.string().nullable().optional(),
    mode: tradeExchangeModeSchema.nullable().optional(),
    locationLabel: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    status: needStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    expiresAt: z.string().nullable().optional(),
    media: z.array(mediaAssetSchema).optional(),
});
const publicOfferSummarySchema = z.object({
    id: z.string(),
    ownerId: z.string(),
    title: z.string(),
    description: z.string(),
    itemType: inventoryItemTypeSchema.optional().default('service'),
    category: z.string().nullable().optional(),
    availability: z.string().nullable().optional(),
    mode: tradeExchangeModeSchema.nullable().optional(),
    locationLabel: z.string().nullable().optional(),
    includes: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    status: offerStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    expiresAt: z.string().nullable().optional(),
    media: z.array(mediaAssetSchema).optional(),
});
export const publicProfileTradeSummarySchema = z.object({
    id: z.string(),
    ownerId: z.string(),
    providerId: z.string().nullable().optional(),
    needId: z.string().nullable().optional(),
    offerId: z.string().nullable().optional(),
    title: z.string(),
    description: z.string(),
    amountCents: z.number().int().optional().default(0),
    currency: z.string().optional().default('eur'),
    postType: tradePostTypeSchema.optional().default('need_offer'),
    status: tradeStatusSchema,
    isPublic: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    expiresAt: z.string().nullable().optional(),
    closedAt: z.string().nullable().optional(),
    need: publicNeedSummarySchema.nullable().optional(),
    offer: publicOfferSummarySchema.nullable().optional(),
    media: z.array(mediaAssetSchema).optional(),
});
export const publicProfileStatsSchema = z.object({
    completedTradesCount: z.number().int().nonnegative(),
    activeTradesCount: z.number().int().nonnegative(),
    openNeedsCount: z.number().int().nonnegative(),
    openOffersCount: z.number().int().nonnegative(),
});
export const publicProfileSectionsSchema = z.object({
    activeTrades: z.array(publicProfileTradeSummarySchema),
    openNeeds: z.array(publicProfileTradeSummarySchema),
    openOffers: z.array(publicProfileTradeSummarySchema),
});
export const publicProfileResponseSchema = z.object({
    user: publicUserProfileSchema,
    stats: publicProfileStatsSchema,
    sections: publicProfileSectionsSchema,
    viewerState: z.object({ isBlockedByMe: z.boolean().optional(), isBlockingMe: z.boolean().optional() }).optional(),
});
export const createUserBlockRequestSchema = z.object({
    reason: z.string().trim().max(240).optional(),
});
export const userBlockSchema = z.object({
    id: z.string(),
    blockerId: z.string(),
    blockedId: z.string(),
    reason: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    blocked: publicUserProfileSchema.nullable().optional(),
}).passthrough();
export const userBlockResponseSchema = z.object({
    blocked: z.boolean(),
    block: userBlockSchema.nullable().optional(),
});
export const userBlocksResponseSchema = z.object({
    blocks: z.array(userBlockSchema),
});
//# sourceMappingURL=users.js.map