import { z } from 'zod';
import { countryCodeSchema, supportedCurrencySchema } from './profile.js';
const passwordSchema = z.string().min(8).max(128);
const ageConfirmationMessage = 'You must confirm that you are 18 or older to create a Hellowhen account.';
export const declaredAgeBucketSchema = z.literal('18_plus');
export const loginRequestSchema = z.object({
    email: z.string().email(),
    password: passwordSchema
});
export const refreshSessionRequestSchema = z.object({
    refreshToken: z.string().min(32)
});
export const logoutRequestSchema = z.object({
    refreshToken: z.string().min(32).optional()
});
export const verifyEmailRequestSchema = z.object({
    token: z.string().min(32)
});
export const twoFactorChallengeRequestSchema = z.object({
    challengeToken: z.string().min(32),
    code: z.string().min(6).max(32)
});
export const twoFactorCodeRequestSchema = z.object({
    code: z.string().min(6).max(32)
});
export const disableTwoFactorRequestSchema = z.object({
    password: passwordSchema.optional(),
    code: z.string().min(6).max(32).optional()
});
export const reauthenticateRequestSchema = z.object({
    password: passwordSchema.optional(),
    code: z.string().min(6).max(32).optional()
}).refine((value) => Boolean(value.password || value.code), { message: 'Password or authenticator code is required.' });
export const registerRequestSchema = z.object({
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: passwordSchema.optional(),
    displayName: z.string().min(1).max(80).optional(),
    countryCode: countryCodeSchema.optional(),
    preferredCurrency: supportedCurrencySchema.optional(),
    acceptedTerms: z.boolean().refine((value) => value === true, { message: 'Please accept the Terms and Privacy Policy to continue.' }),
    ageConfirmed: z.boolean().refine((value) => value === true, { message: ageConfirmationMessage }),
    declaredAgeBucket: declaredAgeBucketSchema
}).superRefine((value, ctx) => {
    if (value.confirmPassword && value.password !== value.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
});
export const googleAuthRequestSchema = z.object({
    idToken: z.string().min(20),
    acceptedTerms: z.boolean().optional(),
    ageConfirmed: z.boolean().optional(),
    declaredAgeBucket: declaredAgeBucketSchema.optional(),
});
export const forgotPasswordRequestSchema = z.object({
    email: z.string().email()
});
export const resetPasswordRequestSchema = z.object({
    token: z.string().min(32),
    password: passwordSchema,
    confirmPassword: passwordSchema.optional()
}).superRefine((value, ctx) => {
    if (value.confirmPassword && value.password !== value.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
});
//# sourceMappingURL=auth.js.map