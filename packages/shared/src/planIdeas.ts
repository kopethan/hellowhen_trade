import { buildFeedItemsWithStarterIdeas, buildStarterIdeaPlacement } from './feedIdeaPlacement.js';

export const starterPlanIdeaKeys = [
  'coffeeBookstoreWalk',
  'startupCafeMeetup',
  'languageMuseumCafe',
  'sunsetPhotoWalk',
  'coworkingFocusSprint',
  'onlineProjectPlanning',
  'founderFeedbackWalk',
  'creativeMarketRoute',
  'remotePitchPractice',
  'portfolioReviewLoop',
] as const;

export type StarterPlanIdeaKey = (typeof starterPlanIdeaKeys)[number];
export type StarterPlanIdeaMode = 'local' | 'remote';
export type StarterPlanIdeaVisualKey = 'cafe' | 'startup' | 'culture' | 'photo' | 'focus' | 'online';

export type StarterPlanIdeaStop = {
  title: string;
  mode: StarterPlanIdeaMode;
  location?: string;
  onlineLabel?: string;
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
  coffeeBookstoreWalk: {
    id: 'coffeeBookstoreWalk',
    pack: 'Local',
    title: 'Coffee + bookstore + evening walk',
    description: 'A simple local Plan idea for meeting someone around calm places instead of starting from a blank page.',
    category: 'Local discovery',
    tags: ['coffee', 'bookstore', 'walk'],
    visualKey: 'cafe',
    stops: [
      { title: 'Coffee spot', mode: 'local', location: 'A calm café or public coffee place', time: '13:00' },
      { title: 'Bookstore stop', mode: 'local', location: 'A nearby bookstore or cultural shop', time: '14:15' },
      { title: 'Short evening walk', mode: 'local', location: 'A public walking route nearby', time: '15:15' },
    ],
  },
  startupCafeMeetup: {
    id: 'startupCafeMeetup',
    pack: 'Startup',
    title: 'Startup café meetup',
    description: 'A lightweight idea for founders, freelancers, and builders to meet, discuss, and exchange feedback.',
    category: 'Startup',
    tags: ['startup', 'feedback', 'cafe'],
    visualKey: 'startup',
    stops: [
      { title: 'Co-working café', mode: 'local', location: 'A café with tables and Wi-Fi', time: '10:30' },
      { title: 'Quick pitch walk', mode: 'local', location: 'A public walking route for talking ideas', time: '11:45' },
      { title: 'Casual lunch or snack', mode: 'local', location: 'Simple nearby food place', time: '12:30' },
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
      { title: 'Museum or exhibition', mode: 'local', location: 'A public museum, gallery, or exhibition', time: '14:00' },
      { title: 'Vocabulary walk', mode: 'local', location: 'A short public walk nearby', time: '15:15' },
      { title: 'Café conversation', mode: 'local', location: 'A calm café for language practice', time: '16:00' },
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
      { title: 'Meeting point', mode: 'local', location: 'A public meeting point with good light', time: '17:30' },
      { title: 'Photo spot', mode: 'local', location: 'A street, park, bridge, or open public place', time: '18:00' },
      { title: 'Review stop', mode: 'local', location: 'A bench or café to review photos', time: '19:00' },
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
      { title: 'Focus table', mode: 'local', location: 'Library, café, or public working table', time: '09:30' },
      { title: 'Progress check', mode: 'local', location: 'Same place or a short walk nearby', time: '11:00' },
      { title: 'Wrap-up', mode: 'local', location: 'Same area', time: '12:00' },
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
      { title: 'Planning call', mode: 'remote', onlineLabel: 'Video call or voice room', time: '18:00' },
      { title: 'Shared notes', mode: 'remote', onlineLabel: 'Shared document or whiteboard', time: '18:45' },
      { title: 'Next-step check-in', mode: 'remote', onlineLabel: 'Short follow-up message or call', time: '19:15' },
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
      { title: 'Meeting point', mode: 'local', location: 'A public square, café entrance, or easy meeting place', time: '11:00' },
      { title: 'Pitch walk', mode: 'local', location: 'A calm public walking route for explaining ideas', time: '11:20' },
      { title: 'Notes stop', mode: 'local', location: 'A bench or café table to write next steps', time: '12:00' },
    ],
  },
  creativeMarketRoute: {
    id: 'creativeMarketRoute',
    pack: 'Creative',
    title: 'Creative market route',
    description: 'A visual Plan idea for people who want to discover a market, take simple photos, and collect inspiration together.',
    category: 'Creative discovery',
    tags: ['market', 'creative', 'photos'],
    visualKey: 'photo',
    stops: [
      { title: 'Market entrance', mode: 'local', location: 'A public market, flea market, or creative street area', time: '10:00' },
      { title: 'Photo/inspiration stop', mode: 'local', location: 'Public stalls, windows, or visual details nearby', time: '10:45' },
      { title: 'Coffee recap', mode: 'local', location: 'A nearby café or public table', time: '11:30' },
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
      { title: 'Quick intro call', mode: 'remote', onlineLabel: 'Video call or voice room', time: '18:30' },
      { title: 'Feedback notes', mode: 'remote', onlineLabel: 'Shared document, chat, or notes app', time: '18:55' },
      { title: 'Rewrite check', mode: 'remote', onlineLabel: 'Follow-up message with the improved version', time: '19:20' },
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
      { title: 'Review table', mode: 'local', location: 'Library, café, or public working table', time: '15:00' },
      { title: 'Feedback pass', mode: 'local', location: 'Same place or a quiet public table nearby', time: '15:35' },
      { title: 'Action list', mode: 'local', location: 'Same area for writing next changes', time: '16:05' },
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
