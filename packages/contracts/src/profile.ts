import { z } from 'zod';

export const supportedCurrencySchema = z.enum(['eur', 'usd', 'gbp']);
export const countryCodeSchema = z.string().trim().regex(/^[a-zA-Z]{2}$/).transform((value: string) => value.toUpperCase());

const handleSchema = z.string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/)
  .transform((value) => value.toLowerCase());

export const updateProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  handle: handleSchema.optional(),
  bio: z.string().max(280).optional(),
  avatarMediaId: z.string().min(1).optional(),
  countryCode: countryCodeSchema.optional(),
  preferredCurrency: supportedCurrencySchema.optional(),
  removeAvatar: z.boolean().optional()
});

export const updateUsernameRequestSchema = z.object({
  handle: handleSchema,
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type UpdateUsernameRequest = z.infer<typeof updateUsernameRequestSchema>;

export type ProfileDto = {
  id: string;
  userId: string;
  displayName?: string | null;
  handle?: string | null;
  handleChangedAt?: string | null;
  handleChangeCount?: number | null;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarMediaId?: string | null;
  countryCode?: string | null;
  preferredCurrency?: 'eur' | 'usd' | 'gbp' | null;
  createdAt: string;
  updatedAt: string;
};
