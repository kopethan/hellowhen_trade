import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { OnboardingGuideSlide, OnboardingGuideSlideKey } from './onboardingGuide.slides';

type OnboardingImageMode = 'light' | 'dark';

type IllustrationProps = {
  slide: OnboardingGuideSlide;
  mode: OnboardingImageMode;
  backgroundColor: string;
  frameSize?: number;
};

const ONBOARDING_IMAGE_ASSETS: Record<OnboardingImageMode, Partial<Record<OnboardingGuideSlideKey, ImageSourcePropType>>> = {
  light: {
    welcome: require('../../../assets/onboarding/light/welcome-trade-match-light.jpg'),
    globalWelcome: require('../../../assets/guides/light/global-welcome-light.png'),
    globalMeHub: require('../../../assets/guides/light/global-me-hub-light.png'),
    createNeed: require('../../../assets/onboarding/light/create-need-light.jpg'),
    createOffer: require('../../../assets/onboarding/light/create-offer-light.jpg'),
    discoverTrades: require('../../../assets/onboarding/light/discover-trades-light.jpg'),
    sendProposal: require('../../../assets/onboarding/light/send-proposal-light.jpg'),
    staySafe: require('../../../assets/onboarding/light/stay-safe-light.jpg'),
    accountGuide: require('../../../assets/onboarding/light/account-guide-light.jpg'),
    plansWelcome: require('../../../assets/guides/light/plans-welcome-light.png'),
    plansDiscover: require('../../../assets/guides/light/plans-discover-light.png'),
    plansPlaces: require('../../../assets/guides/light/plans-places-light.png'),
    plansCreateJoin: require('../../../assets/guides/light/plans-create-join-light.png'),
    plansSafety: require('../../../assets/guides/light/plans-safety-light.png'),
  },
  dark: {
    welcome: require('../../../assets/onboarding/dark/welcome-trade-match-dark.jpg'),
    globalWelcome: require('../../../assets/guides/dark/global-welcome-dark.png'),
    globalMeHub: require('../../../assets/guides/dark/global-me-hub-dark.png'),
    createNeed: require('../../../assets/onboarding/dark/create-need-dark.jpg'),
    createOffer: require('../../../assets/onboarding/dark/create-offer-dark.jpg'),
    discoverTrades: require('../../../assets/onboarding/dark/discover-trades-dark.jpg'),
    sendProposal: require('../../../assets/onboarding/dark/send-proposal-dark.jpg'),
    staySafe: require('../../../assets/onboarding/dark/stay-safe-dark.jpg'),
    accountGuide: require('../../../assets/onboarding/dark/account-guide-dark.jpg'),
    plansWelcome: require('../../../assets/guides/dark/plans-welcome-dark.png'),
    plansDiscover: require('../../../assets/guides/dark/plans-discover-dark.png'),
    plansPlaces: require('../../../assets/guides/dark/plans-places-dark.png'),
    plansCreateJoin: require('../../../assets/guides/dark/plans-create-join-dark.png'),
    plansSafety: require('../../../assets/guides/dark/plans-safety-dark.png'),
  },
};

const ONBOARDING_IMAGE_BACKGROUNDS: Record<OnboardingImageMode, Partial<Record<OnboardingGuideSlideKey, string>>> = {
  light: {
    welcome: '#FEFEFE',
    globalWelcome: '#FEFEFE',
    globalMeHub: '#FEFEFE',
    createNeed: '#FEFEFE',
    createOffer: '#FAF8F7',
    discoverTrades: '#FCFCFC',
    sendProposal: '#FEFEFE',
    staySafe: '#FDFDFD',
    accountGuide: '#FEFEFE',
    plansWelcome: '#FEFEFE',
    plansDiscover: '#FEFEFE',
    plansPlaces: '#FEFEFE',
    plansCreateJoin: '#FEFEFE',
    plansSafety: '#FEFEFE',
  },
  dark: {
    welcome: '#0A1224',
    globalWelcome: '#050B18',
    globalMeHub: '#050B18',
    createNeed: '#0B0F18',
    createOffer: '#030A15',
    discoverTrades: '#081225',
    sendProposal: '#060D19',
    staySafe: '#020617',
    accountGuide: '#090D16',
    plansWelcome: '#050B18',
    plansDiscover: '#050B18',
    plansPlaces: '#050B18',
    plansCreateJoin: '#050B18',
    plansSafety: '#050B18',
  },
};

export function getOnboardingImageBackground(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_BACKGROUNDS[mode][illustrationKey] ?? ONBOARDING_IMAGE_BACKGROUNDS.light[illustrationKey] ?? '#FEFEFE';
}

function getOnboardingImageAsset(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_ASSETS[mode][illustrationKey] ?? ONBOARDING_IMAGE_ASSETS.light[illustrationKey]!;
}

export function OnboardingSlideIllustration({ slide, mode, backgroundColor, frameSize }: IllustrationProps) {
  const source = getOnboardingImageAsset(mode, slide.illustrationKey);

  return (
    <View style={[styles.frame, frameSize ? { width: frameSize, height: frameSize } : null, { backgroundColor }]}>
      <Image
        source={source}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no"
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
