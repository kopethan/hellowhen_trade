export type OnboardingGuideType = 'global' | 'trade' | 'plans';

export type OnboardingGuideSlideKey =
  | 'welcome'
  | 'globalWelcome'
  | 'globalWorlds'
  | 'globalMeHub'
  | 'createNeed'
  | 'createOffer'
  | 'discoverTrades'
  | 'sendProposal'
  | 'staySafe'
  | 'accountGuide'
  | 'plansWelcome'
  | 'plansDiscover'
  | 'plansPlaces'
  | 'plansCreateJoin'
  | 'plansSafety';

export type OnboardingGuideSlide = {
  id: string;
  illustrationKey: OnboardingGuideSlideKey;
  titleKey: string;
  bodyKey: string;
  illustrationCaptionKey: string;
};

export type OnboardingGuidePack = {
  type: OnboardingGuideType;
  titleKey: string;
  summaryKey: string;
  slides: OnboardingGuideSlide[];
};

export const ONBOARDING_GUIDE_PACKS: Record<OnboardingGuideType, OnboardingGuidePack> = {
  global: {
    type: 'global',
    titleKey: 'onboarding.guides.global.title',
    summaryKey: 'onboarding.guides.global.summary',
    slides: [
      {
        id: 'global-welcome',
        illustrationKey: 'globalWelcome',
        titleKey: 'onboarding.slides.globalWelcome.title',
        bodyKey: 'onboarding.slides.globalWelcome.body',
        illustrationCaptionKey: 'onboarding.slides.globalWelcome.caption',
      },
      {
        id: 'global-worlds',
        illustrationKey: 'globalWorlds',
        titleKey: 'onboarding.slides.globalWorlds.title',
        bodyKey: 'onboarding.slides.globalWorlds.body',
        illustrationCaptionKey: 'onboarding.slides.globalWorlds.caption',
      },
      {
        id: 'global-me-hub',
        illustrationKey: 'globalMeHub',
        titleKey: 'onboarding.slides.globalMeHub.title',
        bodyKey: 'onboarding.slides.globalMeHub.body',
        illustrationCaptionKey: 'onboarding.slides.globalMeHub.caption',
      },
      {
        id: 'global-safety',
        illustrationKey: 'staySafe',
        titleKey: 'onboarding.slides.globalSafety.title',
        bodyKey: 'onboarding.slides.globalSafety.body',
        illustrationCaptionKey: 'onboarding.slides.globalSafety.caption',
      },
    ],
  },
  trade: {
    type: 'trade',
    titleKey: 'onboarding.guides.trade.title',
    summaryKey: 'onboarding.guides.trade.summary',
    slides: [
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
    ],
  },
  plans: {
    type: 'plans',
    titleKey: 'onboarding.guides.plans.title',
    summaryKey: 'onboarding.guides.plans.summary',
    slides: [
      {
        id: 'plans-welcome',
        illustrationKey: 'plansWelcome',
        titleKey: 'onboarding.slides.plansWelcome.title',
        bodyKey: 'onboarding.slides.plansWelcome.body',
        illustrationCaptionKey: 'onboarding.slides.plansWelcome.caption',
      },
      {
        id: 'plans-discover',
        illustrationKey: 'plansDiscover',
        titleKey: 'onboarding.slides.plansDiscover.title',
        bodyKey: 'onboarding.slides.plansDiscover.body',
        illustrationCaptionKey: 'onboarding.slides.plansDiscover.caption',
      },
      {
        id: 'plans-places',
        illustrationKey: 'plansPlaces',
        titleKey: 'onboarding.slides.plansPlaces.title',
        bodyKey: 'onboarding.slides.plansPlaces.body',
        illustrationCaptionKey: 'onboarding.slides.plansPlaces.caption',
      },
      {
        id: 'plans-create-join',
        illustrationKey: 'plansCreateJoin',
        titleKey: 'onboarding.slides.plansCreateJoin.title',
        bodyKey: 'onboarding.slides.plansCreateJoin.body',
        illustrationCaptionKey: 'onboarding.slides.plansCreateJoin.caption',
      },
      {
        id: 'plans-safety',
        illustrationKey: 'plansSafety',
        titleKey: 'onboarding.slides.plansSafety.title',
        bodyKey: 'onboarding.slides.plansSafety.body',
        illustrationCaptionKey: 'onboarding.slides.plansSafety.caption',
      },
    ],
  },
};

export const DEFAULT_ONBOARDING_GUIDE_TYPE: OnboardingGuideType = 'trade';

export const ONBOARDING_GUIDE_SLIDES = ONBOARDING_GUIDE_PACKS[DEFAULT_ONBOARDING_GUIDE_TYPE].slides;

export function getOnboardingGuidePack(type: string | null | undefined): OnboardingGuidePack {
  return type === 'global' || type === 'trade' || type === 'plans'
    ? ONBOARDING_GUIDE_PACKS[type]
    : ONBOARDING_GUIDE_PACKS[DEFAULT_ONBOARDING_GUIDE_TYPE];
}
