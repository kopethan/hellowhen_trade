import type { MediaAssetDto, MediaVariantKind } from '@hellowhen/contracts';
import { API_URL } from '../../lib/api';

export function resolveMediaUrl(url?: string | null, storageKey?: string | null) {
  const raw = (url ?? storageKey ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';

  const normalized = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  const path = raw.startsWith('/')
    ? raw
    : normalized.startsWith('uploads/')
      ? `/${normalized}`
      : normalized.includes('/')
        ? `/${normalized}`
        : `/uploads/${normalized}`;

  return `${API_URL.replace(/\/$/, '')}${path}`;
}

export function resolveMediaVariantUrl(media?: MediaAssetDto | null, preferredVariant: MediaVariantKind = 'full') {
  if (!media) return '';
  const variant = media.variants?.[preferredVariant] ?? (preferredVariant !== 'full' ? media.variants?.full : undefined);
  if (variant) return resolveMediaUrl(variant.url, variant.storageKey);
  return resolveMediaUrl(media.url, media.storageKey);
}
