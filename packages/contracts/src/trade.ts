import { z } from 'zod';

export const needStatusSchema = z.enum(['draft', 'active', 'fulfilled', 'closed', 'expired']);
export const offerStatusSchema = z.enum(['draft', 'active', 'accepted', 'closed', 'expired']);
export const tradeStatusSchema = z.enum([
  'draft',
  'active',
  'funded',
  'in_progress',
  'submitted',
  'completed',
  'disputed',
  'expired',
  'closed',
  'cancelled'
]);

export const createNeedRequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  status: needStatusSchema.optional(),
  expiresAt: z.string().datetime().optional()
});

export const createOfferRequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  status: offerStatusSchema.optional(),
  expiresAt: z.string().datetime().optional()
});

export const createTradeRequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  creditAmount: z.number().int().positive().max(100000),
  needId: z.string().optional(),
  offerId: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

export const needSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  status: needStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional()
});

export const offerSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  status: offerStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional()
});

export const tradeSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  needId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  creditAmount: z.number().int(),
  status: tradeStatusSchema,
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional()
});

export type NeedDto = z.infer<typeof needSchema>;
export type OfferDto = z.infer<typeof offerSchema>;
export type TradeDto = z.infer<typeof tradeSchema>;
export type CreateNeedRequest = z.infer<typeof createNeedRequestSchema>;
export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;
export type CreateTradeRequest = z.infer<typeof createTradeRequestSchema>;
