import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { OnboardingGuideType } from './onboardingGuide.slides';
import { DEFAULT_ONBOARDING_GUIDE_TYPE } from './onboardingGuide.slides';

const ONBOARDING_GUIDE_COMPLETED_KEY = 'hellowhen_onboarding_guide_completed_v1';
const FEATURE_GUIDE_PROMPT_KEYS = {
  plans: 'hellowhen_mobile.plans.guideIntro.seen.v1',
  trade: 'hellowhen_mobile.trade.homeIntro.seen.v1',
} as const;
const ONBOARDING_GUIDE_TYPES: OnboardingGuideType[] = ['global', 'trade', 'plans'];

type OnboardingGuideCompletionValue = {
  completed: boolean;
  hydrated: boolean;
  markCompleted: () => Promise<void>;
};

type FeatureGuidePromptType = keyof typeof FEATURE_GUIDE_PROMPT_KEYS;

type FeatureGuidePromptValue = {
  visible: boolean;
  hydrated: boolean;
  dismiss: () => Promise<void>;
  refresh: () => Promise<void>;
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


export async function hasDismissedFeatureGuidePrompt(guideType: FeatureGuidePromptType) {
  return (await AsyncStorage.getItem(FEATURE_GUIDE_PROMPT_KEYS[guideType])) === 'true';
}

export async function dismissFeatureGuidePrompt(guideType: FeatureGuidePromptType) {
  await AsyncStorage.setItem(FEATURE_GUIDE_PROMPT_KEYS[guideType], 'true');
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


export function useFeatureGuidePrompt(guideType: FeatureGuidePromptType): FeatureGuidePromptValue {
  const [visible, setVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    setHydrated(false);
    try {
      const [dismissed, completed] = await Promise.all([
        hasDismissedFeatureGuidePrompt(guideType),
        hasCompletedOnboardingGuide(guideType),
      ]);
      setVisible(!dismissed && !completed);
    } catch {
      setVisible(false);
    } finally {
      setHydrated(true);
    }
  }, [guideType]);

  useEffect(() => { void refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const dismiss = useCallback(async () => {
    setVisible(false);
    await dismissFeatureGuidePrompt(guideType);
  }, [guideType]);

  return useMemo(() => ({ visible, hydrated, dismiss, refresh }), [dismiss, hydrated, refresh, visible]);
}
