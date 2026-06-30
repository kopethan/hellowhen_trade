import { z } from 'zod';
export declare const languagePreferenceSchema: z.ZodEnum<{
    system: "system";
    en: "en";
    fr: "fr";
    es: "es";
}>;
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>;
export declare const contentLanguageCodeSchema: z.ZodEnum<{
    en: "en";
    fr: "fr";
    es: "es";
}>;
export type ContentLanguageCode = z.infer<typeof contentLanguageCodeSchema>;
export declare const contentLanguageOrderSchema: z.ZodType<ContentLanguageCode[]>;
export declare const updateSettingsRequestSchema: z.ZodType<{
    appearance?: 'system' | 'light' | 'dark';
    language?: LanguagePreference;
    contentLanguageOrder?: ContentLanguageCode[];
    notificationsEnabled?: boolean;
}>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
export type AppSettings = {
    appearance: 'system' | 'light' | 'dark';
    language: LanguagePreference;
    contentLanguageOrder: ContentLanguageCode[];
    notificationsEnabled: boolean;
};
//# sourceMappingURL=settings.d.ts.map
