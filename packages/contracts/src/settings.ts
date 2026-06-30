import { z } from 'zod';

export const languagePreferenceSchema = z.enum(['system', 'en', 'fr', 'es']);
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>;

export const contentLanguageCodeSchema = z.enum(['en', 'fr', 'es']);
export type ContentLanguageCode = z.infer<typeof contentLanguageCodeSchema>;

export const contentLanguageOrderSchema = z.array(contentLanguageCodeSchema)
  .max(8)
  .transform((languages) => Array.from(new Set(languages)));

export const updateSettingsRequestSchema = z.object({
  appearance: z.enum(['system', 'light', 'dark']).optional(),
  language: languagePreferenceSchema.optional(),
  contentLanguageOrder: contentLanguageOrderSchema.optional(),
  notificationsEnabled: z.boolean().optional()
});

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export type AppSettings = {
  appearance: 'system' | 'light' | 'dark';
  language: LanguagePreference;
  contentLanguageOrder: ContentLanguageCode[];
  notificationsEnabled: boolean;
};
