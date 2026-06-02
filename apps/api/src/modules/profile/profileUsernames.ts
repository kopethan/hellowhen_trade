import { normalizeUsername, previousUsernameHoldExpiresAt, suggestUsernameCandidates, usernameChangeAvailableAt, usernameFromEmail, validateUsername } from '@hellowhen/shared';
import { prisma } from '../../lib/prisma.js';

export function usernameValidationMessage(reason: string) {
  if (reason === 'reserved') return 'This username is reserved. Choose another public profile name.';
  if (reason === 'too_short') return 'Usernames must be at least 3 characters.';
  if (reason === 'too_long') return 'Usernames must be 32 characters or fewer.';
  return 'Usernames can use letters, numbers, dots, underscores, or hyphens, and must start and end with a letter or number.';
}

export function normalizeProfileHandle(value?: string | null) {
  if (!value) return null;
  const result = validateUsername(value);
  if (!result.ok) {
    const error = new Error(usernameValidationMessage(result.reason));
    Object.assign(error, { statusCode: 400, code: `invalid_username_${result.reason}` });
    throw error;
  }
  return result.username;
}

type UsernameAvailabilityOptions = {
  ownerProfileId?: string | null;
  ignoreHistoryHold?: boolean;
  now?: Date;
};

export async function ensureUsernameAvailable(username: string, ownerProfileIdOrOptions?: string | null | UsernameAvailabilityOptions) {
  const options: UsernameAvailabilityOptions = typeof ownerProfileIdOrOptions === 'object' && ownerProfileIdOrOptions !== null
    ? ownerProfileIdOrOptions
    : { ownerProfileId: ownerProfileIdOrOptions ?? null };
  const ownerProfileId = options.ownerProfileId ?? null;
  const existing = await prisma.profile.findUnique({ where: { handle: username }, select: { id: true } });
  if (existing && existing.id !== ownerProfileId) {
    const error = new Error('This username is already taken. Choose another one.');
    Object.assign(error, { statusCode: 409, code: 'username_taken' });
    throw error;
  }

  if (!options.ignoreHistoryHold) {
    const held = await prisma.usernameHistory.findFirst({
      where: {
        oldHandle: username,
        releasedAt: { gt: options.now ?? new Date() },
        ...(ownerProfileId ? { profileId: { not: ownerProfileId } } : {}),
      },
      select: { id: true, releasedAt: true },
      orderBy: { releasedAt: 'desc' },
    });
    if (held) {
      const error = new Error('This username was changed recently and is temporarily reserved to prevent impersonation. Choose another one.');
      Object.assign(error, { statusCode: 409, code: 'username_temporarily_reserved', releasedAt: held.releasedAt });
      throw error;
    }
  }
}

export function assertUsernameChangeAllowed(profile: { handleChangedAt?: Date | string | null } | null | undefined, now = new Date()) {
  const availableAt = usernameChangeAvailableAt(profile?.handleChangedAt ?? null);
  if (availableAt && availableAt.getTime() > now.getTime()) {
    const error = new Error(`You can change your username again after ${availableAt.toISOString().slice(0, 10)}.`);
    Object.assign(error, { statusCode: 429, code: 'username_change_cooldown', availableAt });
    throw error;
  }
}

export function buildUsernameHistoryData(input: {
  profileId: string;
  userId: string;
  oldHandle?: string | null;
  newHandle: string;
  changedById?: string | null;
  changedByRole: 'user' | 'admin';
  reason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    profileId: input.profileId,
    userId: input.userId,
    oldHandle: input.oldHandle ?? null,
    newHandle: input.newHandle,
    changedById: input.changedById ?? null,
    changedByRole: input.changedByRole,
    reason: input.reason ?? null,
    releasedAt: input.oldHandle ? previousUsernameHoldExpiresAt(now) : null,
  };
}

export async function generateUniqueUsername(seed?: string | null, fallbackEmail?: string | null) {
  const fallback = fallbackEmail ? usernameFromEmail(fallbackEmail) : 'member';
  const candidates = suggestUsernameCandidates(seed || fallback, fallback);
  const base = candidates[0] || 'member';
  for (const candidate of candidates) {
    try {
      await ensureUsernameAvailable(candidate, { ignoreHistoryHold: false });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  for (let index = 1; index <= 100; index += 1) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const trimmedBase = normalizeUsername(base).slice(0, Math.max(3, 32 - suffix.length - 1));
    const candidate = `${trimmedBase}-${suffix}`;
    if (!validateUsername(candidate).ok) continue;
    try {
      await ensureUsernameAvailable(candidate, { ignoreHistoryHold: false });
      return candidate;
    } catch {
      // Try another random suffix.
    }
  }

  return `member-${Date.now().toString(36).slice(-8)}`;
}

export function usernameErrorPayload(error: unknown) {
  if (error instanceof Error && 'statusCode' in error) {
    const payload = error as Error & { statusCode: number; code: string; availableAt?: Date; releasedAt?: Date };
    return {
      status: payload.statusCode,
      body: {
        error: payload.code,
        message: payload.message,
        ...(payload.availableAt ? { availableAt: payload.availableAt.toISOString() } : {}),
        ...(payload.releasedAt ? { releasedAt: payload.releasedAt.toISOString() } : {}),
      }
    };
  }
  return null;
}
