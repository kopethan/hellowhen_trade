export const feedTradeIdeaKeys = [
  'appTestingPhotos',
  'coldDmTranslation',
  'frenchPracticeVideoEdit',
  'localTipsBrandNames',
  'quietTableEmailClarity',
  'tripodUxFeedback',
  'placePhotosNotion',
  'cleanBackgroundSocialPost',
  'dogLifestylePhotoShoot',
  'posterAttentionLinkedIn',
  'microphoneAppTest',
  'printerProductDescription',
  'adminLetterEnglishPractice',
  'onboardingOutdoorPhotos',
  'bikePickupQrPoster',
  'productTableDriveCleanup',
  'clientRoleplayLandingReview',
  'networkingIntroSocialClips',
  'openNeedAppOnboarding',
  'openNeedTripod',
  'openNeedAdminLetter',
  'openNeedQuietTable',
  'openOfferOutdoorPhotos',
  'openOfferEnglishPractice',
  'openOfferSocialVideoClips',
  'openOfferLandingReview',
] as const;

export type FeedTradeIdeaKey = (typeof feedTradeIdeaKeys)[number];
export type FeedTradeIdeaType = 'trade' | 'open_need' | 'open_offer';
export type FeedTradeIdeaPostType = 'need_offer' | 'open_need' | 'open_offer';
export type FeedTradeIdeaVisualKey = 'startup' | 'language' | 'local' | 'objects' | 'creative' | 'feedback' | 'social' | 'admin' | 'video' | 'remote';
export type FeedTradeIdeaImageFocus = 'center' | 'top' | 'bottom' | 'left' | 'right';

export type FeedTradeIdeaMedia = {
  /** Optional future media URL for admin-curated starter decks. Empty means use the deterministic fallback visual. */
  imageUrl?: string;
  /** Crop anchor for future admin-curated images. Web uses it as object-position; mobile keeps center-cover for now. */
  imageFocus?: FeedTradeIdeaImageFocus;
  fallbackVisualKey: FeedTradeIdeaVisualKey;
};

type FeedTradeIdeaBase = { media: FeedTradeIdeaMedia };

type FeedTradeIdeaTrade = FeedTradeIdeaBase & { type: 'trade'; needTemplateKey: string; offerTemplateKey: string };
type FeedTradeIdeaOpenNeed = FeedTradeIdeaBase & { type: 'open_need'; needTemplateKey: string };
type FeedTradeIdeaOpenOffer = FeedTradeIdeaBase & { type: 'open_offer'; offerTemplateKey: string };

export type FeedTradeIdeaTemplatePair = FeedTradeIdeaTrade | FeedTradeIdeaOpenNeed | FeedTradeIdeaOpenOffer;
export type FeedTradeIdeaWithNeed = FeedTradeIdeaTrade | FeedTradeIdeaOpenNeed;
export type FeedTradeIdeaWithOffer = FeedTradeIdeaTrade | FeedTradeIdeaOpenOffer;

