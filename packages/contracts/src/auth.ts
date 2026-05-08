import { z } from 'zod';
import { countryCodeSchema, supportedCurrencySchema } from './profile';

const passwordSchema = z.string().min(8).max(128);

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: passwordSchema
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  confirmPassword: passwordSchema.optional(),
  displayName: z.string().min(1).max(80).optional(),
  countryCode: countryCodeSchema.optional(),
  preferredCurrency: supportedCurrencySchema.optional(),
  acceptedTerms: z.boolean().optional()
}).superRefine((value, ctx) => {
  if (value.confirmPassword && value.password !== value.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
  }
  if (value.acceptedTerms === false) {
    ctx.addIssue({ code: 'custom', path: ['acceptedTerms'], message: 'Please accept the terms placeholder to continue.' });
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
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type GoogleAuthRequest = z.infer<typeof googleAuthRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export type AuthUser = {
  id: string;
  email: string;
  role?: 'user' | 'admin';
  emailVerifiedAt?: string | null;
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
  user: AuthUser;
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
