const ONBOARDING_GUIDE_COMPLETED_KEY = 'hellowhen_web_onboarding_guide_completed_v1';

export function hasCompletedWebOnboardingGuide() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(ONBOARDING_GUIDE_COMPLETED_KEY) === 'true';
}

export function markWebOnboardingGuideCompleted() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_GUIDE_COMPLETED_KEY, 'true');
}
