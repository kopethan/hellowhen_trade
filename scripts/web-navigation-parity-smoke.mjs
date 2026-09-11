import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const appNavigation = read('packages/shared/src/appNavigation.ts');
assert(appNavigation.includes("normalAppNavItemIds = ['plans', 'explore', 'trade']"), 'normal app navigation must be Plans / Explore / Trade');
assert(appNavigation.includes("DEFAULT_NORMAL_APP_NAV_WEB_HREF = '/explore'"), 'Explore must be the normal web default');
assert(!appNavigation.includes("id: 'me',\n    labelKey: 'navigation.tabs.me'"), 'Me must not remain a normal primary nav item');

const webRoutes = read('apps/web/src/lib/webRoutes.ts');
assert(webRoutes.includes("explore: (pathname) => pathname === '/explore'"), 'web routes must match Explore');
assert(webRoutes.includes("pathname === '/explore', titleKey: 'navigation.routes.explore', root: true"), 'Explore must have a root header');

const homePage = read('apps/web/src/app/page.tsx');
assert(homePage.includes('DEFAULT_NORMAL_APP_NAV_WEB_HREF'), 'home must use the shared normal web default');

const bottomTabs = read('apps/web/src/components/WebBottomTabs.tsx');
assert(bottomTabs.includes("'plans-explore-trade'"), 'mobile web tabs must identify Plans / Explore / Trade mode');
assert(!bottomTabs.includes('web-bottom-tabs--dock'), 'normal navigation must not force a desktop bottom dock');

const topHeader = read('apps/web/src/components/WebTopHeader.tsx');
assert(topHeader.includes('function WebAccountAction'), 'normal header must expose a separate Account action');
assert(topHeader.includes('<WebDesktopNav'), 'desktop primary navigation must be rendered');
assert(topHeader.includes("tab.key === 'explore'"), 'Explore must remain public in desktop navigation');

assert(fs.existsSync(path.join(root, 'apps/web/src/app/explore/page.tsx')), 'Explore route must exist');
assert(fs.existsSync(path.join(root, 'apps/web/src/features/explore/ExploreLandingClient.tsx')), 'Explore navigation gateway must exist');

const css = read('apps/web/src/app/globals.css');
assert(css.includes('data-nav-mode="plans-explore-trade"'), 'Explore tab styling must use the new nav mode');
assert(css.includes('.web-account-action'), 'Account header action must be styled');
assert(css.includes('@media (min-width: 760px)'), 'desktop responsive rules must exist');
assert(css.includes('.web-bottom-tabs { display: none; }'), 'desktop must hide the mobile bottom tabs');

console.log('Shared Plans / Explore / Trade navigation contract: PASS');
console.log('Responsive web navigation + Account entry: PASS');
console.log('WEB-PARITY7 navigation smoke: PASS');
