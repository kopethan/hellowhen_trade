export const BUSINESS_SLUG_MIN_LENGTH = 3;
export const BUSINESS_SLUG_MAX_LENGTH = 40;
export const BUSINESS_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

export const reservedBusinessSlugs = new Set([
  'account',
  'admin',
  'ads',
  'api',
  'auth',
  'billing',
  'brand',
  'brands',
  'business',
  'businesses',
  'contact',
  'credits',
  'enterprise',
  'enterprises',
  'help',
  'hellowhen',
  'home',
  'legal',
  'login',
  'logout',
  'media',
  'moderator',
  'needs',
  'official',
  'offers',
  'plans',
  'privacy',
  'register',
  'reports',
  'security',
  'settings',
  'staff',
  'support',
  'terms',
  'trades',
  'u',
  'user',
  'users',
  'verified',
  'wallet',
]);

export type BusinessSlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; slug: string; reason: 'too_short' | 'too_long' | 'invalid_format' | 'reserved' };

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function trimSeparators(value: string) {
  return value.replace(/^[._-]+/, '').replace(/[._-]+$/, '');
}

export function normalizeBusinessSlug(value: string) {
  return trimSeparators(
    stripDiacritics(value)
      .trim()
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/[._-]{2,}/g, '-')
  ).slice(0, BUSINESS_SLUG_MAX_LENGTH);
}

export function isReservedBusinessSlug(value: string) {
  return reservedBusinessSlugs.has(normalizeBusinessSlug(value));
}

export function validateBusinessSlug(value: string): BusinessSlugValidationResult {
  const slug = normalizeBusinessSlug(value);
  if (slug.length < BUSINESS_SLUG_MIN_LENGTH) return { ok: false, slug, reason: 'too_short' };
  if (slug.length > BUSINESS_SLUG_MAX_LENGTH) return { ok: false, slug, reason: 'too_long' };
  if (!BUSINESS_SLUG_PATTERN.test(slug)) return { ok: false, slug, reason: 'invalid_format' };
  if (isReservedBusinessSlug(slug)) return { ok: false, slug, reason: 'reserved' };
  return { ok: true, slug };
}

export function suggestBusinessSlugCandidates(seed: string, fallback = 'business') {
  const base = normalizeBusinessSlug(seed) || normalizeBusinessSlug(fallback) || 'business';
  const candidates = [base];
  const withoutCompanySuffix = normalizeBusinessSlug(base.replace(/\b(sasu|sas|sarl|sa|ltd|llc|inc|gmbh)\b/g, ''));
  if (withoutCompanySuffix && withoutCompanySuffix !== base) candidates.push(withoutCompanySuffix);
  const compact = normalizeBusinessSlug(base.replace(/[._-]+/g, ''));
  if (compact && compact !== base) candidates.push(compact);
  const withSuffix = `${base}-official`;
  if (withSuffix.length <= BUSINESS_SLUG_MAX_LENGTH) candidates.push(withSuffix);
  return Array.from(new Set(candidates)).filter((candidate) => validateBusinessSlug(candidate).ok);
}

export function publicBusinessPath(slug?: string | null) {
  const normalized = slug ? normalizeBusinessSlug(slug) : '';
  return normalized ? `/b/${normalized}` : null;
}
