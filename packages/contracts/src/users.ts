import { z } from 'zod';
import { mediaAssetSchema, publicMediaAccessSchema } from './media.js';
import { tradePostTypeSchema, tradeStatusSchema, needStatusSchema, offerStatusSchema, tradeExchangeModeSchema, inventoryAvailabilityPresetSchema, inventoryDurationPresetSchema, inventoryItemTypeSchema } from './trade.js';

export const publicVerificationBadgeSchema = z.object({
  kind: z.enum(['email_verified', 'professional', 'trusted', 'business', 'verified_business', 'brand', 'agency', 'enterprise']),
  label: z.string(),
  tone: z.enum(['neutral', 'success', 'trusted', 'professional', 'business', 'enterprise']),
  title: z.string().optional(),
});

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
  badges: z.array(publicVerificationBadgeSchema).optional().default([]),
});

const publicNeedSummarySchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  itemType: inventoryItemTypeSchema.optional().default('service'),
  category: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  availabilityPreset: inventoryAvailabilityPresetSchema.nullable().optional(),
  availabilityStartAt: z.string().nullable().optional(),
  availabilityEndAt: z.string().nullable().optional(),
  estimatedDurationPreset: inventoryDurationPresetSchema.nullable().optional(),
  estimatedDurationMinutes: z.number().int().nullable().optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: needStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  media: z.array(mediaAssetSchema).optional(),
  mediaAccess: publicMediaAccessSchema.optional(),
});

const publicOfferSummarySchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  itemType: inventoryItemTypeSchema.optional().default('service'),
  category: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  availabilityPreset: inventoryAvailabilityPresetSchema.nullable().optional(),
  availabilityStartAt: z.string().nullable().optional(),
  availabilityEndAt: z.string().nullable().optional(),
  typicalDurationPreset: inventoryDurationPresetSchema.nullable().optional(),
  typicalDurationMinutes: z.number().int().nullable().optional(),
  mode: tradeExchangeModeSchema.nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  includes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: offerStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  media: z.array(mediaAssetSchema).optional(),
  mediaAccess: publicMediaAccessSchema.optional(),
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
  mediaAccess: publicMediaAccessSchema.optional(),
});

export const publicProfileStatsSchema = z.object({
  completedTradesCount: z.number().int().nonnegative(),
  activeTradesCount: z.number().int().nonnegative(),
  openNeedsCount: z.number().int().nonnegative(),
  openOffersCount: z.number().int().nonnegative(),
  verifiedOfflinePlacesCount: z.number().int().nonnegative().optional().default(0),
  verifiedOfflinePlansCount: z.number().int().nonnegative().optional().default(0),
  verifiedOfflineCheckInsCount: z.number().int().nonnegative().optional().default(0),
  lastOfflinePresenceConfirmedAt: z.string().nullable().optional().default(null),
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


export type PublicVerificationBadge = z.infer<typeof publicVerificationBadgeSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;
export type PublicProfileTradeSummary = z.infer<typeof publicProfileTradeSummarySchema>;
export type PublicProfileStats = z.infer<typeof publicProfileStatsSchema>;
export type PublicProfileSections = z.infer<typeof publicProfileSectionsSchema>;
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;

export type CreateUserBlockRequest = z.infer<typeof createUserBlockRequestSchema>;
export type UserBlockDto = z.infer<typeof userBlockSchema>;
export type UserBlockResponse = z.infer<typeof userBlockResponseSchema>;
export type UserBlocksResponse = z.infer<typeof userBlocksResponseSchema>;