export const feedTradeIdeas: Record<FeedTradeIdeaKey, FeedTradeIdeaTemplatePair> = {
  appTestingPhotos: {
    type: 'trade',
    media: { fallbackVisualKey: 'startup' },
    needTemplateKey: 'starter-need-app-flow-normal-user-test',
    offerTemplateKey: 'starter-offer-edit-product-portfolio-photos',
  },
  coldDmTranslation: {
    type: 'trade',
    media: { fallbackVisualKey: 'language' },
    needTemplateKey: 'starter-need-first-cold-dm',
    offerTemplateKey: 'starter-offer-translate-french-english-text',
  },
  frenchPracticeVideoEdit: {
    type: 'trade',
    media: { fallbackVisualKey: 'language' },
    needTemplateKey: 'starter-need-practice-french-phone-call',
    offerTemplateKey: 'starter-offer-short-video-reel-edit',
  },
  localTipsBrandNames: {
    type: 'trade',
    media: { fallbackVisualKey: 'local' },
    needTemplateKey: 'starter-need-local-paris-recommendations',
    offerTemplateKey: 'starter-offer-brand-name-ideas',
  },
  quietTableEmailClarity: {
    type: 'trade',
    media: { fallbackVisualKey: 'remote' },
    needTemplateKey: 'starter-need-quiet-table-video-call',
    offerTemplateKey: 'starter-offer-email-clarity-check',
  },
  tripodUxFeedback: {
    type: 'trade',
    media: { fallbackVisualKey: 'objects' },
    needTemplateKey: 'starter-need-borrow-tripod-day',
    offerTemplateKey: 'starter-offer-ux-feedback-app-website',
  },
  placePhotosNotion: {
    type: 'trade',
    media: { fallbackVisualKey: 'local' },
    needTemplateKey: 'starter-need-visit-place-send-photos',
    offerTemplateKey: 'starter-offer-notion-portfolio-structure',
  },
  cleanBackgroundSocialPost: {
    type: 'trade',
    media: { fallbackVisualKey: 'creative' },
    needTemplateKey: 'starter-need-clean-background-photos',
    offerTemplateKey: 'starter-offer-simple-social-media-post',
  },
  dogLifestylePhotoShoot: {
    type: 'trade',
    media: { fallbackVisualKey: 'creative' },
    needTemplateKey: 'starter-need-dog-lifestyle-photo-shoot',
    offerTemplateKey: 'starter-offer-edit-product-portfolio-photos',
  },
  posterAttentionLinkedIn: {
    type: 'trade',
    media: { fallbackVisualKey: 'feedback' },
    needTemplateKey: 'starter-need-poster-five-second-test',
    offerTemplateKey: 'starter-offer-linkedin-freelance-profile-review',
  },
  microphoneAppTest: {
    type: 'trade',
    media: { fallbackVisualKey: 'video' },
    needTemplateKey: 'starter-need-microphone-short-recording',
    offerTemplateKey: 'starter-offer-real-user-app-test',
  },
  printerProductDescription: {
    type: 'trade',
    media: { fallbackVisualKey: 'objects' },
    needTemplateKey: 'starter-need-access-printer',
    offerTemplateKey: 'starter-offer-product-description-polish',
  },
  adminLetterEnglishPractice: {
    type: 'trade',
    media: { fallbackVisualKey: 'admin' },
    needTemplateKey: 'starter-need-explain-french-admin-letter',
    offerTemplateKey: 'starter-offer-english-conversation-practice',
  },
  onboardingOutdoorPhotos: {
    type: 'trade',
    media: { fallbackVisualKey: 'startup' },
    needTemplateKey: 'starter-need-app-onboarding-ten-minute-test',
    offerTemplateKey: 'starter-offer-outdoor-product-photos',
  },
  bikePickupQrPoster: {
    type: 'trade',
    media: { fallbackVisualKey: 'local' },
    needTemplateKey: 'starter-need-bike-small-pickup',
    offerTemplateKey: 'starter-offer-qr-poster-design',
  },
  productTableDriveCleanup: {
    type: 'trade',
    media: { fallbackVisualKey: 'creative' },
    needTemplateKey: 'starter-need-product-table-styling',
    offerTemplateKey: 'starter-offer-organize-notion-google-drive',
  },
  clientRoleplayLandingReview: {
    type: 'trade',
    media: { fallbackVisualKey: 'feedback' },
    needTemplateKey: 'starter-need-client-interview-roleplay',
    offerTemplateKey: 'starter-offer-landing-page-honest-feedback',
  },
  networkingIntroSocialClips: {
    type: 'trade',
    media: { fallbackVisualKey: 'social' },
    needTemplateKey: 'starter-need-networking-event-confidence',
    offerTemplateKey: 'starter-offer-social-video-clips',
  },
  openNeedAppOnboarding: {
    type: 'open_need',
    media: { fallbackVisualKey: 'startup' },
    needTemplateKey: 'starter-need-app-onboarding-ten-minute-test',
  },
  openNeedTripod: {
    type: 'open_need',
    media: { fallbackVisualKey: 'objects' },
    needTemplateKey: 'starter-need-borrow-tripod-day',
  },
  openNeedAdminLetter: {
    type: 'open_need',
    media: { fallbackVisualKey: 'admin' },
    needTemplateKey: 'starter-need-explain-french-admin-letter',
  },
  openNeedQuietTable: {
    type: 'open_need',
    media: { fallbackVisualKey: 'remote' },
    needTemplateKey: 'starter-need-quiet-table-video-call',
  },
  openOfferOutdoorPhotos: {
    type: 'open_offer',
    media: { fallbackVisualKey: 'creative' },
    offerTemplateKey: 'starter-offer-outdoor-product-photos',
  },
  openOfferEnglishPractice: {
    type: 'open_offer',
    media: { fallbackVisualKey: 'language' },
    offerTemplateKey: 'starter-offer-english-conversation-practice',
  },
  openOfferSocialVideoClips: {
    type: 'open_offer',
    media: { fallbackVisualKey: 'video' },
    offerTemplateKey: 'starter-offer-social-video-clips',
  },
  openOfferLandingReview: {
    type: 'open_offer',
    media: { fallbackVisualKey: 'feedback' },
    offerTemplateKey: 'starter-offer-landing-page-honest-feedback',
  },
};


