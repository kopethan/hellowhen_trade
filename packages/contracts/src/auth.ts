import { z } from 'zod';
import { countryCodeSchema, supportedCurrencySchema } from './profile.js';

const passwordSchema = z.string().min(8).max(128);

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
  acceptedTerms: z.boolean().refine((value) => value === true, { message: 'Please accept the Terms and Privacy Policy to continue.' })
}).superRefine((value, ctx) => {
  if (value.confirmPassword && value.password !== value.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
  }
});

export const googleAuthRequestSchema = z.object({
  idToken: z.string().min(20)
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
