import { z } from 'zod';
export const languagePreferenceSchema = z.enum(['system', 'en', 'fr']);
export const updateSettingsRequestSchema = z.object({
    appearance: z.enum(['system', 'light', 'dark']).optional(),
    language: languagePreferenceSchema.optional(),
    notificationsEnabled: z.boolean().optional()
});
//# sourceMappingURL=settings.js.map