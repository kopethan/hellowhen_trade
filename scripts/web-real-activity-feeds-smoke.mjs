import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n?/g, '\n');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const plans = read('apps/web/src/features/plans/PlansListClient.tsx');
const trade = read('apps/web/src/features/trade/TradeFeedClient.tsx');
const inventory = read('apps/web/src/features/inventory/InventoryListClient.tsx');
const explore = read('apps/web/src/features/explore/ExploreLandingClient.tsx');
const mobileNeeds = read('apps/mobile/src/features/trade/MyNeedsScreen.tsx');
const mobileOffers = read('apps/mobile/src/features/trade/MyOffersScreen.tsx');
const mobilePlans = read('apps/mobile/src/features/plans/PlansScreens.tsx');
const mobileTrade = read('apps/mobile/src/features/trade/TradeDeckFeedScreen.tsx');

assert(!plans.includes('buildPlanFeedItems'), 'Web Plans feed must not mix starter Plan ideas into user-created Plans.');
assert(!plans.includes('selectStarterPlanIdeaKeys'), 'Web Plans feed must not select starter Plan ideas.');
assert(!plans.includes('PlanIdeaCard'), 'Web Plans feed must not render starter Plan idea cards.');
assert(plans.includes("getNormalWorkspaceMenuItems('plans').filter((item) => item.id !== 'plan_ideas')"), 'Web Plans workspace must send curated ideas to Explore instead of exposing a Plan ideas entry.');
assert(plans.includes('href="/explore"'), 'Empty web Plans feed should link to Explore for curated discovery.');

assert(!trade.includes('getFeedStarterIdeaPlacement'), 'Web Trade feed must not place starter ideas among real Trades.');
assert(!trade.includes('getInlineFeedIdeaKey'), 'Web Trade feed must not inject inline starter ideas.');
assert(!trade.includes('renderAfterTrade='), 'Web Trade grid must contain real Trades only.');
assert(trade.includes("getNormalWorkspaceMenuItems('trade').filter((item) => item.id !== 'starter_ideas')"), 'Web Trade workspace must not expose starter ideas outside Explore.');
assert(trade.includes('href="/explore"'), 'Empty web Trade feed should link to Explore for curated discovery.');

assert(!inventory.includes('inventoryTemplates.list'), 'Web My Needs / My Offers must not load curated template libraries.');
assert(!inventory.includes("SourceTab = 'mine' | 'starter'"), 'Web inventory must not expose Mine / Starter source tabs.');
assert(!inventory.includes('StarterTemplateCard'), 'Web inventory must contain user-owned items only.');

assert(!mobileNeeds.includes('StarterInventoryLibrary') && !mobileNeeds.includes('inventoryTemplates.list'), 'Native My Needs must contain user-owned Needs only.');
assert(!mobileOffers.includes('StarterInventoryLibrary') && !mobileOffers.includes('inventoryTemplates.list'), 'Native My Offers must contain user-owned Offers only.');
assert(mobilePlans.includes('const starterIdeas = useMemo<StarterPlanIdeaKey[]>(() => [], []);'), 'Native Plans feed must remain real-activity only.');
assert(mobileTrade.includes('visibleTrades.map((trade, index) => ({'), 'Native Trade feed must remain real-activity only.');

assert(explore.includes('starterPlanIdeaKeys'), 'Explore must retain starter Plan ideas.');
assert(explore.includes('TradeFeedIdeaCard'), 'Explore must retain Trade ideas.');
assert(explore.includes('api.inventoryTemplates.list'), 'Explore must retain Hellowhen Need/Offer templates.');
assert(explore.includes('api.places.library'), 'Explore must retain Hellowhen Places/library content.');

console.log('Plans / Trade feeds real-activity-only: PASS');
console.log('My Needs / My Offers user-owned-only: PASS');
console.log('Explore curated ideas/templates/library ownership: PASS');
console.log('WEB-PARITY-FIX8 real activity feeds + Explore-only curated discovery smoke: PASS');
