import type { OnboardingGuideSlideKey } from './onboardingGuide.slides';

type OnboardingImageMode = 'light' | 'dark';

export type OnboardingImageDescriptor = {
  src: string;
  width: number;
  height: number;
};

const ONBOARDING_IMAGE_PATHS: Record<OnboardingImageMode, Partial<Record<OnboardingGuideSlideKey, OnboardingImageDescriptor>>> = {
  light: {
    welcome: { src: '/onboarding/light/welcome-trade-match-light.webp', width: 960, height: 960 },
    globalWelcome: { src: '/images/guides/light/global-welcome-light.webp', width: 960, height: 960 },
    globalWorlds: { src: '/images/guides/light/global-welcome-light.webp', width: 960, height: 960 },
    globalMeHub: { src: '/images/guides/light/global-me-hub-light.webp', width: 960, height: 960 },
    createNeed: { src: '/onboarding/light/create-need-light.webp', width: 960, height: 960 },
    createOffer: { src: '/onboarding/light/create-offer-light.webp', width: 960, height: 960 },
    discoverTrades: { src: '/onboarding/light/discover-trades-light.webp', width: 960, height: 960 },
    sendProposal: { src: '/onboarding/light/send-proposal-light.webp', width: 960, height: 960 },
    staySafe: { src: '/onboarding/light/stay-safe-light.webp', width: 960, height: 960 },
    accountGuide: { src: '/onboarding/light/account-guide-light.webp', width: 960, height: 960 },
    plansWelcome: { src: '/images/guides/light/plans-welcome-light.webp', width: 960, height: 960 },
    plansDiscover: { src: '/images/guides/light/plans-discover-light.webp', width: 960, height: 960 },
    plansPlaces: { src: '/images/guides/light/plans-places-light.webp', width: 960, height: 960 },
    plansCreateJoin: { src: '/images/guides/light/plans-create-join-light.webp', width: 960, height: 960 },
    plansSafety: { src: '/images/guides/light/plans-safety-light.webp', width: 960, height: 960 },
  },
  dark: {
    welcome: { src: '/onboarding/dark/welcome-trade-match-dark.webp', width: 960, height: 960 },
    globalWelcome: { src: '/images/guides/dark/global-welcome-dark.webp', width: 960, height: 960 },
    globalWorlds: { src: '/images/guides/dark/global-welcome-dark.webp', width: 960, height: 960 },
    globalMeHub: { src: '/images/guides/dark/global-me-hub-dark.webp', width: 960, height: 960 },
    createNeed: { src: '/onboarding/dark/create-need-dark.webp', width: 960, height: 960 },
    createOffer: { src: '/onboarding/dark/create-offer-dark.webp', width: 960, height: 960 },
    discoverTrades: { src: '/onboarding/dark/discover-trades-dark.webp', width: 960, height: 960 },
    sendProposal: { src: '/onboarding/dark/send-proposal-dark.webp', width: 960, height: 960 },
    staySafe: { src: '/onboarding/dark/stay-safe-dark.webp', width: 960, height: 960 },
    accountGuide: { src: '/onboarding/dark/account-guide-dark.webp', width: 960, height: 960 },
    plansWelcome: { src: '/images/guides/dark/plans-welcome-dark.webp', width: 960, height: 960 },
    plansDiscover: { src: '/images/guides/dark/plans-discover-dark.webp', width: 960, height: 960 },
    plansPlaces: { src: '/images/guides/dark/plans-places-dark.webp', width: 960, height: 960 },
    plansCreateJoin: { src: '/images/guides/dark/plans-create-join-dark.webp', width: 960, height: 960 },
    plansSafety: { src: '/images/guides/dark/plans-safety-dark.webp', width: 960, height: 960 },
  },
};

const ONBOARDING_IMAGE_BACKGROUNDS: Record<OnboardingImageMode, Partial<Record<OnboardingGuideSlideKey, string>>> = {
  light: {
    welcome: '#FEFEFE',
    globalWelcome: '#FEFEFE',
    globalWorlds: '#FEFEFE',
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
    globalWorlds: '#050B18',
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

export function getOnboardingImageDescriptor(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_PATHS[mode][illustrationKey] ?? ONBOARDING_IMAGE_PATHS.light[illustrationKey]!;
}

export function getOnboardingImageBackground(mode: OnboardingImageMode, illustrationKey: OnboardingGuideSlideKey) {
  return ONBOARDING_IMAGE_BACKGROUNDS[mode][illustrationKey] ?? ONBOARDING_IMAGE_BACKGROUNDS.light[illustrationKey] ?? '#FEFEFE';
}
