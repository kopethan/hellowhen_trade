import { env } from '../../config/env.js';
import { getMediaStorageProvider } from './storage/mediaStorageProvider.js';
import { normalizeMediaVariants } from './media.variants.js';

export type MediaCleanupAsset = {
  id: string;
  url: string;
  storageKey: string;
  variantsJson?: unknown;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function keyFromPublicUrl(value: string, publicBaseUrl: string) {
  const normalizedBase = normalizeBaseUrl(publicBaseUrl);
  if (!normalizedBase) return '';

  try {
    const candidate = new URL(value);
    const base = new URL(normalizedBase);
    if (candidate.protocol !== base.protocol || candidate.host !== base.host) return '';

    const basePath = base.pathname.replace(/\/+$/, '');
    if (basePath && !candidate.pathname.startsWith(`${basePath}/`)) return '';

    const rawKey = basePath
      ? candidate.pathname.slice(basePath.length + 1)
      : candidate.pathname.replace(/^\/+/, '');
    return rawKey.split('/').map((part) => decodeURIComponent(part)).filter(Boolean).join('/');
  } catch {
    return '';
  }
}

function cleanupKeyFromCandidate(input: { url?: string; storageKey?: string }, publicBaseUrl: string) {
  if (input.url) {
    const key = keyFromPublicUrl(input.url, publicBaseUrl);
    if (key) return key;
  }
  return '';
}

export function collectS3CleanupStorageKeys(media: MediaCleanupAsset, publicBaseUrl = env.mediaPublicBaseUrl) {
  const keys = new Set<string>();
  const fullKey = cleanupKeyFromCandidate({ url: media.url, storageKey: media.storageKey }, publicBaseUrl);
  if (fullKey) keys.add(fullKey);

  const variants = normalizeMediaVariants(media.variantsJson);
  if (variants) {
    for (const variant of Object.values(variants)) {
      if (!variant) continue;
      const key = cleanupKeyFromCandidate(variant, publicBaseUrl);
      if (key) keys.add(key);
    }
  }

  return Array.from(keys);
}

export async function cleanupRemovedMediaStorage(media: MediaCleanupAsset, source: string) {
  const storageKeys = collectS3CleanupStorageKeys(media);
  if (!storageKeys.length) return { requested: 0, deleted: 0, skipped: 0 };

  const provider = getMediaStorageProvider();
  const result = await provider.deleteImages({ storageKeys });
  if (result.deleted > 0) {
    console.info(`[media] cleaned ${result.deleted}/${result.requested} object(s) for removed media ${media.id} from ${source}.`);
  }
  return result;
}

export async function cleanupRemovedMediaStorageBestEffort(media: MediaCleanupAsset, source: string) {
  try {
    return await cleanupRemovedMediaStorage(media, source);
  } catch (error) {
    console.warn(`[media] could not clean object storage for removed media ${media.id} from ${source}.`, error);
    return { requested: 0, deleted: 0, skipped: 0 };
  }
}
