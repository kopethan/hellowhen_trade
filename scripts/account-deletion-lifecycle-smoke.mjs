import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}
function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`${label}: missing ${JSON.stringify(expected)}`);
}

const schema = read('apps/api/prisma/schema.prisma');
const migration = read('apps/api/prisma/migrations/20260909083000_account_deletion_automatic_lifecycle/migration.sql');
const lifecycle = read('apps/api/src/modules/account/accountDeletion.lifecycle.ts');
const routes = read('apps/api/src/modules/account/account.routes.ts');
const server = read('apps/api/src/server.ts');
const mobile = read('apps/mobile/src/features/account/AccountDeletionScreen.tsx');
const web = read('apps/web/src/features/account/AccountDeletionClient.tsx');
const en = read('packages/i18n/src/locales/en/account.ts');

assertIncludes(schema, 'scheduledFor    DateTime', 'Deletion schedule schema');
assertIncludes(schema, 'user User? @relation(fields: [userId], references: [id], onDelete: SetNull)', 'Deletion receipt retention');
assertIncludes(migration, "INTERVAL '30 days'", 'Existing request grace-period migration');
assertIncludes(lifecycle, 'ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30', '30-day lifecycle constant');
assertIncludes(lifecycle, "data: { status: 'processing', reviewedAt: now }", 'Atomic processing claim');
assertIncludes(lifecycle, "await cleanupOwnedMedia(userId)", 'Owned media cleanup');
assertIncludes(lifecycle, 'await tx.user.delete({ where: { id: userId } })', 'Final account deletion');
assertIncludes(lifecycle, 'await transferOwnedBusinesses(tx, userId)', 'Business workspace ownership safety');
assertIncludes(routes, 'accountDeletionScheduledFor(requestedAt)', 'Deletion request scheduling');
assertIncludes(routes, "error: 'deletion_processing'", 'Grace-period cancellation boundary');
assertIncludes(server, 'startAccountDeletionLifecycle()', 'Automatic lifecycle startup');
assertIncludes(mobile, "request?.scheduledFor", 'Native scheduled date visibility');
assertIncludes(web, "request?.scheduledFor", 'Web scheduled date visibility');
assertIncludes(en, 'automatic deletion 30 days after the request', 'User-facing automatic deletion copy');

console.log('Account deletion 30-day lifecycle: PASS');
