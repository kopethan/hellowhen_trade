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
  profile: { select: publicProfileSelect },
} as const;
