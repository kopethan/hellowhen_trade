import { z } from 'zod';

export const updateProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  handle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().optional()
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export type ProfileDto = {
  id: string;
  userId: string;
  displayName?: string | null;
  handle?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};
