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

const ONBOARDING_IMAGE_ASSETS: Record<OnboardingImageMode, Record<OnboardingGuideSlideKey, ImageSourcePropType>> = {
  light: {
    welcome: require('../../../assets/onboarding/light/welcome-trade-match-light.png'),
    createNeed: require('../../../assets/onboarding/light/create-need-light.png'),
    createOffer: require('../../../assets/onboarding/light/create-offer-light.png'),
    discoverTrades: require('../../../assets/onboarding/light/discover-trades-light.png'),
    sendProposal: require('../../../assets/onboarding/light/send-proposal-light.png'),
    staySafe: require('../../../assets/onboarding/light/stay-safe-light.png'),
    accountGuide: require('../../../assets/onboarding/light/account-guide-light.png'),
  },
  dark: {
    welcome: require('../../../assets/onboarding/dark/welcome-trade-match-dark.png'),
    createNeed: require('../../../assets/onboarding/dark/create-need-dark.png'),
    createOffer: require('../../../assets/onboarding/dark/create-offer-dark.png'),
    discoverTrades: require('../../../assets/onboarding/dark/discover-trades-dark.png'),
    sendProposal: require('../../../assets/onboarding/dark/send-proposal-dark.png'),
    staySafe: require('../../../assets/onboarding/dark/stay-safe-dark.png'),
    accountGuide: require('../../../assets/onboarding/dark/account-guide-dark.png'),
  },
};

const ONBOARDING_IMAGE_BACKGROUNDS: Record<OnboardingImageMode, Record<OnboardingGuideSlideKey, string>> = {
  light: {
    welcome: '#FEFEFE',
    createNeed: '#FEFEFE',
    createOffer: '#FAF8F7',
    discoverTrades: '#FCFCFC',
    sendProposal: '#FEFEFE',
    staySafe: '#FDFDFD',
    accountGuide: '#FEFEFE',
  },
  dark: {
    welcome: '#0A1224',
    createNeed: '#0B0F18',
    createOffer: '#030A15',
    discoverTrades: '#081225',
    sendProposal: '#060D19',
    staySafe: '#020617',
    accountGuide: '#090D16',
  },
};

export function getOnboardingImageBackground(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_BACKGROUNDS[mode][illustrationKey];
}

export function OnboardingSlideIllustration({ slide, mode, backgroundColor, frameSize }: IllustrationProps) {
  const source = ONBOARDING_IMAGE_ASSETS[mode][slide.illustrationKey];

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
