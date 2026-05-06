import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80).optional()
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export type AuthUser = {
  id: string;
  email: string;
  profile?: {
    displayName?: string | null;
    handle?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};
