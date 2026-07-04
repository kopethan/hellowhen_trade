import { buildFeedItemsWithStarterIdeas, buildStarterIdeaPlacement } from './feedIdeaPlacement.js';

export const starterPlanIdeaKeys = [
  'startupAppTestCafe',
  'remoteAppOnboardingReview',
  'founderFeedbackWalk',
  'remotePitchPractice',
  'portfolioReviewLoop',
  'profilePhotoLinkedinWalk',
  'sunsetPhotoWalk',
  'localContentPhotoRoute',
  'neighborhoodPosterTest',
  'smallBusinessMenuFeedback',
  'frenchAdminLetterCafe',
  'languageMuseumCafe',
  'publicEventBuddyPlan',
  'studyAccountabilitySprint',
  'coworkingFocusSprint',
  'quietTableWorkSwap',
  'movingApartmentMiniHelp',
  'objectBorrowErrandRun',
  'remoteCommunityLaunchPlan',
  'onlineProjectPlanning',
] as const;

export type StarterPlanIdeaKey = (typeof starterPlanIdeaKeys)[number];
export type StarterPlanIdeaMode = 'local' | 'remote';
export type StarterPlanIdeaVisualKey = 'cafe' | 'startup' | 'culture' | 'photo' | 'focus' | 'online';
export type StarterPlanIdeaStopRequirement = 'address' | 'online_link';

export type StarterPlanIdeaStop = {
  title: string;
  mode: StarterPlanIdeaMode;
  /** Prompt shown to users; never store this as a valid offline address. */
  locationPrompt?: string;
  onlineLabel?: string;
  /** Prompt shown to users; never store this as a valid online destination. */
  onlinePrompt?: string;
  onlineUrl?: string;
  time: string;
};

export type StarterPlanIdea = {
  id: StarterPlanIdeaKey;
  pack: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  visualKey: StarterPlanIdeaVisualKey;
  stops: StarterPlanIdeaStop[];
};