export const feedTradeIdeaImageFocusPositions: Record<FeedTradeIdeaImageFocus, string> = {
  center: 'center center',
  top: 'center top',
  bottom: 'center bottom',
  left: 'left center',
  right: 'right center',
};

export function getFeedTradeIdeaMedia(ideaKey: FeedTradeIdeaKey): FeedTradeIdeaMedia {
  return feedTradeIdeas[ideaKey].media;
}

export function getFeedTradeIdeaImageObjectPosition(media: FeedTradeIdeaMedia) {
  return feedTradeIdeaImageFocusPositions[media.imageFocus ?? 'center'];
}

export function getFeedTradeIdeaPostType(idea: FeedTradeIdeaTemplatePair): FeedTradeIdeaPostType {
  return idea.type === 'trade' ? 'need_offer' : idea.type;
}

export function feedTradeIdeaHasNeed(idea: FeedTradeIdeaTemplatePair): idea is FeedTradeIdeaWithNeed {
  return 'needTemplateKey' in idea;
}

export function feedTradeIdeaHasOffer(idea: FeedTradeIdeaTemplatePair): idea is FeedTradeIdeaWithOffer {
  return 'offerTemplateKey' in idea;
}

export function getFeedTradeIdeaType(ideaKey: FeedTradeIdeaKey): FeedTradeIdeaType {
  return feedTradeIdeas[ideaKey].type;
}

export const feedTradeIdeaPlacement = {
  maxVisibleIdeas: 10,
  sparseFeedThreshold: 4,
  denseFeedThreshold: 40,
  insertAfterEveryRealTrades: 4,
  preferredTradeIdeaCount: 6,
  preferredOpenNeedIdeaCount: 2,
  preferredOpenOfferIdeaCount: 2,
} as const;

// Starter idea growth reduction stays inactive until the feed can pass recent real-trade activity signals.
export const feedTradeIdeaGrowthReduction = {
  activeWeekThreshold: 12,
  veryActiveWeekThreshold: 25,
  activeMonthThreshold: 40,
  veryActiveMonthThreshold: 80,
  activeWeekMaxVisibleIdeas: 6,
  veryActiveWeekMaxVisibleIdeas: 3,
  activeMonthMaxVisibleIdeas: 8,
  veryActiveMonthMaxVisibleIdeas: 5,
} as const;

export type FeedStarterIdeaGrowthSignals = {
  weeklyRealTradeCount?: number | null;
  monthlyRealTradeCount?: number | null;
};

export type FeedStarterIdeaPlacement = {
  inlineIdeaKeysByAfterIndex: Partial<Record<number, FeedTradeIdeaKey>>;
  appendedIdeaKeys: FeedTradeIdeaKey[];
};

export const emptyFeedStarterIdeaPlacement: FeedStarterIdeaPlacement = {
  inlineIdeaKeysByAfterIndex: {},
  appendedIdeaKeys: [],
};

function hashFeedIdeaValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleFeedIdeaKeys(keys: readonly FeedTradeIdeaKey[], seed: string) {
  return [...keys].sort((left, right) => hashFeedIdeaValue(`${seed}:${left}`) - hashFeedIdeaValue(`${seed}:${right}`));
}

function normalizeGrowthCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function getUniqueFeedIdeaKeys(keys: readonly FeedTradeIdeaKey[]) {
  const seen = new Set<FeedTradeIdeaKey>();
  const uniqueKeys: FeedTradeIdeaKey[] = [];

  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueKeys.push(key);
  }

  return uniqueKeys;
}

