import {
  WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE,
  WEB_ONBOARDING_GUIDE_COMPLETED_STORAGE_KEY,
  WEB_ONBOARDING_GUIDE_COOKIE_MAX_AGE_SECONDS,
} from './onboardingGuideConstants';

function getCompletedKey(userId?: string | null) {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId ? `${WEB_ONBOARDING_GUIDE_COMPLETED_STORAGE_KEY}:${normalizedUserId}` : WEB_ONBOARDING_GUIDE_COMPLETED_STORAGE_KEY;
}

function hasCompletedCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item === `${WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE}=true`);
}

function markCompletedCookie() {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE}=true; Path=/; Max-Age=${WEB_ONBOARDING_GUIDE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function hasCompletedWebOnboardingGuide(userId?: string | null) {
  if (typeof window === 'undefined') return true;
  if (window.localStorage.getItem(getCompletedKey(userId)) === 'true') return true;
  return !userId && hasCompletedCookie();
}

export function markWebOnboardingGuideCompleted(userId?: string | null) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getCompletedKey(userId), 'true');
  if (!userId) markCompletedCookie();
}

export function hasCompletedWebOnboardingGuideForVisitor(userId?: string | null) {
  if (typeof window === 'undefined') return true;
  if (hasCompletedWebOnboardingGuide(userId)) return true;
  if (hasCompletedWebOnboardingGuide()) return true;
  return hasCompletedCookie();
}

export function markWebOnboardingGuideCompletedForVisitor(userId?: string | null) {
  if (typeof window === 'undefined') return;
  markCompletedCookie();
  markWebOnboardingGuideCompleted();
  if (userId) markWebOnboardingGuideCompleted(userId);
}
