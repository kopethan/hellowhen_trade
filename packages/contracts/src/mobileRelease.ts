import { z } from 'zod';

export const MOBILE_RELEASE_VERSION_MAX_LENGTH = 32;
export const MOBILE_RELEASE_NOTES_MAX_LENGTH = 4000;

export const mobilePlatformSchema = z.enum(['ios', 'android']);
export const mobileReleaseLocaleSchema = z.enum(['en', 'fr', 'es']);
export const mobileReleaseStatusSchema = z.enum(['current', 'optional', 'mandatory']);

export const mobileMarketingVersionSchema = z.string()
  .trim()
  .min(1)
  .max(MOBILE_RELEASE_VERSION_MAX_LENGTH)
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Version must use x.y.z numeric format.');

export const mobileBuildNumberSchema = z.preprocess(
  (value) => typeof value === 'string' && !value.trim() ? undefined : value,
  z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
);

export const mobileReleasePolicyQuerySchema = z.object({
  platform: mobilePlatformSchema,
  version: mobileMarketingVersionSchema,
  build: mobileBuildNumberSchema,
  locale: mobileReleaseLocaleSchema.optional().default('en'),
}).strict();

export const mobileReleaseTargetSchema = z.object({
  version: mobileMarketingVersionSchema,
  build: mobileBuildNumberSchema,
});

export const mobileReleasePolicyResponseSchema = z.object({
  enabled: z.boolean(),
  platform: mobilePlatformSchema,
  status: mobileReleaseStatusSchema,
  installed: mobileReleaseTargetSchema,
  latest: mobileReleaseTargetSchema.nullable(),
  minimumSupported: mobileReleaseTargetSchema.nullable(),
  releaseNotes: z.string().max(MOBILE_RELEASE_NOTES_MAX_LENGTH).nullable(),
});

export type MobilePlatform = z.infer<typeof mobilePlatformSchema>;
export type MobileReleaseLocale = z.infer<typeof mobileReleaseLocaleSchema>;
export type MobileReleaseStatus = z.infer<typeof mobileReleaseStatusSchema>;
export type MobileReleasePolicyQuery = z.infer<typeof mobileReleasePolicyQuerySchema>;
export type MobileReleaseTarget = z.infer<typeof mobileReleaseTargetSchema>;
export type MobileReleasePolicyResponse = z.infer<typeof mobileReleasePolicyResponseSchema>;