export function getFeedStarterIdeaVisibleLimit(tradeCount: number, growthSignals: FeedStarterIdeaGrowthSignals = {}) {
  if (tradeCount >= feedTradeIdeaPlacement.denseFeedThreshold) return 0;

  const weeklyRealTradeCount = normalizeGrowthCount(growthSignals.weeklyRealTradeCount);
  const monthlyRealTradeCount = normalizeGrowthCount(growthSignals.monthlyRealTradeCount);
  let visibleLimit: number = feedTradeIdeaPlacement.maxVisibleIdeas;

  if (monthlyRealTradeCount !== null) {
    if (monthlyRealTradeCount >= feedTradeIdeaGrowthReduction.veryActiveMonthThreshold) {
      visibleLimit = Math.min(visibleLimit, feedTradeIdeaGrowthReduction.veryActiveMonthMaxVisibleIdeas);
    } else if (monthlyRealTradeCount >= feedTradeIdeaGrowthReduction.activeMonthThreshold) {
      visibleLimit = Math.min(visibleLimit, feedTradeIdeaGrowthReduction.activeMonthMaxVisibleIdeas);
    }
  }

  if (weeklyRealTradeCount !== null) {
    if (weeklyRealTradeCount >= feedTradeIdeaGrowthReduction.veryActiveWeekThreshold) {
      visibleLimit = Math.min(visibleLimit, feedTradeIdeaGrowthReduction.veryActiveWeekMaxVisibleIdeas);
    } else if (weeklyRealTradeCount >= feedTradeIdeaGrowthReduction.activeWeekThreshold) {
      visibleLimit = Math.min(visibleLimit, feedTradeIdeaGrowthReduction.activeWeekMaxVisibleIdeas);
    }
  }

  return Math.max(0, Math.min(feedTradeIdeaPlacement.maxVisibleIdeas, visibleLimit));
}

export function getRandomizedFeedIdeaKeys(seed: string, maxCount = feedTradeIdeaPlacement.maxVisibleIdeas) {
  const shuffledKeys = shuffleFeedIdeaKeys(feedTradeIdeaKeys, seed);
  const selected = new Set<FeedTradeIdeaKey>();

  function takeByType(type: FeedTradeIdeaType, count: number) {
    for (const key of shuffledKeys) {
      if (selected.size >= maxCount) return;
      if (selected.has(key)) continue;
      if (feedTradeIdeas[key].type !== type) continue;
      selected.add(key);
      count -= 1;
      if (count <= 0) return;
    }
  }

  takeByType('trade', feedTradeIdeaPlacement.preferredTradeIdeaCount);
  takeByType('open_need', feedTradeIdeaPlacement.preferredOpenNeedIdeaCount);
  takeByType('open_offer', feedTradeIdeaPlacement.preferredOpenOfferIdeaCount);

  for (const key of shuffledKeys) {
    if (selected.size >= maxCount) break;
    selected.add(key);
  }

  return shuffleFeedIdeaKeys([...selected], `${seed}:visible`).slice(0, maxCount);
}

export function getFeedStarterIdeaPlacement(tradeCount: number, ideaKeys: readonly FeedTradeIdeaKey[], growthSignals: FeedStarterIdeaGrowthSignals = {}): FeedStarterIdeaPlacement {
  const visibleLimit = getFeedStarterIdeaVisibleLimit(tradeCount, growthSignals);
  const visibleIdeaKeys = getUniqueFeedIdeaKeys(ideaKeys).slice(0, visibleLimit);
  if (!visibleIdeaKeys.length) {
    return emptyFeedStarterIdeaPlacement;
  }

  if (tradeCount < feedTradeIdeaPlacement.sparseFeedThreshold) {
    return {
      inlineIdeaKeysByAfterIndex: {},
      appendedIdeaKeys: [...visibleIdeaKeys],
    };
  }

  const inlineIdeaKeysByAfterIndex: Partial<Record<number, FeedTradeIdeaKey>> = {};
  const inlineIdeaCount = Math.min(Math.floor(tradeCount / feedTradeIdeaPlacement.insertAfterEveryRealTrades), visibleIdeaKeys.length);

  for (let ideaIndex = 0; ideaIndex < inlineIdeaCount; ideaIndex += 1) {
    const afterIndex = ((ideaIndex + 1) * feedTradeIdeaPlacement.insertAfterEveryRealTrades) - 1;
    inlineIdeaKeysByAfterIndex[afterIndex] = visibleIdeaKeys[ideaIndex];
  }

  return {
    inlineIdeaKeysByAfterIndex,
    appendedIdeaKeys: visibleIdeaKeys.slice(inlineIdeaCount),
  };
}

export function getInlineFeedIdeaKey(index: number, placement: FeedStarterIdeaPlacement): FeedTradeIdeaKey | null {
  return placement.inlineIdeaKeysByAfterIndex[index] ?? null;
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
