import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function assert(condition, message) {
  if (!condition) {
    console.error(`media-s3-cleanup-smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

const cleanupSource = fs.readFileSync(path.join(repoRoot, 'apps/api/src/modules/media/media.cleanup.ts'), 'utf8');
const s3ProviderSource = fs.readFileSync(path.join(repoRoot, 'apps/api/src/modules/media/storage/s3MediaStorage.ts'), 'utf8');
const localProviderSource = fs.readFileSync(path.join(repoRoot, 'apps/api/src/modules/media/storage/localMediaStorage.ts'), 'utf8');
const mediaRoutesSource = fs.readFileSync(path.join(repoRoot, 'apps/api/src/modules/media/media.routes.ts'), 'utf8');
const profileRoutesSource = fs.readFileSync(path.join(repoRoot, 'apps/api/src/modules/profile/profile.routes.ts'), 'utf8');

assert(s3ProviderSource.includes('DeleteObjectsCommand'), 'S3 provider should use DeleteObjectsCommand for object cleanup');
assert(s3ProviderSource.includes('async deleteImages'), 'S3 provider should implement deleteImages');
assert(localProviderSource.includes('async deleteImages'), 'local provider should implement no-op deleteImages');
assert(cleanupSource.includes('collectS3CleanupStorageKeys'), 'cleanup helper should collect S3/CDN storage keys');
assert(cleanupSource.includes('MEDIA_PUBLIC_BASE_URL') || cleanupSource.includes('env.mediaPublicBaseUrl'), 'cleanup helper should scope cleanup to the configured public media base URL');
assert(mediaRoutesSource.includes('cleanupRemovedMediaStorageBestEffort(removed, \'media.delete\')'), 'owner media DELETE endpoint should run best-effort object cleanup');
assert(profileRoutesSource.includes('cleanupRemovedMediaStorageBestEffort(removedAvatar, \'profile.removeAvatar\')'), 'profile avatar removal should run best-effort object cleanup');
assert(!/^NEXT_PUBLIC_AWS_/m.test(fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8')), 'AWS envs must not be exposed with NEXT_PUBLIC_*');
assert(!/^EXPO_PUBLIC_AWS_/m.test(fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8')), 'AWS envs must not be exposed with EXPO_PUBLIC_*');

if (!process.exitCode) console.log('media-s3-cleanup-smoke passed');