export const starterPlanIdeas: Record<StarterPlanIdeaKey, StarterPlanIdea> = {
  startupAppTestCafe: {
    id: 'startupAppTestCafe',
    pack: 'Startup',
    title: 'App testing café sprint',
    description: 'A starter Plan for finding a few people to test an app like normal users, then turn feedback into clear fixes.',
    category: 'Startup testing',
    tags: ['startup', 'app testing', 'feedback'],
    visualKey: 'startup',
    stops: [
      { title: 'Tester meetup point', mode: 'local', locationPrompt: 'Search and select a real café, library, or public table where testers can sit comfortably', time: '10:00' },
      { title: 'Onboarding test round', mode: 'local', locationPrompt: 'Select the same confirmed address, or search a real quiet table nearby for testing', time: '10:20' },
      { title: 'Feedback recap', mode: 'local', locationPrompt: 'Select the same confirmed area, or search a real nearby public place for notes', time: '11:15' },
    ],
  },
  remoteAppOnboardingReview: {
    id: 'remoteAppOnboardingReview',
    pack: 'Online',
    title: 'Remote onboarding review',
    description: 'A remote idea for checking whether an app, website, or product flow feels clear before sharing it widely.',
    category: 'Remote testing',
    tags: ['online', 'app', 'onboarding'],
    visualKey: 'online',
    stops: [
      { title: 'Screen-share walkthrough', mode: 'remote', onlineLabel: 'Video call or screen-share room', onlinePrompt: 'Add your video-call or screen-share link before publishing', time: '18:00' },
      { title: 'Feedback notes', mode: 'remote', onlineLabel: 'Shared document or feedback form', onlinePrompt: 'Add your shared notes, form, or document link before publishing', time: '18:35' },
      { title: 'Fix list check', mode: 'remote', onlineLabel: 'Follow-up chat or document', onlinePrompt: 'Add the follow-up chat, call, or document link before publishing', time: '19:00' },
    ],
  },
  founderFeedbackWalk: {
    id: 'founderFeedbackWalk',
    pack: 'Startup',
    title: 'Founder feedback walk',
    description: 'A simple public meetup idea for founders or makers to trade honest feedback while walking between calm stops.',
    category: 'Startup feedback',
    tags: ['startup', 'feedback', 'walk'],
    visualKey: 'startup',
    stops: [
      { title: 'Meeting point', mode: 'local', locationPrompt: 'Search and select a real public square, café entrance, or meeting point', time: '11:00' },
      { title: 'Pitch walk', mode: 'local', locationPrompt: 'Search and select a real public start point for explaining ideas', time: '11:20' },
      { title: 'Notes stop', mode: 'local', locationPrompt: 'Search and select a real bench, café table, or public place for next steps', time: '12:00' },
    ],
  },
  remotePitchPractice: {
    id: 'remotePitchPractice',
    pack: 'Online',
    title: 'Remote pitch practice',
    description: 'A remote Plan idea for testing how clearly a project, offer, or profile sounds before sharing it publicly.',
    category: 'Remote practice',
    tags: ['online', 'pitch', 'feedback'],
    visualKey: 'online',
    stops: [
      { title: 'Quick intro call', mode: 'remote', onlineLabel: 'Video call or voice room', onlinePrompt: 'Add your video-call or voice-room link before publishing', time: '18:30' },
      { title: 'Feedback notes', mode: 'remote', onlineLabel: 'Shared document, chat, or notes app', onlinePrompt: 'Add your shared document, chat, or notes link before publishing', time: '18:55' },
      { title: 'Rewrite check', mode: 'remote', onlineLabel: 'Follow-up message with the improved version', onlinePrompt: 'Add the follow-up chat or document link before publishing', time: '19:20' },
    ],
  },
  portfolioReviewLoop: {
    id: 'portfolioReviewLoop',
    pack: 'Focus',
    title: 'Portfolio review loop',
    description: 'A focused Plan idea for reviewing a portfolio, profile, or project page and turning feedback into small next steps.',
    category: 'Portfolio feedback',
    tags: ['portfolio', 'profile', 'review'],
    visualKey: 'focus',
    stops: [
      { title: 'Review table', mode: 'local', locationPrompt: 'Search and select a real library, café, or public working table', time: '15:00' },
      { title: 'Feedback pass', mode: 'local', locationPrompt: 'Select the same confirmed address, or search a real quiet public table nearby', time: '15:35' },
      { title: 'Action list', mode: 'local', locationPrompt: 'Select the same confirmed area, or search a real nearby place for writing changes', time: '16:05' },
    ],
  },
  profilePhotoLinkedinWalk: {
    id: 'profilePhotoLinkedinWalk',
    pack: 'Creative',
    title: 'Profile photo + LinkedIn polish',
    description: 'A practical social Plan for taking simple profile photos, choosing the best shots, and improving a public profile together.',
    category: 'Profile polish',
    tags: ['photo', 'profile', 'linkedin'],
    visualKey: 'photo',
    stops: [
      { title: 'Photo meeting point', mode: 'local', locationPrompt: 'Search and select a real public meeting point with safe foot traffic and good light', time: '16:00' },
      { title: 'Portrait spot', mode: 'local', locationPrompt: 'Search and select a real park, street, wall, or public place for photos', time: '16:25' },
      { title: 'Profile review table', mode: 'local', locationPrompt: 'Search and select a real café, library, or public table for reviewing photos and profile text', time: '17:15' },
    ],
  },
  sunsetPhotoWalk: {
    id: 'sunsetPhotoWalk',
    pack: 'Creative',
    title: 'Sunset photo walk',
    description: 'A creative Plan idea for people who want simple photos, location ideas, or content together.',
    category: 'Creative',
    tags: ['photo', 'walk', 'sunset'],
    visualKey: 'photo',
    stops: [
      { title: 'Meeting point', mode: 'local', locationPrompt: 'Search and select a real public meeting point with good light', time: '17:30' },
      { title: 'Photo spot', mode: 'local', locationPrompt: 'Search and select a real photo spot like a street, park, bridge, or public square', time: '18:00' },
      { title: 'Review stop', mode: 'local', locationPrompt: 'Search and select a real bench, café, or public table for review', time: '19:00' },
    ],
  },
  localContentPhotoRoute: {
    id: 'localContentPhotoRoute',
    pack: 'Creative',
    title: 'Local content photo route',
    description: 'A starter Plan for creators or small businesses who need simple photos, short clips, or local visual ideas.',
    category: 'Content creation',
    tags: ['content', 'photos', 'local'],
    visualKey: 'photo',
    stops: [
      { title: 'First photo stop', mode: 'local', locationPrompt: 'Search and select a real public place that matches the project style', time: '10:30' },
      { title: 'Short video stop', mode: 'local', locationPrompt: 'Search and select a real safe public spot for filming a short clip', time: '11:15' },
      { title: 'Selection table', mode: 'local', locationPrompt: 'Search and select a real café, library, or public table to choose the best shots', time: '12:00' },
    ],
  },
  neighborhoodPosterTest: {
    id: 'neighborhoodPosterTest',
    pack: 'Local',
    title: 'Neighborhood poster test',
    description: 'A local Plan idea for checking whether a poster, flyer, QR code, or offer catches attention in real life.',
    category: 'Local marketing',
    tags: ['poster', 'qr code', 'feedback'],
    visualKey: 'startup',
    stops: [
      { title: 'Poster review point', mode: 'local', locationPrompt: 'Search and select a real café, campus, library, or public place to review the poster safely', time: '14:00' },
      { title: 'Attention test area', mode: 'local', locationPrompt: 'Search and select a real public walking area where feedback can be observed respectfully', time: '14:30' },
      { title: 'Improvement notes', mode: 'local', locationPrompt: 'Search and select a real bench, public table, or café for writing improvements', time: '15:15' },
    ],
  },
  smallBusinessMenuFeedback: {
    id: 'smallBusinessMenuFeedback',
    pack: 'Local',
    title: 'Small business menu feedback',
    description: 'A friendly Plan idea for testing a menu, service offer, product title, or local business message with fresh eyes.',
    category: 'Small business',
    tags: ['business', 'menu', 'feedback'],
    visualKey: 'cafe',
    stops: [
      { title: 'Review table', mode: 'local', locationPrompt: 'Search and select a real café, shop, library, or public table for reviewing the offer', time: '13:30' },
      { title: 'Customer-view walk', mode: 'local', locationPrompt: 'Search and select a real nearby public street or shop area for customer-perspective notes', time: '14:10' },
      { title: 'Rewrite stop', mode: 'local', locationPrompt: 'Search and select a real calm table nearby for improving the wording', time: '14:45' },
    ],
  },
  frenchAdminLetterCafe: {
    id: 'frenchAdminLetterCafe',
    pack: 'Help',
    title: 'French admin letter help',
    description: 'A calm local Plan for getting help understanding a French admin letter, appointment note, or formal message.',
    category: 'Admin help',
    tags: ['french', 'admin', 'help'],
    visualKey: 'culture',
    stops: [
      { title: 'Quiet review table', mode: 'local', locationPrompt: 'Search and select a real library, café, or public working table for private reading', time: '16:00' },
      { title: 'Meaning check', mode: 'local', locationPrompt: 'Select the same confirmed address, or search a real quiet nearby table', time: '16:25' },
      { title: 'Reply draft', mode: 'local', locationPrompt: 'Select the same confirmed area, or search a real public place for writing a reply', time: '17:00' },
    ],
  },
  languageMuseumCafe: {
    id: 'languageMuseumCafe',
    pack: 'Language',
    title: 'Museum + café language exchange',
    description: 'A social Plan idea for practicing language around a public cultural place and a short café conversation.',
    category: 'Language exchange',
    tags: ['language', 'museum', 'cafe'],
    visualKey: 'culture',
    stops: [
      { title: 'Museum or exhibition', mode: 'local', locationPrompt: 'Search and select a real museum, gallery, or exhibition', time: '14:00' },
      { title: 'Vocabulary walk', mode: 'local', locationPrompt: 'Search and select a real public start point for a short walk', time: '15:15' },
      { title: 'Café conversation', mode: 'local', locationPrompt: 'Search and select a real calm café for language practice', time: '16:00' },
    ],
  },
  publicEventBuddyPlan: {
    id: 'publicEventBuddyPlan',
    pack: 'Social',
    title: 'Public event buddy plan',
    description: 'A social Plan for people who want to attend a public event, practice introductions, and feel less alone.',
    category: 'Social confidence',
    tags: ['event', 'confidence', 'networking'],
    visualKey: 'culture',
    stops: [
      { title: 'Pre-event meeting point', mode: 'local', locationPrompt: 'Search and select a real public meeting point near the event entrance', time: '18:00' },
      { title: 'Intro practice walk', mode: 'local', locationPrompt: 'Search and select a real safe public walking point nearby', time: '18:20' },
      { title: 'Post-event recap', mode: 'local', locationPrompt: 'Search and select a real café, bench, or public place for a short recap', time: '20:30' },
    ],
  },
  studyAccountabilitySprint: {
    id: 'studyAccountabilitySprint',
    pack: 'Focus',
    title: 'Study accountability sprint',
    description: 'A simple Plan for two people to focus, check progress, and avoid procrastinating for one clear session.',
    category: 'Accountability',
    tags: ['study', 'focus', 'accountability'],
    visualKey: 'focus',
    stops: [
      { title: 'Focus table', mode: 'local', locationPrompt: 'Search and select a real library, café, or public working table', time: '09:00' },
      { title: 'Progress check', mode: 'local', locationPrompt: 'Select the same confirmed address, or search a real nearby walking point', time: '10:15' },
      { title: 'Done list', mode: 'local', locationPrompt: 'Select the same confirmed area, or search a real nearby public table for the final check', time: '11:30' },
    ],
  },
  coworkingFocusSprint: {
    id: 'coworkingFocusSprint',
    pack: 'Focus',
    title: 'Co-working focus sprint',
    description: 'A practical Plan idea for two or more people who want accountability without a complicated event.',
    category: 'Work session',
    tags: ['coworking', 'focus', 'accountability'],
    visualKey: 'focus',
    stops: [
      { title: 'Focus table', mode: 'local', locationPrompt: 'Search and select a real library, café, or public working table', time: '09:30' },
      { title: 'Progress check', mode: 'local', locationPrompt: 'Select the same confirmed address, or search a real nearby walking point', time: '11:00' },
      { title: 'Wrap-up', mode: 'local', locationPrompt: 'Select the same confirmed area or a real nearby public stop', time: '12:00' },
    ],
  },
  quietTableWorkSwap: {
    id: 'quietTableWorkSwap',
    pack: 'Local',
    title: 'Quiet table work swap',
    description: 'A local Plan for someone who needs a calm table, feedback, or a small focused work session with another person.',
    category: 'Local work',
    tags: ['quiet place', 'work', 'feedback'],
    visualKey: 'cafe',
    stops: [
      { title: 'Quiet table', mode: 'local', locationPrompt: 'Search and select a real quiet café, library, coworking lobby, or public table', time: '13:00' },
      { title: 'Work block', mode: 'local', locationPrompt: 'Select the same confirmed address, or search a real nearby quiet table', time: '13:15' },
      { title: 'Feedback swap', mode: 'local', locationPrompt: 'Select the same confirmed area, or search a real nearby public place for a short review', time: '14:30' },
    ],
  },
  movingApartmentMiniHelp: {
    id: 'movingApartmentMiniHelp',
    pack: 'Local',
    title: 'Apartment mini-help route',
    description: 'A practical Plan for small moving/apartment tasks like carrying one item, checking photos, or planning a pickup.',
    category: 'Local help',
    tags: ['apartment', 'moving', 'local help'],
    visualKey: 'focus',
    stops: [
      { title: 'Pickup meeting point', mode: 'local', locationPrompt: 'Search and select a real public meeting point near the pickup area', time: '10:00' },
      { title: 'Small task stop', mode: 'local', locationPrompt: 'Search and select the real public destination or nearby safe address for the task', time: '10:30' },
      { title: 'Wrap-up point', mode: 'local', locationPrompt: 'Search and select a real nearby public place for final confirmation', time: '11:00' },
    ],
  },
  objectBorrowErrandRun: {
    id: 'objectBorrowErrandRun',
    pack: 'Local',
    title: 'Borrow + return errand plan',
    description: 'A safe structure for borrowing a simple object for a short time, with clear pickup and return points.',
    category: 'Object access',
    tags: ['borrow', 'errand', 'local'],
    visualKey: 'focus',
    stops: [
      { title: 'Public pickup point', mode: 'local', locationPrompt: 'Search and select a real public pickup point, never a private home address unless you trust the person', time: '12:00' },
      { title: 'Use/check point', mode: 'local', locationPrompt: 'Search and select a real public place where the object can be checked or used safely', time: '12:30' },
      { title: 'Return point', mode: 'local', locationPrompt: 'Search and select a real public return point', time: '14:00' },
    ],
  },
  remoteCommunityLaunchPlan: {
    id: 'remoteCommunityLaunchPlan',
    pack: 'Online',
    title: 'Remote community launch plan',
    description: 'A remote starter Plan for preparing a post, invite message, or community introduction before publishing it.',
    category: 'Remote launch',
    tags: ['online', 'community', 'launch'],
    visualKey: 'online',
    stops: [
      { title: 'Audience brainstorm', mode: 'remote', onlineLabel: 'Video call, voice room, or shared board', onlinePrompt: 'Add your video-call, voice-room, or shared-board link before publishing', time: '17:30' },
      { title: 'Message draft', mode: 'remote', onlineLabel: 'Shared document or draft link', onlinePrompt: 'Add your shared document or draft link before publishing', time: '18:05' },
      { title: 'Launch checklist', mode: 'remote', onlineLabel: 'Checklist, task board, or follow-up chat', onlinePrompt: 'Add your checklist, board, or follow-up chat link before publishing', time: '18:40' },
    ],
  },
  onlineProjectPlanning: {
    id: 'onlineProjectPlanning',
    pack: 'Online',
    title: 'Online project planning session',
    description: 'A remote Plan idea for reviewing a project, splitting next steps, and deciding what help is needed.',
    category: 'Remote planning',
    tags: ['online', 'project', 'planning'],
    visualKey: 'online',
    stops: [
      { title: 'Planning call', mode: 'remote', onlineLabel: 'Video call or voice room', onlinePrompt: 'Add your video-call or voice-room link before publishing', time: '18:00' },
      { title: 'Shared notes', mode: 'remote', onlineLabel: 'Shared document or whiteboard', onlinePrompt: 'Add your shared document or whiteboard link before publishing', time: '18:45' },
      { title: 'Next-step check-in', mode: 'remote', onlineLabel: 'Short follow-up message or call', onlinePrompt: 'Add the follow-up chat, call, or meeting link before publishing', time: '19:15' },
    ],
  },
};

