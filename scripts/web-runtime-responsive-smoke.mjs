import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const shell = read('apps/web/src/components/WebMobileShell.tsx');
const css = read('apps/web/src/app/globals.css');

assert(shell.includes("setShowScrollTop(false);\n    setHideTopHeader(false);"), 'Route changes must reset transient mobile chrome state.');
assert(shell.includes("window.matchMedia('(max-width: 759px)').matches"), 'Route-scroll reset must stay mobile-web scoped.');
assert(shell.includes('scrollArea.scrollTop = 0;'), 'Mobile route changes must reset the custom scroll container.');
console.log('Mobile route scroll/chrome reset: PASS');

assert(css.includes('.app-filter-footer,\n  .plans-filter-footer { bottom: calc(var(--app-tab-height) + env(safe-area-inset-bottom)); }'), 'Filter action bars must clear the fixed mobile bottom tabs.');
assert(css.includes('.place-save-row { bottom: calc(var(--app-tab-height) + env(safe-area-inset-bottom) + 10px); }'), 'Place save action must clear the fixed mobile bottom tabs.');
console.log('Mobile sticky actions vs bottom tabs: PASS');

assert(css.includes(':root { --web-content-width: min(1440px, calc(100vw - 64px)); --app-header-height: 82px; }'), 'Desktop header variable must match the rendered desktop global header height.');
assert(css.includes('.trade-detail-toolbar { top: var(--app-header-height); }'), 'Desktop Trade detail toolbar must stick below the global header.');
assert(css.includes('.agenda-day-drawer { top: calc(var(--app-header-height) + 14px); }'), 'Desktop Agenda drawer must stick below the global header.');
console.log('Desktop sticky chrome offsets: PASS');

console.log('WEB-PARITY-FIX5 runtime responsive visual QA cleanup smoke: PASS');
