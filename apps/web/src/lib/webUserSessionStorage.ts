const USER_SESSION_STORAGE_PREFIX = 'hellowhen:web:user-session';

const LEGACY_UNSCOPED_SESSION_KEYS = [
  'hellowhen.planCreateDraft.v1',
  'hellowhen.planCreateDraft.pendingPlaceIndex.v1',
] as const;

const LEGACY_UNSCOPED_SESSION_PREFIXES = [
  'proposal-edit-draft:',
] as const;

function normalizedUserId(userId?: string | null) {
  const normalized = typeof userId === 'string' ? userId.trim() : '';
  return normalized || null;
}

function userSessionStoragePrefix(userId: string) {
  return `${USER_SESSION_STORAGE_PREFIX}:${encodeURIComponent(userId)}:`;
}

export function buildWebUserSessionStorageKey(userId: string, scope: string, resourceId?: string | null) {
  const normalized = normalizedUserId(userId);
  if (!normalized) throw new Error('A user ID is required for user-scoped session storage.');
  const suffix = resourceId ? `:${encodeURIComponent(resourceId)}` : '';
  return `${userSessionStoragePrefix(normalized)}${scope}${suffix}`;
}

export function clearWebUserSessionStorage(userId?: string | null) {
  if (typeof window === 'undefined') return;
  const normalized = normalizedUserId(userId);
  if (!normalized) return;
  const prefix = userSessionStoragePrefix(normalized);
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) window.sessionStorage.removeItem(key);
}

export function clearLegacyUnscopedWebUserSessionStorage() {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_UNSCOPED_SESSION_KEYS) window.sessionStorage.removeItem(key);
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key && LEGACY_UNSCOPED_SESSION_PREFIXES.some((prefix) => key.startsWith(prefix))) keysToRemove.push(key);
  }
  for (const key of keysToRemove) window.sessionStorage.removeItem(key);
}