export function parseStarterPlanIdeaKey(value: string | null | undefined): StarterPlanIdeaKey | null {
  if (!value) return null;
  return starterPlanIdeaKeys.includes(value as StarterPlanIdeaKey) ? value as StarterPlanIdeaKey : null;
}

export function getStarterPlanIdea(value: string | null | undefined): StarterPlanIdea | null {
  const key = parseStarterPlanIdeaKey(value);
  return key ? starterPlanIdeas[key] : null;
}

export function starterPlanIdeaMode(idea: StarterPlanIdea) {
  const modes = new Set(idea.stops.map((stop) => stop.mode));
  if (modes.size > 1) return 'hybrid' as const;
  return modes.has('remote') ? 'remote' as const : 'local' as const;
}

export function starterPlanIdeaStopDestinationPrompt(stop: StarterPlanIdeaStop) {
  if (stop.mode === 'remote') {
    return stop.onlinePrompt || stop.onlineLabel || 'Add a valid online link before publishing.';
  }
  return stop.locationPrompt || 'Search and select a real address before publishing.';
}

export function starterPlanIdeaStopRequirement(stop: StarterPlanIdeaStop): StarterPlanIdeaStopRequirement {
  return stop.mode === 'remote' ? 'online_link' : 'address';
}

export function starterPlanIdeaStopRequirementLabel(stop: StarterPlanIdeaStop) {
  return starterPlanIdeaStopRequirement(stop) === 'online_link' ? 'Online link needed' : 'Real address needed';
}

