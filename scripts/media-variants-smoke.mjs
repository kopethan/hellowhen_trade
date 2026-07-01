function assert(condition, message) {
  if (!condition) {
    console.error(`media-variants-smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

const apiBase = 'https://api.hellowhen.example';
const fullUrl = 'https://media.hellowhen.example/uploads/original.jpg';
const cardUrl = 'https://media.hellowhen.example/uploads/original-card.webp';
const thumbStorageKey = 'original-thumb.webp';

const mediaWithVariants = {
  url: fullUrl,
  storageKey: 'uploads/original.jpg',
  variants: {
    full: { url: fullUrl, storageKey: 'uploads/original.jpg', mimeType: 'image/jpeg', sizeBytes: 123456, width: 1200, height: 900 },
    card: { url: cardUrl, storageKey: 'uploads/original-card.webp', mimeType: 'image/webp', sizeBytes: 45678, width: 960, height: 960 },
    thumb: { storageKey: thumbStorageKey, mimeType: 'image/webp', sizeBytes: 12000, width: 320, height: 320 },
  },
};

const mediaWithoutVariants = {
  url: '/uploads/local.jpg',
  storageKey: 'local.jpg',
};

function resolveAssetUrl(value, storageKey) {
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

function resolveVariantUrl(media, preferredVariant = 'full') {
  const variant = media?.variants?.[preferredVariant] ?? (preferredVariant !== 'full' ? media?.variants?.full : undefined);
  if (variant) return resolveAssetUrl(variant.url, variant.storageKey);
  return resolveAssetUrl(media?.url, media?.storageKey);
}

assert(resolveVariantUrl(mediaWithVariants, 'card') === cardUrl, 'card variant should be preferred when present');
assert(resolveVariantUrl(mediaWithVariants, 'thumb') === `${apiBase}/uploads/${thumbStorageKey}`, 'storageKey-only variants should resolve through the API upload path');
assert(resolveVariantUrl(mediaWithVariants, 'full') === fullUrl, 'full variant should resolve to the original public URL');
assert(resolveVariantUrl(mediaWithoutVariants, 'card') === `${apiBase}/uploads/local.jpg`, 'old media without variants should fall back to the existing media URL');
assert(resolveVariantUrl(null, 'card') === '', 'missing media should resolve to an empty URL');

if (!process.exitCode) console.log('media-variants-smoke passed');
