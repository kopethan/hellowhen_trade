import { normalizeBusinessSlug, validateBusinessSlug } from '@hellowhen/shared';
import { prisma } from '../../lib/prisma.js';

export function normalizeBusinessProfileHandle(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const result = validateBusinessSlug(trimmed);
  if (!result.ok) {
    throw Object.assign(new Error('Invalid business profile URL slug.'), {
      statusCode: 400,
      code: `invalid_business_slug_${result.reason}`,
      publicMessage: businessSlugValidationMessage(result.reason),
      details: { slug: result.slug, reason: result.reason },
    });
  }
  return result.slug;
}

export function businessSlugValidationMessage(reason: string) {
  if (reason === 'too_short') return 'Business profile URLs must be at least 3 characters.';
  if (reason === 'too_long') return 'Business profile URLs must be 40 characters or fewer.';
  if (reason === 'reserved') return 'This Business profile URL is reserved.';
  return 'Use only letters, numbers, dots, underscores, or hyphens.';
}

export function businessSlugErrorPayload(error: unknown) {
  const maybe = error as { statusCode?: number; code?: string; publicMessage?: string } | undefined;
  if (!maybe?.statusCode || !maybe.code?.startsWith('invalid_business_slug_')) return null;
  return { status: maybe.statusCode, body: { error: maybe.code, message: maybe.publicMessage ?? 'Invalid Business profile URL.' } };
}

export async function ensureBusinessSlugAvailable(slug: string, options: { ownerBusinessProfileId?: string | null } = {}) {
  const normalized = normalizeBusinessProfileHandle(slug);
  if (!normalized) return null;

  const existing = await prisma.businessProfile.findUnique({ where: { handle: normalized }, select: { id: true } });
  if (existing && existing.id !== options.ownerBusinessProfileId) {
    throw Object.assign(new Error('Business profile URL is already taken.'), {
      statusCode: 409,
      code: 'business_slug_taken',
      publicMessage: 'This Business profile URL is already taken.',
    });
  }
  return normalized;
}

export { normalizeBusinessSlug };
