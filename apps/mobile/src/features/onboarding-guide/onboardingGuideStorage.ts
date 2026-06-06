import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

const ONBOARDING_GUIDE_COMPLETED_KEY = 'hellowhen_onboarding_guide_completed_v1';

type OnboardingGuideCompletionValue = {
  completed: boolean;
  hydrated: boolean;
  markCompleted: () => Promise<void>;
};

export async function hasCompletedOnboardingGuide() {
  return (await AsyncStorage.getItem(ONBOARDING_GUIDE_COMPLETED_KEY)) === 'true';
}

export async function markOnboardingGuideCompleted() {
  await AsyncStorage.setItem(ONBOARDING_GUIDE_COMPLETED_KEY, 'true');
}

export function useOnboardingGuideCompletion(): OnboardingGuideCompletionValue {
  const [completed, setCompleted] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const didComplete = await hasCompletedOnboardingGuide();
        if (mounted) setCompleted(didComplete);
      } catch {
        if (mounted) setCompleted(true);
      } finally {
        if (mounted) setHydrated(true);
      }
    }

    void hydrate();

    return () => { mounted = false; };
  }, []);

  const markCompleted = useCallback(async () => {
    setCompleted(true);
    await markOnboardingGuideCompleted();
  }, []);

  return useMemo(() => ({ completed, hydrated, markCompleted }), [completed, hydrated, markCompleted]);
}
