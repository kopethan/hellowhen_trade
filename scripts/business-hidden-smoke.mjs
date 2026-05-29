#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const staticOnly = (process.env.BUSINESS_SMOKE_STATIC_ONLY || 'false').toLowerCase() === 'true';
const expectBusinessEnabled = (process.env.EXPECT_BUSINESS_ENABLED || 'false').toLowerCase() === 'true';

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  const content = read(file);
  assert(content.includes(needle), message);
}

function assertEnvDefaultFalse(envExample, key) {
  const pattern = new RegExp(`^${key}=false$`, 'm');
  assert(pattern.test(envExample), `.env.example must keep ${key}=false for first launch.`);
}

function assertEnvDefaultNone(envExample, key) {
  const pattern = new RegExp(`^${key}=none$`, 'm');
  assert(pattern.test(envExample), `.env.example must keep ${key}=none for first launch.`);
}

function runStaticGuardChecks() {
  const envExample = read('.env.example');

  [
    'BUSINESS_ACCOUNTS_ENABLED',
    'BUSINESS_ACCOUNTS_VISIBLE',
    'BUSINESS_SPONSORED_CONTENT_ENABLED',
    'BUSINESS_CAMPAIGNS_ENABLED',
    'BUSINESS_BUDGETS_ENABLED',
    'NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED',
    'NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE',
    'NEXT_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED',
    'NEXT_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED',
    'NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED',
    'EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED',
    'EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE',
    'EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED',
    'EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED',
    'EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED',
  ].forEach((key) => assertEnvDefaultFalse(envExample, key));

  [
    'MONEY_PROVIDER',
    'NEXT_PUBLIC_MONEY_PROVIDER',
    'EXPO_PUBLIC_MONEY_PROVIDER',
    'ADS_PROVIDER',
    'NEXT_PUBLIC_ADS_PROVIDER',
    'EXPO_PUBLIC_ADS_PROVIDER',
    'AI_PROVIDER',
    'NEXT_PUBLIC_AI_PROVIDER',
    'EXPO_PUBLIC_AI_PROVIDER',
  ].forEach((key) => assertEnvDefaultNone(envExample, key));

  assertContains('apps/api/src/routes.ts', "routes.use('/business', requireBusinessAccountsEnabled(), businessRoutes);", 'The Business API must stay behind requireBusinessAccountsEnabled().');
  assertContains('apps/api/src/modules/admin/admin.routes.ts', "adminRoutes.use('/business-profiles', requireBusinessAccountsEnabled('Admin business profiles'));", 'Admin Business profiles must stay behind the Business account guard.');
  assertContains('apps/api/src/modules/admin/admin.routes.ts', "adminRoutes.use('/business-sponsored-placements', requireBusinessSponsoredContentEnabled('Admin Business sponsored placements'));", 'Admin Business sponsored placements must stay behind the sponsored-content guard.');
  assertContains('apps/api/src/modules/admin/admin.routes.ts', "adminRoutes.use('/business-campaigns', requireBusinessCampaignsEnabled('Admin Business campaigns'));", 'Admin Business campaigns must stay behind the campaign guard.');
  assertContains('apps/api/src/modules/admin/admin.routes.ts', "adminRoutes.use('/business-budgets', requireBusinessBudgetsEnabled('Admin Business budget sandbox'));", 'Admin Business budgets must stay behind the budget guard.');

  const featureGates = read('apps/api/src/middleware/featureGates.ts');
  assert(featureGates.includes("business_accounts_disabled"), 'Feature gates must expose the disabled Business account error code.');
  assert(featureGates.includes("business_sponsored_content_disabled"), 'Feature gates must expose the disabled Business sponsored-content error code.');
  assert(featureGates.includes("business_campaigns_disabled"), 'Feature gates must expose the disabled Business campaigns error code.');
  assert(featureGates.includes("business_budgets_disabled"), 'Feature gates must expose the disabled Business budgets error code.');

  const apiEnv = read('apps/api/src/config/env.ts');
  [
    'env.businessAccountsEnabled',
    'env.businessAccountsVisible',
    'env.businessSponsoredContentEnabled',
    'env.businessCampaignsEnabled',
    'env.businessBudgetsEnabled',
    "publicFlagEnabled('NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')",
    "publicFlagEnabled('NEXT_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE')",
    "publicFlagEnabled('NEXT_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED')",
    "publicFlagEnabled('NEXT_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED')",
    "publicFlagEnabled('NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED')",
    "publicFlagEnabled('EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED')",
    "publicFlagEnabled('EXPO_PUBLIC_BUSINESS_ACCOUNTS_VISIBLE')",
    "publicFlagEnabled('EXPO_PUBLIC_BUSINESS_SPONSORED_CONTENT_ENABLED')",
    "publicFlagEnabled('EXPO_PUBLIC_BUSINESS_CAMPAIGNS_ENABLED')",
    "publicFlagEnabled('EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED')",
  ].forEach((needle) => assert(apiEnv.includes(needle), `Production first-launch guard must check ${needle}.`));
  assert(apiEnv.includes('Business/brand account, sponsored-content, campaign, and budget flags must stay disabled/hidden for first launch.'), 'Production first-launch guard must fail loudly if Business flags are enabled.');
  assert(apiEnv.includes('BUSINESS_BUDGETS_ENABLED requires a sandbox-only money provider with provider account creation enabled in production.'), 'Business budget sandbox must require a sandbox-only provider gate.');

  const webFeatures = read('apps/web/src/lib/betaFeatures.tsx');
  assert(webFeatures.includes('const businessAccountsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.NEXT_PUBLIC_BUSINESS_ACCOUNTS_ENABLED);'), 'Web Business flags must be force-disabled by first-launch production guards.');
  assert(webFeatures.includes('businessBudgetsEnabled: businessAccountsEnabled && enabled(process.env.NEXT_PUBLIC_BUSINESS_BUDGETS_ENABLED)'), 'Web Business budget visibility must depend on Business accounts being enabled.');

  const mobileFeatures = read('apps/mobile/src/lib/betaFeatures.ts');
  assert(mobileFeatures.includes('const businessAccountsEnabled = !forceFirstLaunchSafeFlags && enabled(process.env.EXPO_PUBLIC_BUSINESS_ACCOUNTS_ENABLED);'), 'Mobile Business flags must be force-disabled by first-launch production guards.');
  assert(mobileFeatures.includes('businessBudgetsEnabled: businessAccountsEnabled && enabled(process.env.EXPO_PUBLIC_BUSINESS_BUDGETS_ENABLED)'), 'Mobile Business budget visibility must depend on Business accounts being enabled.');

  const businessPlan = read('docs/product/business-enterprise-account-plan.md');
  assert(businessPlan.includes('BUSINESS_ACCOUNTS_ENABLED=false'), 'Business plan doc must keep enabled flag default off.');
  assert(businessPlan.includes('BUSINESS_ACCOUNTS_VISIBLE=false'), 'Business plan doc must keep visible flag default off.');
  assert(businessPlan.includes('BUSINESS_BUDGETS_ENABLED=false'), 'Business plan doc must keep budget flag default off.');

  console.log('Static Business hidden/first-launch guard checks: PASS');
}

async function request(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function expectDisabled(pathname, expectedError) {
  const { response, body } = await request(pathname);
  assert(response.status === 404, `${pathname} should return 404 while Business is disabled, got ${response.status}.`);
  assert(body?.error === expectedError, `${pathname} should return ${expectedError}, got ${body?.error ?? 'no error body'}.`);
  console.log(`${pathname}: ${expectedError} PASS`);
}

async function runRuntimeDisabledChecks() {
  console.log(`Business hidden runtime smoke: ${apiBase}`);
  await expectDisabled('/business', 'business_accounts_disabled');
  await expectDisabled('/business/profiles', 'business_accounts_disabled');
  await expectDisabled('/business/invitations/not-a-real-token/accept', 'business_accounts_disabled');
}

async function main() {
  runStaticGuardChecks();

  if (staticOnly) {
    console.log('BUSINESS_SMOKE_STATIC_ONLY=true, skipped API runtime checks.');
    return;
  }

  if (expectBusinessEnabled) {
    console.log('EXPECT_BUSINESS_ENABLED=true, skipped disabled runtime checks. Use this only for later internal Business QA.');
    return;
  }

  await runRuntimeDisabledChecks();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
