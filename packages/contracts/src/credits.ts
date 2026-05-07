import { z } from 'zod';

export const creditPurchaseStatusSchema = z.enum(['pending', 'paid', 'failed', 'expired']);
export const creditPackageSchema = z.object({
  id: z.string(),
  label: z.string(),
  creditAmount: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  currency: z.string().min(3).max(3),
  description: z.string().optional(),
});
export const createCheckoutSessionRequestSchema = z.object({
  packageId: z.string().min(1),
});
export const creditPurchaseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  stripeCheckoutSessionId: z.string().nullable().optional(),
  stripePaymentIntentId: z.string().nullable().optional(),
  creditAmount: z.number().int(),
  amountCents: z.number().int(),
  currency: z.string(),
  status: creditPurchaseStatusSchema,
  checkoutUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paidAt: z.string().nullable().optional(),
});

export type CreditPurchaseStatus = z.infer<typeof creditPurchaseStatusSchema>;
export type CreditPackageDto = z.infer<typeof creditPackageSchema>;
export type CreateCheckoutSessionRequest = z.infer<typeof createCheckoutSessionRequestSchema>;
export type CreditPurchaseDto = z.infer<typeof creditPurchaseSchema>;
