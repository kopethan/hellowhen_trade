export type OnboardingGuideSlideKey =
  | 'welcome'
  | 'createNeed'
  | 'createOffer'
  | 'discoverTrades'
  | 'sendProposal'
  | 'staySafe'
  | 'accountGuide';

export type OnboardingGuideSlide = {
  id: string;
  illustrationKey: OnboardingGuideSlideKey;
  titleKey: string;
  bodyKey: string;
  illustrationCaptionKey: string;
};

export const ONBOARDING_GUIDE_SLIDES: OnboardingGuideSlide[] = [
  {
    id: 'welcome-trade-match',
    illustrationKey: 'welcome',
    titleKey: 'onboarding.slides.welcome.title',
    bodyKey: 'onboarding.slides.welcome.body',
    illustrationCaptionKey: 'onboarding.slides.welcome.caption',
  },
  {
    id: 'create-need',
    illustrationKey: 'createNeed',
    titleKey: 'onboarding.slides.createNeed.title',
    bodyKey: 'onboarding.slides.createNeed.body',
    illustrationCaptionKey: 'onboarding.slides.createNeed.caption',
  },
  {
    id: 'create-offer',
    illustrationKey: 'createOffer',
    titleKey: 'onboarding.slides.createOffer.title',
    bodyKey: 'onboarding.slides.createOffer.body',
    illustrationCaptionKey: 'onboarding.slides.createOffer.caption',
  },
  {
    id: 'discover-trades',
    illustrationKey: 'discoverTrades',
    titleKey: 'onboarding.slides.discoverTrades.title',
    bodyKey: 'onboarding.slides.discoverTrades.body',
    illustrationCaptionKey: 'onboarding.slides.discoverTrades.caption',
  },
  {
    id: 'send-proposal',
    illustrationKey: 'sendProposal',
    titleKey: 'onboarding.slides.sendProposal.title',
    bodyKey: 'onboarding.slides.sendProposal.body',
    illustrationCaptionKey: 'onboarding.slides.sendProposal.caption',
  },
  {
    id: 'stay-safe',
    illustrationKey: 'staySafe',
    titleKey: 'onboarding.slides.staySafe.title',
    bodyKey: 'onboarding.slides.staySafe.body',
    illustrationCaptionKey: 'onboarding.slides.staySafe.caption',
  },
  {
    id: 'account-guide',
    illustrationKey: 'accountGuide',
    titleKey: 'onboarding.slides.accountGuide.title',
    bodyKey: 'onboarding.slides.accountGuide.body',
    illustrationCaptionKey: 'onboarding.slides.accountGuide.caption',
  },
];
