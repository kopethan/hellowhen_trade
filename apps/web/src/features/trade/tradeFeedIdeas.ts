export const feedTradeIdeaKeys = [
  'appTestingPhotos',
  'coldDmTranslation',
  'frenchPracticeVideoEdit',
  'localTipsBrandNames',
  'quietTableEmailClarity',
  'tripodUxFeedback',
  'placePhotosNotion',
  'cleanBackgroundSocialPost',
] as const;

export type FeedTradeIdeaKey = (typeof feedTradeIdeaKeys)[number];

export type FeedTradeIdeaTemplatePair = {
  needTemplateKey: string;
  offerTemplateKey: string;
};

export const feedTradeIdeas: Record<FeedTradeIdeaKey, FeedTradeIdeaTemplatePair> = {
  appTestingPhotos: {
    needTemplateKey: 'starter-need-app-flow-normal-user-test',
    offerTemplateKey: 'starter-offer-edit-product-portfolio-photos',
  },
  coldDmTranslation: {
    needTemplateKey: 'starter-need-first-cold-dm',
    offerTemplateKey: 'starter-offer-translate-french-english-text',
  },
  frenchPracticeVideoEdit: {
    needTemplateKey: 'starter-need-practice-french-phone-call',
    offerTemplateKey: 'starter-offer-short-video-reel-edit',
  },
  localTipsBrandNames: {
    needTemplateKey: 'starter-need-local-paris-recommendations',
    offerTemplateKey: 'starter-offer-brand-name-ideas',
  },
  quietTableEmailClarity: {
    needTemplateKey: 'starter-need-quiet-table-video-call',
    offerTemplateKey: 'starter-offer-email-clarity-check',
  },
  tripodUxFeedback: {
    needTemplateKey: 'starter-need-borrow-tripod-day',
    offerTemplateKey: 'starter-offer-ux-feedback-app-website',
  },
  placePhotosNotion: {
    needTemplateKey: 'starter-need-visit-place-send-photos',
    offerTemplateKey: 'starter-offer-notion-portfolio-structure',
  },
  cleanBackgroundSocialPost: {
    needTemplateKey: 'starter-need-clean-background-photos',
    offerTemplateKey: 'starter-offer-simple-social-media-post',
  },
};


export const feedTradeIdeaPlacement = {
  sparseFeedThreshold: 4,
  firstInlineAfterIndex: 2,
  repeatEvery: 4,
  maxInlineIdeas: 3,
} as const;

export function shouldShowFeedIdeaRail(tradeCount: number) {
  return tradeCount < feedTradeIdeaPlacement.sparseFeedThreshold;
}

export function getInlineFeedIdeaKey(index: number, tradeCount: number): FeedTradeIdeaKey | null {
  if (tradeCount < feedTradeIdeaPlacement.sparseFeedThreshold) return null;
  if (index < feedTradeIdeaPlacement.firstInlineAfterIndex) return null;
  const slot = index - feedTradeIdeaPlacement.firstInlineAfterIndex;
  if (slot % feedTradeIdeaPlacement.repeatEvery !== 0) return null;
  const ideaIndex = slot / feedTradeIdeaPlacement.repeatEvery;
  if (ideaIndex >= feedTradeIdeaPlacement.maxInlineIdeas) return null;
  return feedTradeIdeaKeys[ideaIndex % feedTradeIdeaKeys.length] ?? null;
}

export function parseFeedTradeIdeaKey(value?: string | null): FeedTradeIdeaKey | null {
  return feedTradeIdeaKeys.includes(value as FeedTradeIdeaKey) ? value as FeedTradeIdeaKey : null;
}

export function createFeedIdeaTradeHref(ideaKey: FeedTradeIdeaKey) {
  return `/trades/ideas/${ideaKey}`;
}

export function getLocalizedTemplateKeyCandidates(templateKey: string) {
  const suffix = templateKey.replace(/^starter-/, '');
  return [templateKey, `starter-fr-${suffix}`, `starter-es-${suffix}`];
}
