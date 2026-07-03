import type { OnboardingGuideType } from './onboardingGuide.slides';
import {
  WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE,
  WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE_PREFIX,
  WEB_ONBOARDING_GUIDE_COMPLETED_STORAGE_KEY,
  WEB_ONBOARDING_GUIDE_COOKIE_MAX_AGE_SECONDS,
} from './onboardingGuideConstants';

const WEB_ONBOARDING_GUIDE_TYPES: OnboardingGuideType[] = ['global', 'trade', 'plans'];
const DEFAULT_WEB_ONBOARDING_GUIDE_TYPE: OnboardingGuideType = 'trade';

function normalizeGuideType(type?: OnboardingGuideType | string | null): OnboardingGuideType {
  return WEB_ONBOARDING_GUIDE_TYPES.includes(type as OnboardingGuideType)
    ? (type as OnboardingGuideType)
    : DEFAULT_WEB_ONBOARDING_GUIDE_TYPE;
}

function getCompletedKey(userId?: string | null, guideType?: OnboardingGuideType | string | null) {
  const normalizedGuideType = normalizeGuideType(guideType);
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  const guideScopedKey = `${WEB_ONBOARDING_GUIDE_COMPLETED_STORAGE_KEY}:${normalizedGuideType}`;
  return normalizedUserId ? `${guideScopedKey}:${normalizedUserId}` : guideScopedKey;
}

function getLegacyCompletedKey(userId?: string | null) {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId ? `${WEB_ONBOARDING_GUIDE_COMPLETED_STORAGE_KEY}:${normalizedUserId}` : WEB_ONBOARDING_GUIDE_COMPLETED_STORAGE_KEY;
}


function readLocalStorageItem(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so guide replay remains usable in private/restricted browsers.
  }
}

function getCompletedCookieName(guideType?: OnboardingGuideType | string | null) {
  return `${WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE_PREFIX}${normalizeGuideType(guideType)}`;
}

function hasCookie(name: string) {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item === `${name}=true`);
}

function hasCompletedCookie(guideType?: OnboardingGuideType | string | null) {
  const normalizedGuideType = normalizeGuideType(guideType);
  if (hasCookie(getCompletedCookieName(normalizedGuideType))) return true;
  return normalizedGuideType === 'global' && hasCookie(WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE);
}

function markCookie(name: string) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=true; Path=/; Max-Age=${WEB_ONBOARDING_GUIDE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function markCompletedCookie(guideType?: OnboardingGuideType | string | null) {
  const normalizedGuideType = normalizeGuideType(guideType);
  markCookie(getCompletedCookieName(normalizedGuideType));
  if (normalizedGuideType === 'global') markCookie(WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE);
}

function hasLegacyCompletedWebOnboardingGuide(userId?: string | null) {
  if (typeof window === 'undefined') return true;
  return readLocalStorageItem(getLegacyCompletedKey(userId)) === 'true';
}

function markLegacyCompletedWebOnboardingGuide(userId?: string | null) {
  if (typeof window === 'undefined') return;
  writeLocalStorageItem(getLegacyCompletedKey(userId), 'true');
}

export function hasCompletedWebOnboardingGuide(userId?: string | null, guideType?: OnboardingGuideType | string | null) {
  if (typeof window === 'undefined') return true;
  const normalizedGuideType = normalizeGuideType(guideType);
  if (readLocalStorageItem(getCompletedKey(userId, normalizedGuideType)) === 'true') return true;
  if (normalizedGuideType === 'global' && hasLegacyCompletedWebOnboardingGuide(userId)) return true;
  return !userId && hasCompletedCookie(normalizedGuideType);
}

export function markWebOnboardingGuideCompleted(userId?: string | null, guideType?: OnboardingGuideType | string | null) {
  if (typeof window === 'undefined') return;
  const normalizedGuideType = normalizeGuideType(guideType);
  writeLocalStorageItem(getCompletedKey(userId, normalizedGuideType), 'true');
  if (normalizedGuideType === 'global') markLegacyCompletedWebOnboardingGuide(userId);
  if (!userId) markCompletedCookie(normalizedGuideType);
}

export function hasCompletedWebOnboardingGuideForVisitor(userId?: string | null, guideType?: OnboardingGuideType | string | null) {
  if (typeof window === 'undefined') return true;
  const normalizedGuideType = normalizeGuideType(guideType);
  if (hasCompletedWebOnboardingGuide(userId, normalizedGuideType)) return true;
  if (hasCompletedWebOnboardingGuide(undefined, normalizedGuideType)) return true;
  return hasCompletedCookie(normalizedGuideType);
}

export function markWebOnboardingGuideCompletedForVisitor(userId?: string | null, guideType?: OnboardingGuideType | string | null) {
  if (typeof window === 'undefined') return;
  const normalizedGuideType = normalizeGuideType(guideType);
  markCompletedCookie(normalizedGuideType);
  markWebOnboardingGuideCompleted(undefined, normalizedGuideType);
  if (userId) markWebOnboardingGuideCompleted(userId, normalizedGuideType);
}
