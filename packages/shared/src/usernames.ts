export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
export const USERNAME_PREVIOUS_HOLD_DAYS = 90;

export const reservedUsernames = new Set([
  'account',
  'admin',
  'administrator',
  'ads',
  'api',
  'auth',
  'billing',
  'business',
  'businesses',
  'credits',
  'delete',
  'discover',
  'help',
  'hellowhen',
  'home',
  'legal',
  'login',
  'logout',
  'me',
  'media',
  'moderator',
  'needs',
  'official',
  'offers',
  'plans',
  'privacy',
  'profile',
  'register',
  'reports',
  'reset-password',
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

export type UsernameValidationResult =
  | { ok: true; username: string }
  | { ok: false; username: string; reason: 'too_short' | 'too_long' | 'invalid_format' | 'reserved' };

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function trimSeparators(value: string) {
  return value.replace(/^[._-]+/, '').replace(/[._-]+$/, '');
}

export function normalizeUsername(value: string) {
  return trimSeparators(
    stripDiacritics(value)
      .trim()
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/[._-]{2,}/g, '-')
  ).slice(0, USERNAME_MAX_LENGTH);
}

export function isReservedUsername(value: string) {
  return reservedUsernames.has(normalizeUsername(value));
}

export function validateUsername(value: string): UsernameValidationResult {
  const username = normalizeUsername(value);
  if (username.length < USERNAME_MIN_LENGTH) return { ok: false, username, reason: 'too_short' };
  if (username.length > USERNAME_MAX_LENGTH) return { ok: false, username, reason: 'too_long' };
  if (!USERNAME_PATTERN.test(username)) return { ok: false, username, reason: 'invalid_format' };
  if (isReservedUsername(username)) return { ok: false, username, reason: 'reserved' };
  return { ok: true, username };
}

export function usernameFromEmail(email: string) {
  return normalizeUsername(email.split('@')[0] ?? 'member');
}

export function suggestUsernameCandidates(seed: string, fallback = 'member') {
  const base = normalizeUsername(seed) || normalizeUsername(fallback) || 'member';
  const candidates = [base];
  const compact = normalizeUsername(base.replace(/[._-]+/g, ''));
  if (compact && compact !== base) candidates.push(compact);
  const withSuffix = `${base}-${new Date().getFullYear()}`;
  if (withSuffix.length <= USERNAME_MAX_LENGTH) candidates.push(withSuffix);
  return Array.from(new Set(candidates)).filter((candidate) => validateUsername(candidate).ok);
}

export function publicUserPath(username?: string | null) {
  const normalized = username ? normalizeUsername(username) : '';
  return normalized ? `/u/${normalized}` : null;
}


export function addUsernamePolicyDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function usernameChangeAvailableAt(lastChangedAt?: string | Date | null) {
  if (!lastChangedAt) return null;
  const changedAt = typeof lastChangedAt === 'string' ? new Date(lastChangedAt) : lastChangedAt;
  if (Number.isNaN(changedAt.getTime())) return null;
  return addUsernamePolicyDays(changedAt, USERNAME_CHANGE_COOLDOWN_DAYS);
}

export function isUsernameChangeCoolingDown(lastChangedAt?: string | Date | null, now = new Date()) {
  const availableAt = usernameChangeAvailableAt(lastChangedAt);
  return Boolean(availableAt && availableAt.getTime() > now.getTime());
}

export function previousUsernameHoldExpiresAt(changedAt = new Date()) {
  return addUsernamePolicyDays(changedAt, USERNAME_PREVIOUS_HOLD_DAYS);
}
