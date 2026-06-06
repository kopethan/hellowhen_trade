const ONBOARDING_GUIDE_COMPLETED_KEY = 'hellowhen_web_onboarding_guide_completed_v1';

function getCompletedKey(userId?: string | null) {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId ? `${ONBOARDING_GUIDE_COMPLETED_KEY}:${normalizedUserId}` : ONBOARDING_GUIDE_COMPLETED_KEY;
}

export function hasCompletedWebOnboardingGuide(userId?: string | null) {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(getCompletedKey(userId)) === 'true';
}

export function markWebOnboardingGuideCompleted(userId?: string | null) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getCompletedKey(userId), 'true');
}

export function hasCompletedWebOnboardingGuideForVisitor(userId?: string | null) {
  if (typeof window === 'undefined') return true;
  if (hasCompletedWebOnboardingGuide(userId)) return true;
  return Boolean(userId) && hasCompletedWebOnboardingGuide();
}

export function markWebOnboardingGuideCompletedForVisitor(userId?: string | null) {
  if (typeof window === 'undefined') return;
  markWebOnboardingGuideCompleted();
  if (userId) markWebOnboardingGuideCompleted(userId);
}
