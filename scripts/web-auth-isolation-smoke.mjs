#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n?/g, '\n');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(file, needle, message = `${file} must contain ${needle}`) {
  assert(read(file).includes(needle), message);
}

function assertNotContains(file, needle, message = `${file} must not contain ${needle}`) {
  assert(!read(file).includes(needle), message);
}

function runStorageIsolationChecks() {
  const helper = 'apps/web/src/lib/webUserSessionStorage.ts';
  const plan = 'apps/web/src/features/plans/PlanCreateClient.tsx';
  const proposal = 'apps/web/src/features/trade/ProposalConversationClient.tsx';

  assertContains(helper, "const USER_SESSION_STORAGE_PREFIX = 'hellowhen:web:user-session';");
  assertContains(helper, 'encodeURIComponent(userId)', 'User-scoped session keys must safely encode the authenticated user id.');
  assertContains(helper, 'clearLegacyUnscopedWebUserSessionStorage', 'Legacy unscoped drafts must be explicitly discarded.');
  assertContains(helper, "'hellowhen.planCreateDraft.v1'", 'The old unscoped Plan draft key must be treated as unsafe legacy state.');
  assertContains(helper, "'proposal-edit-draft:'", 'The old unscoped proposal draft prefix must be treated as unsafe legacy state.');

  assertContains(plan, "buildWebUserSessionStorageKey(authenticatedUserId, PLAN_CREATE_DRAFT_SCOPE)", 'Plan drafts must be scoped to the authenticated user.');
  assertContains(plan, 'draftHydratedUserId !== authenticatedUserId', 'Plan draft persistence must wait until the correct user draft has been hydrated.');
  assertContains(plan, 'reusablePlacesLoadVersionRef.current', 'Account transitions must invalidate stale My Places/Plans responses.');
  assertNotContains(plan, "window.sessionStorage.getItem('hellowhen.planCreateDraft.v1')", 'Plan Create must not read the old shared draft key directly.');

  assertContains(proposal, 'buildWebUserSessionStorageKey(userId, "proposal-edit-draft", proposalId)', 'Proposal edit drafts must include both user and proposal identity.');
  assertContains(proposal, 'readProposalEditDraft(auth.user?.id, proposalId)', 'Proposal draft restore must use the current authenticated user.');
  assertContains(proposal, 'writeProposalEditDraft(auth.user?.id, proposalId', 'Proposal draft writes must use the current authenticated user.');

  console.log('Web user-scoped transient storage: PASS');
}

function runLogoutChecks() {
  const authFile = 'apps/web/src/providers/WebAuthProvider.tsx';
  const auth = read(authFile);
  const logoutStart = auth.indexOf('async logout() {');
  const logoutEnd = auth.indexOf('async logoutAll() {', logoutStart);
  assert(logoutStart >= 0 && logoutEnd > logoutStart, 'WebAuthProvider logout methods are missing.');
  const logoutBody = auth.slice(logoutStart, logoutEnd);

  const captureRefresh = logoutBody.indexOf('const refreshToken = getRefreshToken();');
  const clearSession = logoutBody.indexOf('clearWebUserSessionStorage(currentUserId);');
  const clearTokens = logoutBody.indexOf('clearAuthTokens();');
  const clearUser = logoutBody.indexOf('setUser(null);');
  const revokeServer = logoutBody.indexOf('api.auth.logout({ refreshToken })');
  assert(captureRefresh >= 0, 'Logout must capture the refresh token before local clearing.');
  assert(clearSession > captureRefresh, 'Logout must clear the departing user session state after capturing the refresh token.');
  assert(clearTokens > clearSession && clearUser > clearTokens, 'Logout must clear local authentication before server revocation.');
  assert(revokeServer > clearUser, 'Normal logout must perform best-effort server revocation only after local logout is complete.');

  assertContains(authFile, 'if (previousUser?.id && previousUser.id !== result.user.id) clearWebUserSessionStorage(previousUser.id);', 'Direct account transitions must clear the previous user session state.');
  assertContains(authFile, 'if (mounted) clearAuthenticatedState();', 'Invalidated server sessions must clear local authenticated state.');
  assertContains(authFile, 'clearLegacyUnscopedWebUserSessionStorage();', 'Auth hydration must discard legacy unowned session drafts.');

  console.log('Web logout/session invalidation ordering: PASS');
}

runStorageIsolationChecks();
runLogoutChecks();
console.log('WEB-PARITY6 auth isolation smoke: PASS');
