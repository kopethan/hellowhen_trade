import { z } from 'zod';
export declare const declaredAgeBucketSchema: z.ZodLiteral<"18_plus">;
export declare const loginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const refreshSessionRequestSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>;
export declare const logoutRequestSchema: z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const verifyEmailRequestSchema: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
export declare const twoFactorChallengeRequestSchema: z.ZodObject<{
    challengeToken: z.ZodString;
    code: z.ZodString;
}, z.core.$strip>;
export declare const twoFactorCodeRequestSchema: z.ZodObject<{
    code: z.ZodString;
}, z.core.$strip>;
export declare const disableTwoFactorRequestSchema: z.ZodObject<{
    password: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const reauthenticateRequestSchema: z.ZodObject<{
    password: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const registerRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodString>;
    countryCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    preferredCurrency: z.ZodOptional<z.ZodEnum<{
        eur: "eur";
        usd: "usd";
        gbp: "gbp";
    }>>;
    acceptedTerms: z.ZodBoolean;
    ageConfirmed: z.ZodBoolean;
    declaredAgeBucket: z.ZodLiteral<"18_plus">;
}, z.core.$strip>;
export declare const googleAuthRequestSchema: z.ZodObject<{
    idToken: z.ZodString;
    acceptedTerms: z.ZodOptional<z.ZodBoolean>;
    ageConfirmed: z.ZodOptional<z.ZodBoolean>;
    declaredAgeBucket: z.ZodOptional<z.ZodLiteral<"18_plus">>;
}, z.core.$strip>;
export declare const forgotPasswordRequestSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const resetPasswordRequestSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshSessionRequest = z.infer<typeof refreshSessionRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;
export type TwoFactorChallengeRequest = z.infer<typeof twoFactorChallengeRequestSchema>;
export type TwoFactorCodeRequest = z.infer<typeof twoFactorCodeRequestSchema>;
export type DisableTwoFactorRequest = z.infer<typeof disableTwoFactorRequestSchema>;
export type ReauthenticateRequest = z.infer<typeof reauthenticateRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type GoogleAuthRequest = z.infer<typeof googleAuthRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type AuthUser = {
    id: string;
    email: string;
    role?: 'user' | 'admin';
    trustTier?: 'new' | 'email_verified' | 'stripe_verified' | 'trusted' | 'restricted';
    emailVerifiedAt?: string | null;
    ageConfirmedAt?: string | null;
    declaredAgeBucket?: '18_plus' | null;
    twoFactorEnabled?: boolean;
    forceTwoFactor?: boolean;
    sensitiveActionVerifiedAt?: string | null;
    sessionRevokedAt?: string | null;
    lastLoginAt?: string | null;
    profile?: {
        displayName?: string | null;
        handle?: string | null;
        avatarUrl?: string | null;
        bio?: string | null;
        avatarMediaId?: string | null;
        countryCode?: string | null;
        preferredCurrency?: 'eur' | 'usd' | 'gbp' | null;
    } | null;
};
export type AuthResponse = {
    accessToken: string;
    refreshToken?: string;
    user: AuthUser;
};
export type AuthMeResponse = {
    accessToken?: string;
    refreshToken?: string;
    user: AuthUser | null;
};
export type TwoFactorRequiredResponse = {
    requiresTwoFactor: true;
    challengeToken: string;
    message: string;
};
export type LoginResponse = AuthResponse | TwoFactorRequiredResponse;
export type SessionDto = {
    id: string;
    createdAt: string;
    updatedAt?: string;
    expiresAt: string;
    revokedAt?: string | null;
    userAgent?: string | null;
};
export type EmailVerificationResponse = {
    ok: true;
    message: string;
    emailSent?: boolean;
    devVerificationUrl?: string;
};
export type TwoFactorSetupResponse = {
    secret: string;
    otpauthUrl: string;
    message: string;
};
export type TwoFactorEnableResponse = {
    ok: true;
    recoveryCodes: string[];
};
export type ReauthenticateResponse = {
    ok: true;
    sensitiveActionExpiresAt: string;
};
export type ForgotPasswordResponse = {
    ok: true;
    message: string;
    emailSent?: boolean;
    devResetUrl?: string;
};
export type ResetPasswordResponse = {
    ok: true;
    message: string;
};
//# sourceMappingURL=auth.d.ts.map