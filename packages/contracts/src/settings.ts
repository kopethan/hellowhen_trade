import { z } from 'zod';

export const languagePreferenceSchema = z.enum(['system', 'en', 'fr']);
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>;

export const updateSettingsRequestSchema = z.object({
  appearance: z.enum(['system', 'light', 'dark']).optional(),
  language: languagePreferenceSchema.optional(),
  notificationsEnabled: z.boolean().optional()
});

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export type AppSettings = {
  appearance: 'system' | 'light' | 'dark';
  language: LanguagePreference;
  notificationsEnabled: boolean;
};
