import sharp from 'sharp';
import type { MediaVariantKind, MediaVariantsDto } from '@hellowhen/contracts';
import type { MediaStorageProvider, StoredMediaImage } from './storage/mediaStorage.types.js';

export const mediaVariantKinds = ['thumb', 'card', 'full'] as const satisfies readonly MediaVariantKind[];

type GeneratedMediaVariant = {
  kind: Exclude<MediaVariantKind, 'full'>;
  buffer: Buffer;
  width?: number;
  height?: number;
};

type StoredVariantInput = {
  stored: StoredMediaImage;
  mimeType: string;
  width?: number;
  height?: number;
};

const generatedVariantSpecs: Array<{ kind: Exclude<MediaVariantKind, 'full'>; size: number; quality: number }> = [
  { kind: 'thumb', size: 320, quality: 76 },
  { kind: 'card', size: 960, quality: 82 },
];

function isMediaVariantKind(value: string): value is MediaVariantKind {
  return (mediaVariantKinds as readonly string[]).includes(value);
}

function normalizeVariantRecord(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url : '';
  const storageKey = typeof record.storageKey === 'string' ? record.storageKey : '';
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType : 'image/webp';
  const sizeBytes = Number.isInteger(record.sizeBytes) ? Number(record.sizeBytes) : 0;
  const width = Number.isInteger(record.width) ? Number(record.width) : undefined;
  const height = Number.isInteger(record.height) ? Number(record.height) : undefined;
  if (!url && !storageKey) return null;
  return {
    url,
    storageKey,
    mimeType,
    sizeBytes,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

export function normalizeMediaVariants(value: unknown): MediaVariantsDto | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const variants: MediaVariantsDto = {};
  for (const [key, candidate] of Object.entries(source)) {
    if (!isMediaVariantKind(key)) continue;
    const normalized = normalizeVariantRecord(candidate);
    if (normalized) variants[key] = normalized;
  }
  return Object.keys(variants).length ? variants : undefined;
}

export async function readImageDimensions(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer, { failOn: 'none', animated: false }).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch {
    return {};
  }
}

async function generateVariant(input: Buffer, size: number, quality: number) {
  return sharp(input, { failOn: 'none', animated: false })
    .rotate()
    .resize({ width: size, height: size, fit: 'cover', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });
}

export async function generateUploadVariants(input: Buffer): Promise<GeneratedMediaVariant[]> {
  const variants: GeneratedMediaVariant[] = [];
  for (const spec of generatedVariantSpecs) {
    try {
      const output = await generateVariant(input, spec.size, spec.quality);
      if (!output.data.length) continue;
      variants.push({
        kind: spec.kind,
        buffer: output.data,
        width: output.info.width,
        height: output.info.height,
      });
    } catch {
      // Variants are a feed-performance optimization. If a malformed-but-valid
      // image cannot be resized, keep the main upload path working and fall back
      // to the full image URL on clients.
    }
  }
  return variants;
}

function variantDto({ stored, mimeType, width, height }: StoredVariantInput) {
  return {
    url: stored.url,
    storageKey: stored.storageKey,
    mimeType,
    sizeBytes: stored.sizeBytes,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

export async function storeGeneratedMediaVariants({
  provider,
  filenameBase,
  full,
  fullMimeType,
  fullWidth,
  fullHeight,
  generated,
}: {
  provider: MediaStorageProvider;
  filenameBase: string;
  full: StoredMediaImage;
  fullMimeType: string;
  fullWidth?: number;
  fullHeight?: number;
  generated: GeneratedMediaVariant[];
}): Promise<MediaVariantsDto> {
  const variants: MediaVariantsDto = {
    full: variantDto({ stored: full, mimeType: fullMimeType, width: fullWidth, height: fullHeight }),
  };

  for (const variant of generated) {
    try {
      const stored = await provider.storeImage({
        buffer: variant.buffer,
        filenameBase: `${filenameBase}-${variant.kind}`,
        extension: '.webp',
        mimeType: 'image/webp',
      });
      variants[variant.kind] = variantDto({ stored, mimeType: 'image/webp', width: variant.width, height: variant.height });
    } catch {
      // Do not create a broken MediaAsset record just because an optional resized
      // derivative failed. The original/full image remains the safe fallback.
    }
  }

  return variants;
}
