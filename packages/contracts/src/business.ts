import { z } from 'zod';

export const businessProfileTypeSchema = z.enum(['business', 'agency', 'brand', 'enterprise']);
export const businessProfileStatusSchema = z.enum(['draft', 'active', 'pending_review', 'verified', 'restricted', 'disabled', 'rejected']);
export const businessProfileMemberRoleSchema = z.enum(['owner', 'admin', 'finance', 'member']);

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const createBusinessProfileRequestSchema = z.object({
  type: businessProfileTypeSchema.optional().default('business'),
  displayName: z.string().trim().min(2).max(100),
  legalName: optionalText(160),
  handle: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).optional().nullable(),
  description: optionalText(1000),
  websiteUrl: z.string().trim().url().optional().nullable(),
  countryCode: z.string().trim().length(2).optional().nullable(),
  preferredCurrency: z.string().trim().length(3).optional().default('eur'),
});

export const updateBusinessProfileRequestSchema = createBusinessProfileRequestSchema.partial().extend({
  displayName: z.string().trim().min(2).max(100).optional(),
});

export const requestBusinessReviewRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const businessProviderOnboardingLinkRequestSchema = z.object({
  accountType: z.enum(['business', 'brand']).optional(),
  refreshUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

export const adminBusinessProfileActionRequestSchema = z.object({
  action: z.enum(['verify', 'restrict', 'disable', 'reject', 'activate']),
  note: z.string().trim().max(1000).optional(),
});

export type BusinessProfileType = z.infer<typeof businessProfileTypeSchema>;
export type BusinessProfileStatus = z.infer<typeof businessProfileStatusSchema>;
export type BusinessProfileMemberRole = z.infer<typeof businessProfileMemberRoleSchema>;
export type CreateBusinessProfileRequest = z.infer<typeof createBusinessProfileRequestSchema>;
export type UpdateBusinessProfileRequest = z.infer<typeof updateBusinessProfileRequestSchema>;
export type RequestBusinessReviewRequest = z.infer<typeof requestBusinessReviewRequestSchema>;
export type BusinessProviderOnboardingLinkRequest = z.infer<typeof businessProviderOnboardingLinkRequestSchema>;
export type AdminBusinessProfileActionRequest = z.infer<typeof adminBusinessProfileActionRequestSchema>;
