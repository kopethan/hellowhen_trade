export const starterPlanIdeaKeys = [
  'coffeeBookstoreWalk',
  'startupCafeMeetup',
  'languageMuseumCafe',
  'sunsetPhotoWalk',
  'coworkingFocusSprint',
  'onlineProjectPlanning',
];

export const starterPlanIdeas = {
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
};

export function parseStarterPlanIdeaKey(value) {
  if (!value) return null;
  return starterPlanIdeaKeys.includes(value) ? value : null;
}

export function getStarterPlanIdea(value) {
  const key = parseStarterPlanIdeaKey(value);
  return key ? starterPlanIdeas[key] : null;
}

export function starterPlanIdeaMode(idea) {
  const modes = new Set(idea.stops.map((stop) => stop.mode));
  if (modes.size > 1) return 'hybrid';
  return modes.has('remote') ? 'remote' : 'local';
}

export const STARTER_PLAN_IDEA_MAX_FEED_COUNT = 10;
export const STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT = 40;
export const STARTER_PLAN_IDEA_INSERT_EVERY = 4;

function starterPlanHash(value) {
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

export function shouldShowStarterPlanIdeas(realPlanCount, hasActiveSearchOrFilters) {
  if (hasActiveSearchOrFilters) return false;
  return realPlanCount < STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT;
}

export function starterPlanIdeaFeedLimit(realPlanCount) {
  return realPlanCount < STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT ? STARTER_PLAN_IDEA_MAX_FEED_COUNT : 0;
}

export function selectStarterPlanIdeaKeys({
  realPlanCount,
  hasActiveSearchOrFilters,
  userKey,
  refreshKey,
  recentIdeaIds = [],
  dayKey = getStarterPlanIdeaDayKey(),
}) {
  if (!shouldShowStarterPlanIdeas(realPlanCount, hasActiveSearchOrFilters)) return [];
  const limit = Math.min(starterPlanIdeaFeedLimit(realPlanCount), starterPlanIdeaKeys.length);
  if (limit <= 0) return [];
  const recentSet = new Set(recentIdeaIds.map((id) => parseStarterPlanIdeaKey(id)).filter(Boolean));
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

export function buildPlanFeedItems(realPlanCount, ideaKeys) {
  const items = [];
  let nextIdeaIndex = 0;
  for (let planIndex = 0; planIndex < realPlanCount; planIndex += 1) {
    items.push({ type: 'plan', planIndex });
    if (realPlanCount > 3 && realPlanCount < STARTER_PLAN_IDEA_HIDE_AFTER_REAL_PLAN_COUNT && (planIndex + 1) % STARTER_PLAN_IDEA_INSERT_EVERY === 0 && nextIdeaIndex < ideaKeys.length) {
      const ideaKey = ideaKeys[nextIdeaIndex];
      if (ideaKey) items.push({ type: 'idea', ideaKey });
      nextIdeaIndex += 1;
    }
  }
  while (nextIdeaIndex < ideaKeys.length) {
    const ideaKey = ideaKeys[nextIdeaIndex];
    if (ideaKey) items.push({ type: 'idea', ideaKey });
    nextIdeaIndex += 1;
  }
  return items;
}

export function mergeRecentStarterPlanIdeaIds(existing, seen, limit = 20) {
  const next = [...seen, ...existing]
    .map((id) => parseStarterPlanIdeaKey(id))
    .filter(Boolean);
  const unique = [];
  for (const ideaKey of next) {
    if (!unique.includes(ideaKey)) unique.push(ideaKey);
  }
  return unique.slice(0, limit);
}
