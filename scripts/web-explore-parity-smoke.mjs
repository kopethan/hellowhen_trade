import fs from 'node:fs/promises';
import path from 'node:path';
import { buildBalancedExploreDiscoveryFeed } from '../packages/shared/src/exploreDiscovery.js';

const root = process.cwd();
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const make = (kind, count) => Array.from({ length: count }, (_, index) => ({ kind, key: `${kind}-${index}` }));
const mixed = buildBalancedExploreDiscoveryFeed({
  trade: make('trade', 4),
  plan: make('plan', 3),
  need: make('need', 3),
  offer: make('offer', 2),
  place: make('place', 3),
}, 123456);
assert(mixed.length === 15, 'Balanced Explore mix dropped concepts.');
assert(new Set(mixed.slice(0, 5).map((item) => item.kind)).size === 5, 'First Explore cycle should expose all available concept kinds.');
for (let index = 1; index < mixed.length; index += 1) {
  if (mixed[index]?.kind !== mixed[index - 1]?.kind) continue;
  const remainingKinds = new Set(mixed.slice(index).map((item) => item.kind));
  assert(remainingKinds.size <= 1, 'Explore produced an avoidable adjacent duplicate concept kind.');
}
console.log('Balanced Trade / Plan / Need / Offer / Place mixing: PASS');

const webExplore = await read('apps/web/src/features/explore/ExploreLandingClient.tsx');
for (const expected of [
  "api.inventoryTemplates.list({ kind: 'need'",
  "api.inventoryTemplates.list({ kind: 'offer'",
  'api.places.library(',
  'buildBalancedExploreDiscoveryFeed({',
  '/explore/${',
  '/explore/places/',
  '/plans/ideas/',
]) assert(webExplore.includes(expected), `Web Explore missing parity behavior: ${expected}`);
assert(!webExplore.includes('exploreGatewayItems'), 'WEB-PARITY7 gateway should be replaced by mixed discovery.');

for (const route of [
  'apps/web/src/app/explore/needs/[templateId]/page.tsx',
  'apps/web/src/app/explore/offers/[templateId]/page.tsx',
  'apps/web/src/app/explore/places/[placeId]/page.tsx',
]) {
  await fs.access(path.join(root, route));
}
console.log('Web mixed Explore sources + destinations: PASS');

const inventoryDetail = await read('apps/web/src/features/explore/ExploreInventoryIdeaDetailClient.tsx');
assert(inventoryDetail.includes('api.inventoryTemplates.clone('), 'Need/Offer Explore detail must clone into Mine before direct actions.');
assert(inventoryDetail.includes('/trades/create?'), 'Need/Offer Explore detail must route into Create Trade.');
assert(!inventoryDetail.includes('api.trades.create('), 'Explore Need/Offer detail must never auto-publish a Trade.');

const placeDetail = await read('apps/web/src/features/explore/HellowhenPlaceDetailClient.tsx');
assert(placeDetail.includes('api.places.create(buildPrivatePlaceCopyRequest(place))'), 'Hellowhen Place detail must create a private Mine copy first.');
assert(placeDetail.includes('/plans/new?createdPlaceId='), 'Hellowhen Place detail must hand the copy into Create Plan.');
assert(!placeDetail.includes('api.plans.create('), 'Explore Place detail must never auto-publish a Plan.');
console.log('Explore Add-to-Mine + no-auto-publish actions: PASS');

const mobileExplore = await read('apps/mobile/src/features/explore/ExploreScreen.tsx');
assert(mobileExplore.includes('buildBalancedExploreDiscoveryFeed'), 'Native Explore should consume the shared balanced mixing helper.');
assert(!mobileExplore.includes('function buildBalancedMixedFeed'), 'Native Explore still contains the old duplicated mixing implementation.');
console.log('Shared native/web Explore mixing helper: PASS');

console.log('WEB-PARITY8 mixed Explore smoke: PASS');
