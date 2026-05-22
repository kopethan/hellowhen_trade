import { z } from 'zod';
export const supportedCurrencySchema = z.enum(['eur', 'usd', 'gbp']);
export const countryCodeSchema = z.string().trim().regex(/^[a-zA-Z]{2}$/).transform((value) => value.toUpperCase());
export const updateProfileRequestSchema = z.object({
    displayName: z.string().min(1).max(80).optional(),
    handle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
    bio: z.string().max(280).optional(),
    avatarMediaId: z.string().min(1).optional(),
    countryCode: countryCodeSchema.optional(),
    preferredCurrency: supportedCurrencySchema.optional(),
    removeAvatar: z.boolean().optional()
});
//# sourceMappingURL=profile.js.map