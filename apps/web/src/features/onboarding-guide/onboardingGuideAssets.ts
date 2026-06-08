import type { OnboardingGuideSlideKey } from './onboardingGuide.slides';

type OnboardingImageMode = 'light' | 'dark';

export type OnboardingImageDescriptor = {
  src: string;
  width: number;
  height: number;
};

const ONBOARDING_IMAGE_PATHS: Record<OnboardingImageMode, Record<OnboardingGuideSlideKey, OnboardingImageDescriptor>> = {
  light: {
    welcome: { src: '/onboarding/light/welcome-trade-match-light.webp', width: 960, height: 960 },
    createNeed: { src: '/onboarding/light/create-need-light.webp', width: 960, height: 960 },
    createOffer: { src: '/onboarding/light/create-offer-light.webp', width: 960, height: 960 },
    discoverTrades: { src: '/onboarding/light/discover-trades-light.webp', width: 960, height: 960 },
    sendProposal: { src: '/onboarding/light/send-proposal-light.webp', width: 960, height: 960 },
    staySafe: { src: '/onboarding/light/stay-safe-light.webp', width: 960, height: 960 },
    accountGuide: { src: '/onboarding/light/account-guide-light.webp', width: 960, height: 960 },
  },
  dark: {
    welcome: { src: '/onboarding/dark/welcome-trade-match-dark.webp', width: 960, height: 960 },
    createNeed: { src: '/onboarding/dark/create-need-dark.webp', width: 960, height: 960 },
    createOffer: { src: '/onboarding/dark/create-offer-dark.webp', width: 960, height: 960 },
    discoverTrades: { src: '/onboarding/dark/discover-trades-dark.webp', width: 960, height: 960 },
    sendProposal: { src: '/onboarding/dark/send-proposal-dark.webp', width: 960, height: 960 },
    staySafe: { src: '/onboarding/dark/stay-safe-dark.webp', width: 960, height: 960 },
    accountGuide: { src: '/onboarding/dark/account-guide-dark.webp', width: 960, height: 960 },
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

export function getOnboardingImageDescriptor(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_PATHS[mode][illustrationKey];
}

export function getOnboardingImageBackground(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_BACKGROUNDS[mode][illustrationKey];
}
