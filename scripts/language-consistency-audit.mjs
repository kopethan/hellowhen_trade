#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failures = 0;
let warnings = 0;

function read(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf8');
}

function pass(label) {
  console.log(`✓ ${label}`);
}

function fail(label, detail) {
  failures += 1;
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function warn(label, detail) {
  warnings += 1;
  console.warn(`! ${label}${detail ? ` — ${detail}` : ''}`);
}

function expectFile(path, label = path) {
  const content = read(path);
  if (!content) {
    fail(label, `${path} is missing`);
    return '';
  }
  pass(label);
  return content;
}

function expectIncludes(path, content, pattern, label) {
  if (!content.includes(pattern)) {
    fail(label, `${path} does not contain ${JSON.stringify(pattern)}`);
    return;
  }
  pass(label);
}

function expectRegex(path, content, regex, label) {
  if (!regex.test(content)) {
    fail(label, `${path} does not match ${regex}`);
    return;
  }
  pass(label);
}

function warnIfMissing(path, content, pattern, label) {
  if (!content.includes(pattern)) {
    warn(label, `${path} does not contain ${JSON.stringify(pattern)}`);
    return;
  }
  pass(label);
}

console.log('Language consistency audit');
console.log('--------------------------');

const resolver = expectFile('packages/shared/src/contentLanguageResolver.ts', 'Shared content language resolver exists');
expectIncludes('packages/shared/src/contentLanguageResolver.ts', resolver, 'export function resolveLocalizedContent', 'Resolver exports resolveLocalizedContent');
expectIncludes('packages/shared/src/contentLanguageResolver.ts', resolver, "'exact' | 'preference' | 'default' | 'fallback' | 'machine'", 'Resolver supports expected source labels');
expectIncludes('packages/shared/src/contentLanguageResolver.ts', resolver, 'export function normalizeContentLanguageOrder', 'Resolver normalizes viewer preference order');
expectRegex('packages/shared/src/contentLanguageResolver.ts', resolver, /contentLanguageCodes\s*=\s*\['en',\s*'fr',\s*'es'\]/, 'Supported content languages are centralized');

const sharedInventory = expectFile('packages/shared/src/inventoryTranslations.ts', 'Shared inventory display adapter exists');
expectIncludes('packages/shared/src/inventoryTranslations.ts', sharedInventory, 'resolveLocalizedContent', 'Inventory adapter delegates to shared resolver');
expectIncludes('packages/shared/src/inventoryTranslations.ts', sharedInventory, 'withResolvedInventoryDisplay', 'Inventory adapter exposes display copy helper');

const settingsContract = expectFile('packages/contracts/src/settings.ts', 'Settings contract includes content language order');
expectIncludes('packages/contracts/src/settings.ts', settingsContract, 'contentLanguageOrderSchema', 'Settings contract validates ordered content languages');
expectIncludes('packages/contracts/src/settings.ts', settingsContract, 'contentLanguageOrder', 'Settings response exposes content language order');

const tradeContract = expectFile('packages/contracts/src/trade.ts', 'Trade contract includes display language schema');
expectIncludes('packages/contracts/src/trade.ts', tradeContract, 'inventoryDisplayLanguageSchema', 'Trade contract defines display language metadata');
expectRegex('packages/contracts/src/trade.ts', tradeContract, /displayLanguage:\s*inventoryDisplayLanguageSchema\.optional\(\)/, 'Need/Offer DTOs expose display language metadata');

const planContract = expectFile('packages/contracts/src/plans.ts', 'Plan/Place contract includes display language metadata');
expectIncludes('packages/contracts/src/plans.ts', planContract, 'displayLanguage: inventoryDisplayLanguageSchema.optional()', 'Place/PlanPlace DTOs expose display language metadata');

const prismaSchema = expectFile('apps/api/prisma/schema.prisma', 'Prisma stores content language order');
expectIncludes('apps/api/prisma/schema.prisma', prismaSchema, 'contentLanguageOrder', 'User settings model stores language order');
const migration = expectFile('apps/api/prisma/migrations/20260630093000_content_language_order/migration.sql', 'Content language order migration exists');
expectIncludes('apps/api/prisma/migrations/20260630093000_content_language_order/migration.sql', migration, 'contentLanguageOrder', 'Migration adds contentLanguageOrder');

const apiSettings = expectFile('apps/api/src/modules/settings/settings.routes.ts', 'Settings API normalizes language order');
expectIncludes('apps/api/src/modules/settings/settings.routes.ts', apiSettings, 'normalizeContentLanguageOrder', 'Settings API normalizes order before returning');
expectIncludes('apps/api/src/modules/settings/settings.routes.ts', apiSettings, 'contentLanguageOrder', 'Settings API reads/writes language order');

const apiInventory = expectFile('apps/api/src/modules/inventoryTranslations.ts', 'API inventory translation adapter exists');
expectIncludes('apps/api/src/modules/inventoryTranslations.ts', apiInventory, 'applyInventoryDisplayLanguage', 'API exposes generic inventory display resolver');
expectIncludes('apps/api/src/modules/inventoryTranslations.ts', apiInventory, 'applyInventoryDisplayLanguageToTrades', 'API exposes trade display resolver');

const tradeRoutes = expectFile('apps/api/src/modules/trades/trades.routes.ts', 'Trade API applies display language');
expectIncludes('apps/api/src/modules/trades/trades.routes.ts', tradeRoutes, 'applyInventoryDisplayLanguageToTrades(sortedTrades', 'Trade feed resolves displayed language');
expectIncludes('apps/api/src/modules/trades/trades.routes.ts', tradeRoutes, 'applyInventoryDisplayLanguageToTrade(hydratedTrade', 'Trade detail resolves displayed language');
expectIncludes('apps/api/src/modules/trades/trades.routes.ts', tradeRoutes, 'contentLanguageOrder', 'Trade API respects user content language order');

const placeRoutes = expectFile('apps/api/src/modules/places/places.routes.ts', 'Place API applies display language');
expectIncludes('apps/api/src/modules/places/places.routes.ts', placeRoutes, 'applyInventoryDisplayLanguage', 'Place API resolves displayed language');
expectIncludes('apps/api/src/modules/places/places.routes.ts', placeRoutes, 'resolveContentLanguagePreferences', 'Place API loads viewer language preferences');

const planRoutes = expectFile('apps/api/src/modules/plans/plans.routes.ts', 'Plan API audited');
warnIfMissing('apps/api/src/modules/plans/plans.routes.ts', planRoutes, 'applyInventoryDisplayLanguage', 'Plan API resolves custom PlanPlace display language');

const webTradePresentation = expectFile('apps/web/src/features/trade/tradePresentation.ts', 'Web trade cards consume display language');
expectIncludes('apps/web/src/features/trade/tradePresentation.ts', webTradePresentation, 'languageBadge', 'Web trade cards show compact fallback language badge');
expectIncludes('apps/web/src/features/trade/tradePresentation.ts', webTradePresentation, 'displayLanguage', 'Web trade cards preserve display language metadata');

const webTradeDetail = expectFile('apps/web/src/features/trade/TradeDetailClient.tsx', 'Web trade detail language switcher exists');
expectIncludes('apps/web/src/features/trade/TradeDetailClient.tsx', webTradeDetail, 'ContentLanguageDetailControls', 'Web trade detail exposes language badge/switcher');

const webPlanPreview = expectFile('apps/web/src/features/plans/PlanPreviewDeck.tsx', 'Web plan cards consume display language');
expectIncludes('apps/web/src/features/plans/PlanPreviewDeck.tsx', webPlanPreview, 'displayLanguageChip', 'Web plan cards show compact fallback language badge');

const webPlanDetail = expectFile('apps/web/src/features/plans/PlanDetailClient.tsx', 'Web plan detail language switcher exists');
expectIncludes('apps/web/src/features/plans/PlanDetailClient.tsx', webPlanDetail, 'ContentLanguageDetailControls', 'Web plan detail exposes language badge/switcher');

const webSettings = expectFile('apps/web/src/app/account/settings/page.tsx', 'Web account settings expose content language order');
expectIncludes('apps/web/src/app/account/settings/page.tsx', webSettings, 'contentLanguageOrder', 'Web account settings can reorder content languages');

const mobileSettings = expectFile('apps/mobile/src/features/settings/SettingsScreen.tsx', 'Native settings expose content language order');
expectIncludes('apps/mobile/src/features/settings/SettingsScreen.tsx', mobileSettings, 'contentLanguageOrder', 'Native settings can reorder content languages');

const mobileControls = expectFile('apps/mobile/src/components/ContentLanguageControls.tsx', 'Native detail language controls exist');
expectIncludes('apps/mobile/src/components/ContentLanguageControls.tsx', mobileControls, 'missingRequested', 'Native detail controls explain language fallback');

const mobileTradeCards = expectFile('apps/mobile/src/features/trade/components/TradeSquareDeckCards.tsx', 'Native trade cards consume display language');
expectIncludes('apps/mobile/src/features/trade/components/TradeSquareDeckCards.tsx', mobileTradeCards, 'languageChip', 'Native trade cards show compact fallback language badge');

const mobilePlanDeck = expectFile('apps/mobile/src/features/plans/components/PlanSquareDeck.tsx', 'Native plan cards consume display language');
expectIncludes('apps/mobile/src/features/plans/components/PlanSquareDeck.tsx', mobilePlanDeck, 'getPlaceLanguageLabel', 'Native plan cards show compact fallback language badge');

console.log('--------------------------');
if (warnings > 0) console.warn(`${warnings} warning(s). See docs/product/content-language-resolution-audit.md for intentionally tracked gaps.`);
if (failures > 0) {
  console.error(`${failures} failure(s). Language consistency audit failed.`);
  process.exit(1);
}
console.log('Language consistency audit passed.');
