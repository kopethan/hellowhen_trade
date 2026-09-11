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

const routes = read('apps/web/src/lib/webRoutes.ts');
assertIncludes(routes, "owner?: WebHeaderOwner", 'Header ownership contract');
assertIncludes(routes, "pageOwnsWebHeader", 'Page-owned header helper');
assertIncludes(routes, "pathname === '/plans/filter'", 'Plan filter route registry');
assertIncludes(routes, "pathname === '/trades/filter'", 'Trade filter route registry');
assertIncludes(routes, "/^\\/explore\\/needs\\/[^/]+$/", 'Explore Need detail registry');
assertIncludes(routes, "/^\\/explore\\/offers\\/[^/]+$/", 'Explore Offer detail registry');
assertIncludes(routes, "/^\\/explore\\/places\\/[^/]+$/", 'Explore Place detail registry');
assertIncludes(routes, "pathname === '/account/agenda'", 'Agenda route registry');
assertIncludes(routes, "pathname === '/account/saved'", 'Saved route registry');
assertIncludes(routes, "pathname === '/account/notifications'", 'Notifications route registry');
assertIncludes(routes, "pathname === '/account/security/password'", 'Password route registry');
assertIncludes(routes, "pathname === '/places'", 'Places route registry');
assertIncludes(routes, "pathname.startsWith('/places')", 'Places activate Plans navigation');
assertIncludes(routes, "pathname.startsWith('/u/')", 'Username profile activates Trade navigation');
console.log('Nested route registry coverage: PASS');

const shell = read('apps/web/src/components/WebMobileShell.tsx');
const header = read('apps/web/src/components/WebTopHeader.tsx');
const css = read('apps/web/src/app/globals.css');
assertIncludes(shell, 'pageOwnsWebHeader', 'Shell ownership lookup');
assertIncludes(shell, "pageOwnsHeader ? 'web-app-shell--page-local-header' : ''", 'Shell page-local class');
assertIncludes(header, "const pageOwnsHeader = header.owner === 'page';", 'Header ownership branch');
assertIncludes(header, 'web-top-header--global-nav', 'Desktop global-only nav header');
assertIncludes(header, 'web-global-brand', 'Desktop brand anchor');
assertIncludes(css, '.web-app-shell--page-local-header .web-top-header { display: none; }', 'Mobile duplicate shell header suppression');
assertIncludes(css, '.web-global-brand', 'Desktop global brand style');
assertExcludes(shell, 'mobileLocalWorldHeader', 'Legacy root-only header ownership removed');
console.log('Shell/page header ownership: PASS');

console.log('WEB-PARITY-FIX1 header ownership + nested route registry smoke: PASS');
