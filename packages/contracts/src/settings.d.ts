import { z } from 'zod';
export declare const languagePreferenceSchema: z.ZodEnum<{
    system: "system";
    en: "en";
    fr: "fr";
}>;
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>;
export declare const updateSettingsRequestSchema: z.ZodObject<{
    appearance: z.ZodOptional<z.ZodEnum<{
        system: "system";
        light: "light";
        dark: "dark";
    }>>;
    language: z.ZodOptional<z.ZodEnum<{
        system: "system";
        en: "en";
        fr: "fr";
    }>>;
    notificationsEnabled: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
export type AppSettings = {
    appearance: 'system' | 'light' | 'dark';
    language: LanguagePreference;
    notificationsEnabled: boolean;
};
//# sourceMappingURL=settings.d.ts.map