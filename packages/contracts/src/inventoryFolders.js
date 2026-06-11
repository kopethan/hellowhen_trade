import { z } from 'zod';
import { needSchema, offerSchema } from './trade.js';

export const INVENTORY_FOLDER_TITLE_MAX_LENGTH = 80;
export const INVENTORY_FOLDER_DESCRIPTION_MAX_LENGTH = 240;

export const inventoryFolderItemTypeSchema = z.enum(['need', 'offer']);

export const createInventoryFolderRequestSchema = z.object({
  title: z.string().trim().min(1).max(INVENTORY_FOLDER_TITLE_MAX_LENGTH),
  description: z.string().trim().max(INVENTORY_FOLDER_DESCRIPTION_MAX_LENGTH).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export const updateInventoryFolderRequestSchema = z.object({
  title: z.string().trim().min(1).max(INVENTORY_FOLDER_TITLE_MAX_LENGTH).optional(),
  description: z.string().trim().max(INVENTORY_FOLDER_DESCRIPTION_MAX_LENGTH).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one folder field to update.' });

export const addInventoryFolderItemRequestSchema = z.object({
  itemType: inventoryFolderItemTypeSchema,
  itemId: z.string().min(1),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export const listInventoryFoldersQuerySchema = z.object({
  itemType: inventoryFolderItemTypeSchema.optional(),
  includeItems: z.coerce.boolean().optional().default(true),
});

export const inventoryFolderItemSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  ownerId: z.string(),
  itemType: inventoryFolderItemTypeSchema,
  needId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  createdAt: z.string(),
  need: needSchema.nullable().optional(),
  offer: offerSchema.nullable().optional(),
});

export const inventoryFolderSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(inventoryFolderItemSchema).optional(),
});

export const inventoryFoldersResponseSchema = z.object({ folders: z.array(inventoryFolderSchema) });
export const inventoryFolderResponseSchema = z.object({ folder: inventoryFolderSchema });
export const inventoryFolderItemResponseSchema = z.object({ item: inventoryFolderItemSchema });
