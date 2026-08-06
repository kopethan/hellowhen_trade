#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExists(relativePath) {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} is missing.`);
}

function assertContains(relativePath, needle, message = `${relativePath} must contain ${needle}`) {
  assert(read(relativePath).includes(needle), message);
}

function assertContainsAll(relativePath, needles, label) {
  const contents = read(relativePath);
  for (const needle of needles) {
    assert(contents.includes(needle), `${label}: ${relativePath} must contain ${needle}`);
  }
}

function runReportContractChecks() {
  assertContainsAll('packages/contracts/src/reports.ts', [
    "'profile'",
    "'trade'",
    "'proposal'",
    "'message'",
    "'public_message'",
    "'media'",
    "'plan'",
    "'plan_place'",
    'userReportsResponseSchema',
  ], 'Report contract coverage');
  assertContains('packages/api-client/src/index.ts', "mine: () => requestJson<UserReportsResponse>(options, '/reports/mine')", 'Reports history must use its typed response contract.');
  console.log('UGC report contracts: PASS');
}

function runReportPipelineChecks() {
  assertContainsAll('apps/api/src/modules/reports/reports.routes.ts', [
    'reportsRoutes.use(requireAuth)',
    'reportsRoutes.use(requireActiveAccount)',
    "reportsRoutes.post('/',",
    "reportsRoutes.get('/mine',",
    'createModerationCaseForReport',
    'moderationCaseId: moderationCase.id',
    'hydrateReports',
  ], 'Report API and moderation queue');
  const reportRoutes = read('apps/api/src/modules/reports/reports.routes.ts');
  const publicMapper = reportRoutes.slice(reportRoutes.indexOf('function publicReportResponse'), reportRoutes.indexOf('function publicReportResponses'));
  for (const privateField of ['moderationCaseId', 'resolutionNote', 'escalatedSupportTicketId', 'escalatedAt', 'reviewer']) {
    assert(!publicMapper.includes(privateField), `Reporter-facing report responses must not expose ${privateField}.`);
  }
  assertContainsAll('apps/api/src/modules/admin/admin.routes.ts', [
    "adminRoutes.get('/reports'",
    "adminRoutes.patch('/reports/:reportId/action'",
    "'mark_reviewing'",
    "'hide_target'",
    "'suspend_target_owner'",
    "'escalate_to_support'",
  ], 'Admin report actions');
  console.log('UGC report moderation pipeline: PASS');
}

function runMobileReportingChecks() {
  assertContains('apps/mobile/src/components/ReportContentPanel.tsx', 'api.reports.create', 'Shared mobile report panel must submit to the reports API.');
  assertContains('apps/mobile/src/features/trade/TradeDetailScreen.tsx', '<ReportContentPanel targetType="trade"', 'Trade detail must expose reporting for non-owners.');
  assertContains('apps/mobile/src/features/users/PublicUserProfileScreen.tsx', '<ReportContentPanel targetType="profile"', 'Public profiles must expose reporting.');
  assertContainsAll('apps/mobile/src/features/trade/TradePublicDiscussionScreen.tsx', [
    '<ReportContentPanel targetType="public_message"',
    '<ReportContentPanel targetType="trade"',
  ], 'Trade public discussion reporting');
  assertContainsAll('apps/mobile/src/features/plans/PlansScreens.tsx', [
    '<ReportContentPanel targetType="plan_place"',
    '<ReportContentPanel targetType="plan"',
  ], 'Plan and Plan Place reporting');
  assertContains('apps/mobile/src/features/plans/PlanPublicDiscussionScreen.tsx', '<ReportContentPanel targetType={mode.targetType}', 'Plan public discussions must report messages and Plans.');
  assertContainsAll('apps/mobile/src/features/trade/ProposalDetailScreen.tsx', [
    "targetType: 'message'",
    "targetType: 'proposal'",
    'api.proposals.reportProblem',
    '<ReportContentPanel targetType={messageReportTarget.targetType}',
  ], 'Private proposal and deal reporting');
  console.log('Mobile UGC reporting surfaces: PASS');
}

function runBlockingChecks() {
  assertContainsAll('apps/mobile/src/features/users/PublicUserProfileScreen.tsx', [
    'api.users.block(profile.user.id)',
    'api.users.unblock(profile.user.id)',
  ], 'Public profile block controls');
  assertContainsAll('apps/api/src/modules/users/users.routes.ts', [
    "usersRoutes.get('/blocked'",
    "usersRoutes.post('/:userId/block'",
    "usersRoutes.delete('/:userId/block'",
    'memberSince: blocked.createdAt',
    'getUserVerificationBadges',
  ], 'Blocked-member API and safe response');
  assertContainsAll('apps/mobile/src/features/account/SafetyCenterScreen.tsx', [
    'api.users.blocked()',
    'api.users.unblock(blockedUserId)',
    'api.reports.mine()',
    "navigation.navigate('LegalPolicy', { policy: 'safety' })",
    "navigation.navigate('SupportCenter')",
  ], 'Safety Center controls');
  assertContainsAll('apps/mobile/src/navigation/RootNavigator.tsx', [
    'SafetyCenter: undefined',
    'ProtectedSafetyCenterScreen',
    '<Stack.Screen name="SafetyCenter" component={ProtectedSafetyCenterScreen} />',
  ], 'Safety Center route');
  assertContains('apps/mobile/src/features/account/AccountScreen.tsx', "route: 'SafetyCenter'", 'Account must link to Safety Center.');
  console.log('Mobile block/unblock and Safety Center: PASS');
}

function runFilteringAndSupportChecks() {
  for (const relativePath of [
    'apps/api/src/modules/needs/needs.routes.ts',
    'apps/api/src/modules/offers/offers.routes.ts',
    'apps/api/src/modules/trades/trades.routes.ts',
    'apps/api/src/modules/plans/plans.routes.ts',
  ]) {
    assertContains(relativePath, 'runAiTextReview', `${relativePath} must keep text moderation enforcement.`);
  }
  assertContainsAll('apps/mobile/src/features/account/SupportCenterScreen.tsx', [
    'api.support.createTicket',
    'ImagePickerField',
    "navigation.navigate('SafetyCenter')",
    "navigation.navigate('LegalPolicy', { policy: 'safety' })",
    "navigation.navigate('LegalPolicy', { policy: 'refundDispute' })",
  ], 'Mobile safety support');
  assertContainsAll('apps/mobile/src/features/account/AccountDeletionScreen.tsx', [
    'api.account.requestDeletion',
    'api.account.cancelDeletionRequest',
    "navigation.navigate('SupportCenter')",
  ], 'In-app account deletion');
  console.log('UGC filtering, support, and deletion: PASS');
}

function runReviewerDocsChecks() {
  assertExists('docs/launch/mobile-ugc-safety-review-checklist.md');
  assertContainsAll('docs/launch/mobile-ugc-safety-review-checklist.md', [
    'Report privacy',
    'Block and unblock',
    'Admin moderation queue',
    'Account deletion',
    'Reviewer account',
  ], 'Manual UGC safety review checklist');
  assertContains('docs/launch/mobile-store-readiness-checklist.md', 'mobile-ugc-safety-review-checklist.md', 'Store readiness checklist must link to the focused UGC checklist.');
  console.log('UGC reviewer documentation: PASS');
}

function main() {
  runReportContractChecks();
  runReportPipelineChecks();
  runMobileReportingChecks();
  runBlockingChecks();
  runFilteringAndSupportChecks();
  runReviewerDocsChecks();
  console.log('Mobile UGC store-safety smoke: PASS');
}

main();