export function starterPlanIdeaRequirementCounts(idea: StarterPlanIdea) {
  const addressStops = idea.stops.filter((stop) => starterPlanIdeaStopRequirement(stop) === 'address').length;
  const onlineLinkStops = idea.stops.filter((stop) => starterPlanIdeaStopRequirement(stop) === 'online_link').length;
  return {
    addressStops,
    onlineLinkStops,
    totalStops: idea.stops.length,
    hasAddressStops: addressStops > 0,
    hasOnlineLinkStops: onlineLinkStops > 0,
  };
}

function pluralizeStarterPlanIdeaRequirement(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function starterPlanIdeaRequirementSummary(idea: StarterPlanIdea) {
  const counts = starterPlanIdeaRequirementCounts(idea);
  const parts = [
    counts.addressStops ? pluralizeStarterPlanIdeaRequirement(counts.addressStops, 'real address', 'real addresses') : '',
    counts.onlineLinkStops ? pluralizeStarterPlanIdeaRequirement(counts.onlineLinkStops, 'online link') : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(' + ')} needed` : 'Review before publishing';
}

export const STARTER_PLAN_IDEA_MAX_FEED_COUNT = 10;
export const STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT = 40;
export const STARTER_PLAN_IDEA_INSERT_EVERY = 4;

export type PlanFeedPlanItem = { type: 'plan'; planIndex: number };
export type PlanFeedIdeaItem = { type: 'idea'; ideaKey: StarterPlanIdeaKey };
export type PlanFeedItem = PlanFeedPlanItem | PlanFeedIdeaItem;

export type SelectStarterPlanIdeaOptions = {
  realPlanCount: number;
  hasActiveSearchOrFilters: boolean;
  userKey?: string | null;
  refreshKey?: string | number | null;
  recentIdeaIds?: readonly string[];
  dayKey?: string;
};

function starterPlanHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getStarterPlanIdeaDayKey(date = new Date()) {
  if (Number.isNaN(date.getTime())) return 'unknown-day';
  return date.toISOString().slice(0, 10);
}

export function shouldShowStarterPlanIdeas(realPlanCount: number, hasActiveSearchOrFilters: boolean) {
  if (hasActiveSearchOrFilters) return false;
  return realPlanCount < STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT;
}

export function starterPlanIdeaFeedLimit(realPlanCount: number) {
  return realPlanCount < STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT ? STARTER_PLAN_IDEA_MAX_FEED_COUNT : 0;
}

export function selectStarterPlanIdeaKeys({
  realPlanCount,
  hasActiveSearchOrFilters,
  userKey,
  refreshKey,
  recentIdeaIds = [],
  dayKey = getStarterPlanIdeaDayKey(),
}: SelectStarterPlanIdeaOptions): StarterPlanIdeaKey[] {
  if (!shouldShowStarterPlanIdeas(realPlanCount, hasActiveSearchOrFilters)) return [];
  const limit = Math.min(starterPlanIdeaFeedLimit(realPlanCount), starterPlanIdeaKeys.length);
  if (limit <= 0) return [];
  const recentSet = new Set(recentIdeaIds.map((id) => parseStarterPlanIdeaKey(id)).filter(Boolean) as StarterPlanIdeaKey[]);
  const seed = `${userKey || 'anonymous'}:${dayKey}:${refreshKey ?? 0}:plans`;
  return [...starterPlanIdeaKeys]
    .map((ideaKey) => ({
      ideaKey,
      recentPenalty: recentSet.has(ideaKey) ? 1 : 0,
      score: starterPlanHash(`${seed}:${ideaKey}`),
    }))
    .sort((left, right) => left.recentPenalty - right.recentPenalty || left.score - right.score)
    .slice(0, limit)
    .map((entry) => entry.ideaKey);
}

export function buildPlanFeedItems(realPlanCount: number, ideaKeys: readonly StarterPlanIdeaKey[]): PlanFeedItem[] {
  const placement = buildStarterIdeaPlacement({
    realItemCount: realPlanCount,
    ideaKeys,
    visibleLimit: starterPlanIdeaFeedLimit(realPlanCount),
    sparseFeedThreshold: STARTER_PLAN_IDEA_INSERT_EVERY,
    denseFeedThreshold: STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT,
    insertAfterEveryRealItems: STARTER_PLAN_IDEA_INSERT_EVERY,
  });

  return buildFeedItemsWithStarterIdeas(
    realPlanCount,
    placement,
    (planIndex): PlanFeedPlanItem => ({ type: 'plan', planIndex }),
  ) as PlanFeedItem[];
}

export function mergeRecentStarterPlanIdeaIds(existing: readonly string[], seen: readonly StarterPlanIdeaKey[], limit = 20) {
  const next = [...seen, ...existing]
    .map((id) => parseStarterPlanIdeaKey(id))
    .filter(Boolean) as StarterPlanIdeaKey[];
  const unique: StarterPlanIdeaKey[] = [];
  for (const ideaKey of next) {
    if (!unique.includes(ideaKey)) unique.push(ideaKey);
  }
  return unique.slice(0, limit);
}
