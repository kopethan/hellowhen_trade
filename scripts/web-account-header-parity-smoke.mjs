import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label}: missing ${fragment}`);
}

function assertExcludes(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label}: unexpected ${fragment}`);
}

const account = read('apps/web/src/features/account/AccountHubClient.tsx');
assertIncludes(account, 'account-hub-v2__section', 'Account row sections');
assertIncludes(account, "'/trades?activity=mine'", 'Account My trades destination');
assertIncludes(account, "'/trades?activity=involved'", 'Account proposals destination');
assertIncludes(account, 'account-profile-row', 'Account profile row');
assertExcludes(account, 'MeHubWidgetCard', 'Legacy Me widgets removed');
assertExcludes(account, 'me-hub-stat-grid', 'Legacy Me stat dashboard removed');
console.log('Calm Account row hub: PASS');

const shell = read('apps/web/src/components/WebMobileShell.tsx');
const header = read('apps/web/src/components/WebTopHeader.tsx');
const action = read('apps/web/src/components/WebAccountHeaderAction.tsx');
assertIncludes(shell, 'web-app-shell--page-local-header', 'Mobile page-owned header mode');
assertIncludes(header, 'goBackFromAccount', 'Account history back behavior');
assertIncludes(header, 'web-top-header--global-nav', 'Desktop global navigation-only header');
assertIncludes(action, 'feed-world-account-action', 'Reusable account header action');
console.log('Account/header responsive shell: PASS');

for (const path of [
  'apps/web/src/features/trade/TradeFeedClient.tsx',
  'apps/web/src/features/plans/PlansListClient.tsx',
  'apps/web/src/features/explore/ExploreLandingClient.tsx',
]) {
  assertIncludes(read(path), '<WebAccountHeaderAction local />', `Root-world account action ${path}`);
}
const trade = read('apps/web/src/features/trade/TradeFeedClient.tsx');
assertIncludes(trade, "searchParams.get('activity')", 'Account-to-Trade activity deep link');
const explore = read('apps/web/src/features/explore/ExploreLandingClient.tsx');
assertIncludes(explore, 'filtersOpen', 'Explore responsive filter toggle');
assertIncludes(explore, 'explore-filter-pill', 'Explore compact filter action');
console.log('Plans / Explore / Trade header + filter parity: PASS');

const css = read('apps/web/src/app/globals.css');
assertIncludes(css, '.web-app-shell--page-local-header .web-top-header { display: none; }', 'Mobile duplicate global header suppression');
assertIncludes(css, '.feed-world-header .trade-activity-pill,', 'Mobile secondary Trade action suppression');
assertIncludes(css, '.feed-world-header .plans-feed-icon-button--workspace { display: none; }', 'Mobile secondary Plans action suppression');
assertIncludes(css, '.explore-discovery-toolbar.is-open { display: grid; }', 'Mobile Explore filter panel');
console.log('WEB-PARITY9 Account/header/filter responsive polish smoke: PASS');
