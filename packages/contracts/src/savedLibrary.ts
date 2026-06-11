import { z } from 'zod';
import { needSchema, offerSchema, tradeSchema, userPreviewSchema } from './trade.js';

export const SAVED_COLLECTION_TITLE_MAX_LENGTH = 80;
export const SAVED_COLLECTION_DESCRIPTION_MAX_LENGTH = 240;
export const SAVED_LIBRARY_FREE_ITEM_LIMIT = 0;
export const SAVED_LIBRARY_FREE_COLLECTION_LIMIT = 0;

export const savedItemTypeSchema = z.enum(['trade', 'need', 'offer', 'user']);
export const savedLibrarySortSchema = z.enum(['newest', 'oldest']);

export const createSavedItemRequestSchema = z.object({
  itemType: savedItemTypeSchema,
  itemId: z.string().min(1),
  collectionId: z.string().min(1).optional(),
});

export const savedItemStatusQuerySchema = z.object({
  itemType: savedItemTypeSchema,
  itemId: z.string().min(1),
});

export const listSavedItemsQuerySchema = z.object({
  itemType: savedItemTypeSchema.optional(),
  collectionId: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().min(1).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  sort: savedLibrarySortSchema.optional().default('newest'),
});

export const createSavedCollectionRequestSchema = z.object({
  title: z.string().trim().min(1).max(SAVED_COLLECTION_TITLE_MAX_LENGTH),
  description: z.string().trim().max(SAVED_COLLECTION_DESCRIPTION_MAX_LENGTH).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export const updateSavedCollectionRequestSchema = z.object({
  title: z.string().trim().min(1).max(SAVED_COLLECTION_TITLE_MAX_LENGTH).optional(),
  description: z.string().trim().max(SAVED_COLLECTION_DESCRIPTION_MAX_LENGTH).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one collection field to update.' });

export const addSavedCollectionItemRequestSchema = z.object({
  savedItemId: z.string().min(1),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export const savedCollectionSummarySchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const savedItemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  itemType: savedItemTypeSchema,
  tradeId: z.string().nullable().optional(),
  needId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  targetUserId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  trade: tradeSchema.nullable().optional(),
  need: needSchema.nullable().optional(),
  offer: offerSchema.nullable().optional(),
  targetUser: userPreviewSchema.nullable().optional(),
  collections: z.array(savedCollectionSummarySchema).optional(),
});

export const savedCollectionItemSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  savedItemId: z.string(),
  ownerId: z.string(),
  sortOrder: z.number().int().optional().default(0),
  createdAt: z.string(),
  savedItem: savedItemSchema.optional(),
});

export const savedCollectionSchema = savedCollectionSummarySchema.extend({
  items: z.array(savedCollectionItemSchema).optional(),
});

export const savedItemsResponseSchema = z.object({
  items: z.array(savedItemSchema),
  nextCursor: z.string().nullable().optional(),
});

export const savedItemResponseSchema = z.object({ item: savedItemSchema });

export const savedItemStatusResponseSchema = z.object({
  itemType: savedItemTypeSchema,
  itemId: z.string(),
  isSaved: z.boolean(),
  savedItem: savedItemSchema.nullable().optional(),
});

export const savedCollectionsResponseSchema = z.object({ collections: z.array(savedCollectionSchema) });
export const savedCollectionResponseSchema = z.object({ collection: savedCollectionSchema });
export const savedCollectionItemResponseSchema = z.object({ item: savedCollectionItemSchema });

export type SavedItemType = z.infer<typeof savedItemTypeSchema>;
export type SavedLibrarySort = z.infer<typeof savedLibrarySortSchema>;
export type CreateSavedItemRequest = z.infer<typeof createSavedItemRequestSchema>;
export type SavedItemStatusQuery = z.infer<typeof savedItemStatusQuerySchema>;
export type ListSavedItemsQuery = z.infer<typeof listSavedItemsQuerySchema>;
export type CreateSavedCollectionRequest = z.infer<typeof createSavedCollectionRequestSchema>;
export type UpdateSavedCollectionRequest = z.infer<typeof updateSavedCollectionRequestSchema>;
export type AddSavedCollectionItemRequest = z.infer<typeof addSavedCollectionItemRequestSchema>;
export type SavedCollectionSummaryDto = z.infer<typeof savedCollectionSummarySchema>;
export type SavedItemDto = z.infer<typeof savedItemSchema>;
export type SavedCollectionItemDto = z.infer<typeof savedCollectionItemSchema>;
export type SavedCollectionDto = z.infer<typeof savedCollectionSchema>;
export type SavedItemsResponse = z.infer<typeof savedItemsResponseSchema>;
export type SavedItemResponse = z.infer<typeof savedItemResponseSchema>;
export type SavedItemStatusResponse = z.infer<typeof savedItemStatusResponseSchema>;
export type SavedCollectionsResponse = z.infer<typeof savedCollectionsResponseSchema>;
export type SavedCollectionResponse = z.infer<typeof savedCollectionResponseSchema>;
export type SavedCollectionItemResponse = z.infer<typeof savedCollectionItemResponseSchema>;
