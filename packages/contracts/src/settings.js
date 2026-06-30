import { z } from 'zod';
export const languagePreferenceSchema = z.enum(['system', 'en', 'fr', 'es']);
export const contentLanguageCodeSchema = z.enum(['en', 'fr', 'es']);
export const contentLanguageOrderSchema = z.array(contentLanguageCodeSchema)
    .max(8)
    .transform((languages) => Array.from(new Set(languages)));
export const updateSettingsRequestSchema = z.object({
    appearance: z.enum(['system', 'light', 'dark']).optional(),
    language: languagePreferenceSchema.optional(),
    contentLanguageOrder: contentLanguageOrderSchema.optional(),
    notificationsEnabled: z.boolean().optional()
});
//# sourceMappingURL=settings.js.map
