import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const landing = await read('apps/web/src/features/explore/ExploreLandingClient.tsx');
assert(landing.includes('function withExploreReturnContext('), 'Explore feed must mark Trade/Plan idea links with their Explore origin.');
assert(landing.includes('withExploreReturnContext(createFeedIdeaTradeHref(ideaKey))'), 'Trade ideas opened from Explore must carry from=explore.');
assert(landing.includes('withExploreReturnContext(`/plans/ideas/${item.ideaKey}`)'), 'Plan ideas opened from Explore must carry from=explore.');
console.log('Explore Trade/Plan origin context: PASS');

for (const relative of [
  'apps/web/src/features/explore/ExploreInventoryIdeaDetailClient.tsx',
  'apps/web/src/features/explore/HellowhenPlaceDetailClient.tsx',
]) {
  const source = await read(relative);
  assert(source.includes('href="/explore" className="explore-detail-back"'), `${relative} must have a deterministic Explore back destination.`);
  assert(!source.includes('router.back()'), `${relative} must not use raw router.back() for an Explore-owned detail.`);
}
console.log('Need / Offer / Place safe return to Explore: PASS');

const tradeIdea = await read('apps/web/src/features/trade/TradeIdeaDetailClient.tsx');
assert(tradeIdea.includes("searchParams.get('from') === 'explore'"), 'Trade idea detail must detect Explore origin.');
assert(tradeIdea.includes("const returnHref = fromExplore ? '/explore' : '/trades';"), 'Trade idea detail must preserve Trade vs Explore return context.');
assert(tradeIdea.includes("${fromExplore ? '?from=explore' : ''}"), 'Trade idea related links must preserve Explore context.');

const planIdea = await read('apps/web/src/features/plans/PlanIdeaDetailClient.tsx');
assert(planIdea.includes("searchParams.get('from') === 'explore'"), 'Plan idea detail must detect Explore origin.');
assert(planIdea.includes("const returnHref = fromExplore ? '/explore' : '/plans';"), 'Plan idea detail must preserve Plans vs Explore return context.');
console.log('Trade / Plan idea return context: PASS');

const css = await read('apps/web/src/app/globals.css');
assert(!css.includes('--app-tabbar-height'), 'Explore mobile action dock still references the undefined --app-tabbar-height variable.');
assert(css.includes('.explore-detail-actions { position: sticky; z-index: 20; bottom: calc(var(--app-tab-height) + env(safe-area-inset-bottom));'), 'Explore mobile action dock must sit above the real app tab height.');
console.log('Explore mobile action dock safe-area offset: PASS');

console.log('WEB-PARITY-FIX2 Explore return context + mobile action dock smoke: PASS');
