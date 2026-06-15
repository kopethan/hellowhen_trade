import { env } from '../../config/env.js';

export const publicProfilePreviewSelect = {
  displayName: true,
  handle: true,
  avatarUrl: true,
  countryCode: true,
} as const;

export const publicProfileSelect = {
  displayName: true,
  handle: true,
  bio: true,
  avatarUrl: true,
  countryCode: true,
} as const;

export const publicUserPreviewSelect = {
  id: true,
  profile: { select: publicProfilePreviewSelect },
} as const;

export const publicUserProfileSelect = {
  id: true,
  createdAt: true,
  emailVerifiedAt: true,
  trustTier: true,
  professionalStatus: true,
  profile: { select: publicProfileSelect },
} as const;

function stripAvatarUrls(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(stripAvatarUrls);
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = key === 'avatarUrl' ? null : stripAvatarUrls(child);
  }
  return output;
}

export function stripAnonymousPublicProfileMedia<T>(payload: T, viewerId?: string | null): T {
  if (viewerId || !env.publicMediaRequiresAuth) return payload;
  return stripAvatarUrls(payload) as T;
}
