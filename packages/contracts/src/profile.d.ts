import { z } from 'zod';
export declare const supportedCurrencySchema: z.ZodEnum<{
    eur: "eur";
    usd: "usd";
    gbp: "gbp";
}>;
export declare const countryCodeSchema: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
export declare const updateProfileRequestSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    handle: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    avatarMediaId: z.ZodOptional<z.ZodString>;
    countryCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    preferredCurrency: z.ZodOptional<z.ZodEnum<{
        eur: "eur";
        usd: "usd";
        gbp: "gbp";
    }>>;
    removeAvatar: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type ProfileDto = {
    id: string;
    userId: string;
    displayName?: string | null;
    handle?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    avatarMediaId?: string | null;
    countryCode?: string | null;
    preferredCurrency?: 'eur' | 'usd' | 'gbp' | null;
    createdAt: string;
    updatedAt: string;
};
//# sourceMappingURL=profile.d.ts.map