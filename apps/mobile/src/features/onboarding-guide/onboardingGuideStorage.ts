import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { OnboardingGuideType } from './onboardingGuide.slides';
import { DEFAULT_ONBOARDING_GUIDE_TYPE } from './onboardingGuide.slides';

const ONBOARDING_GUIDE_COMPLETED_KEY = 'hellowhen_onboarding_guide_completed_v1';
const ONBOARDING_GUIDE_TYPES: OnboardingGuideType[] = ['global', 'trade', 'plans'];

type OnboardingGuideCompletionValue = {
  completed: boolean;
  hydrated: boolean;
  markCompleted: () => Promise<void>;
};

function normalizeGuideType(type?: OnboardingGuideType | string | null): OnboardingGuideType {
  return ONBOARDING_GUIDE_TYPES.includes(type as OnboardingGuideType)
    ? (type as OnboardingGuideType)
    : DEFAULT_ONBOARDING_GUIDE_TYPE;
}

function getCompletedKey(guideType?: OnboardingGuideType | string | null) {
  return `${ONBOARDING_GUIDE_COMPLETED_KEY}:${normalizeGuideType(guideType)}`;
}

async function hasCompletedLegacyOnboardingGuide() {
  return (await AsyncStorage.getItem(ONBOARDING_GUIDE_COMPLETED_KEY)) === 'true';
}

async function markLegacyOnboardingGuideCompleted() {
  await AsyncStorage.setItem(ONBOARDING_GUIDE_COMPLETED_KEY, 'true');
}

export async function hasCompletedOnboardingGuide(guideType?: OnboardingGuideType | string | null) {
  const normalizedGuideType = normalizeGuideType(guideType);
  const scopedCompleted = (await AsyncStorage.getItem(getCompletedKey(normalizedGuideType))) === 'true';
  if (scopedCompleted) return true;
  if (normalizedGuideType !== 'trade') return false;
  return hasCompletedLegacyOnboardingGuide();
}

export async function markOnboardingGuideCompleted(guideType?: OnboardingGuideType | string | null) {
  const normalizedGuideType = normalizeGuideType(guideType);
  await AsyncStorage.setItem(getCompletedKey(normalizedGuideType), 'true');
  if (normalizedGuideType === 'trade') await markLegacyOnboardingGuideCompleted();
}

export function useOnboardingGuideCompletion(guideType?: OnboardingGuideType | string | null): OnboardingGuideCompletionValue {
  const normalizedGuideType = normalizeGuideType(guideType);
  const [completed, setCompleted] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      setHydrated(false);
      try {
        const didComplete = await hasCompletedOnboardingGuide(normalizedGuideType);
        if (mounted) setCompleted(didComplete);
      } catch {
        if (mounted) setCompleted(true);
      } finally {
        if (mounted) setHydrated(true);
      }
    }

    void hydrate();

    return () => { mounted = false; };
  }, [normalizedGuideType]);

  const markCompleted = useCallback(async () => {
    setCompleted(true);
    await markOnboardingGuideCompleted(normalizedGuideType);
  }, [normalizedGuideType]);

  return useMemo(() => ({ completed, hydrated, markCompleted }), [completed, hydrated, markCompleted]);
}
