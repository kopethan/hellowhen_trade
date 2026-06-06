import type { OnboardingGuideSlideKey } from './onboardingGuide.slides';

type OnboardingImageMode = 'light' | 'dark';

const ONBOARDING_IMAGE_PATHS: Record<OnboardingImageMode, Record<OnboardingGuideSlideKey, string>> = {
  light: {
    welcome: '/onboarding/light/welcome-trade-match-light.png',
    createNeed: '/onboarding/light/create-need-light.png',
    createOffer: '/onboarding/light/create-offer-light.png',
    discoverTrades: '/onboarding/light/discover-trades-light.png',
    sendProposal: '/onboarding/light/send-proposal-light.png',
    staySafe: '/onboarding/light/stay-safe-light.png',
    accountGuide: '/onboarding/light/account-guide-light.png',
  },
  dark: {
    welcome: '/onboarding/dark/welcome-trade-match-dark.png',
    createNeed: '/onboarding/dark/create-need-dark.png',
    createOffer: '/onboarding/dark/create-offer-dark.png',
    discoverTrades: '/onboarding/dark/discover-trades-dark.png',
    sendProposal: '/onboarding/dark/send-proposal-dark.png',
    staySafe: '/onboarding/dark/stay-safe-dark.png',
    accountGuide: '/onboarding/dark/account-guide-dark.png',
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

export function getOnboardingImagePath(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_PATHS[mode][illustrationKey];
}

export function getOnboardingImageBackground(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_BACKGROUNDS[mode][illustrationKey];
}
