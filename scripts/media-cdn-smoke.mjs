import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const apiBase = 'https://api.hellowhen.example';
const cdnUrl = 'https://media.hellowhen.example/uploads/2026/07/image.jpg';

function assert(condition, message) {
  if (!condition) {
    console.error(`media-cdn-smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

function resolveBrowserAssetUrl(value, storageKey) {
  const raw = String(value ?? storageKey ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  const normalized = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  const resolvedPath = raw.startsWith('/')
    ? raw
    : normalized.startsWith('uploads/')
      ? `/${normalized}`
      : normalized.includes('/')
        ? `/${normalized}`
        : `/uploads/${normalized}`;

  return `${apiBase}${resolvedPath}`;
}

function resolveNativeAssetUrl(value, storageKey) {
  const raw = String(value ?? storageKey ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';

  const normalized = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  const resolvedPath = raw.startsWith('/')
    ? raw
    : normalized.startsWith('uploads/')
      ? `/${normalized}`
      : normalized.includes('/')
        ? `/${normalized}`
        : `/uploads/${normalized}`;

  return `${apiBase}${resolvedPath}`;
}

assert(resolveBrowserAssetUrl(cdnUrl) === cdnUrl, 'web resolver should keep CloudFront HTTPS media URLs unchanged');
assert(resolveNativeAssetUrl(cdnUrl) === cdnUrl, 'native resolver should keep CloudFront HTTPS media URLs unchanged');
assert(resolveBrowserAssetUrl('/uploads/local.jpg') === `${apiBase}/uploads/local.jpg`, 'web resolver should keep existing local /uploads URLs API-relative');
assert(resolveNativeAssetUrl('/uploads/local.jpg') === `${apiBase}/uploads/local.jpg`, 'native resolver should keep existing local /uploads URLs API-relative');
assert(resolveBrowserAssetUrl(null, 'local.jpg') === `${apiBase}/uploads/local.jpg`, 'web resolver should map old local storage keys to /uploads');
assert(resolveNativeAssetUrl(null, 'local.jpg') === `${apiBase}/uploads/local.jpg`, 'native resolver should map old local storage keys to /uploads');
assert(resolveBrowserAssetUrl(null, 'uploads/local.jpg') === `${apiBase}/uploads/local.jpg`, 'web resolver should accept uploads-prefixed storage keys');
assert(resolveNativeAssetUrl(null, 'uploads/local.jpg') === `${apiBase}/uploads/local.jpg`, 'native resolver should accept uploads-prefixed storage keys');

const envExample = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
assert(!/^NEXT_PUBLIC_AWS_/m.test(envExample), '.env.example must not expose AWS envs with NEXT_PUBLIC_*');
assert(!/^EXPO_PUBLIC_AWS_/m.test(envExample), '.env.example must not expose AWS envs with EXPO_PUBLIC_*');
assert(envExample.includes('MEDIA_PUBLIC_BASE_URL='), '.env.example should include MEDIA_PUBLIC_BASE_URL for CDN/CloudFront URLs');

if (!process.exitCode) console.log('media-cdn-smoke passed');
