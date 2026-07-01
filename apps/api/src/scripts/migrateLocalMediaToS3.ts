import { promises as fsp } from 'node:fs';
import path from 'node:path';
import type { MediaAssetStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { generateUploadVariants, readImageDimensions, storeGeneratedMediaVariants } from '../modules/media/media.variants.js';
import { getLocalMediaStorageProvider } from '../modules/media/storage/mediaStorageProvider.js';
import { getMissingS3MediaStorageConfigValues, S3MediaStorageProvider } from '../modules/media/storage/s3MediaStorage.js';
import type { MediaStorageImageExtension } from '../modules/media/storage/mediaStorage.types.js';

type MediaMigrationArgs = {
  apply: boolean;
  batchSize: number;
  limit: number | null;
  status: MediaAssetStatus | null;
};

type MediaCandidate = {
  id: string;
  url: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: MediaAssetStatus;
};

const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const publicUploadNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/i;
const defaultBatchSize = 50;
const maxBatchSize = 250;
const supportedStatuses = new Set<MediaAssetStatus>(['active', 'pending_review', 'flagged']);

function printUsage() {
  console.log(`Usage:
  npm run media:s3-migrate
  npm run media:s3-migrate -- --apply
  npm run media:s3-migrate -- --limit=25 --batch-size=25

Options:
  --apply                 Upload local media to S3 and update MediaAsset rows.
  --dry-run               Explicit dry-run mode. This is the default.
  --limit=<count>         Stop after this many local media candidates.
  --batch-size=<count>    Prisma read batch size. Default: ${defaultBatchSize}, max: ${maxBatchSize}.
  --status=<status>       Optional status filter: active, pending_review, flagged.
  --help                  Show this help.

Dry-run mode does not upload to S3 and does not update the database.`);
}

function parsePositiveInt(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): MediaMigrationArgs {
  const args: MediaMigrationArgs = {
    apply: false,
    batchSize: defaultBatchSize,
    limit: null,
    status: null,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--apply') {
      args.apply = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.apply = false;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      args.limit = parsePositiveInt(arg.slice('--limit='.length), '--limit');
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      args.batchSize = Math.min(maxBatchSize, parsePositiveInt(arg.slice('--batch-size='.length), '--batch-size'));
      continue;
    }
    if (arg.startsWith('--status=')) {
      const status = arg.slice('--status='.length).trim() as MediaAssetStatus;
      if (!supportedStatuses.has(status)) {
        throw new Error('--status must be active, pending_review, or flagged. Removed media is intentionally not migrated.');
      }
      args.status = status;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return args;
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function normalizeLocalUploadName(value: string) {
  const candidate = path.basename(value.replace(/^\/+/, ''));
  return publicUploadNamePattern.test(candidate) ? candidate : '';
}

function extractLocalStorageKeyFromUrl(value: string) {
  const raw = value.trim();
  if (!raw || isHttpUrl(raw)) return '';
  const normalized = raw.replace(/^\/+/, '');
  if (!normalized.startsWith('uploads/')) return '';
  return normalizeLocalUploadName(normalized.slice('uploads/'.length));
}

function getLocalStorageKey(asset: Pick<MediaCandidate, 'storageKey' | 'url'>) {
  const storageKey = normalizeLocalUploadName(asset.storageKey);
  if (storageKey) return storageKey;
  return extractLocalStorageKeyFromUrl(asset.url);
}

function extensionForMedia(asset: Pick<MediaCandidate, 'mimeType' | 'storageKey' | 'url'>): MediaStorageImageExtension | null {
  if (asset.mimeType === 'image/jpeg') return '.jpg';
  if (asset.mimeType === 'image/png') return '.png';
  if (asset.mimeType === 'image/webp') return '.webp';

  const storageKey = getLocalStorageKey(asset);
  const ext = path.extname(storageKey).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return '.jpg';
  if (ext === '.png') return '.png';
  if (ext === '.webp') return '.webp';
  return null;
}

async function fileExists(filePath: string) {
  const stat = await fsp.stat(filePath).catch(() => null);
  return Boolean(stat?.isFile());
}

function createS3Config() {
  return {
    region: env.awsRegion,
    bucket: env.mediaS3Bucket,
    prefix: env.mediaS3Prefix,
    publicBaseUrl: env.mediaPublicBaseUrl,
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function migrateOne(asset: MediaCandidate, provider: S3MediaStorageProvider) {
  const localStorageKey = getLocalStorageKey(asset);
  if (!localStorageKey) return { status: 'skipped' as const, reason: 'not_local_storage_key' };

  const localFilePath = getLocalMediaStorageProvider().resolveLocalPath(localStorageKey);
  if (!localFilePath || !(await fileExists(localFilePath))) {
    return { status: 'skipped' as const, reason: 'local_file_missing', localStorageKey };
  }

  if (!supportedMimeTypes.has(asset.mimeType)) {
    return { status: 'skipped' as const, reason: 'unsupported_mime_type', localStorageKey };
  }

  const extension = extensionForMedia(asset);
  if (!extension) return { status: 'skipped' as const, reason: 'unsupported_extension', localStorageKey };

  const buffer = await fsp.readFile(localFilePath);
  const filenameBase = `migrated-${asset.id}`;
  const [dimensions, generatedVariants] = await Promise.all([
    readImageDimensions(buffer),
    generateUploadVariants(buffer),
  ]);

  const storedFull = await provider.storeImage({
    buffer,
    filenameBase,
    extension,
    mimeType: asset.mimeType,
  });

  const variantsJson = await storeGeneratedMediaVariants({
    provider,
    filenameBase,
    full: storedFull,
    fullMimeType: asset.mimeType,
    fullWidth: dimensions.width,
    fullHeight: dimensions.height,
    generated: generatedVariants,
  });

  const update = await prisma.mediaAsset.updateMany({
    where: {
      id: asset.id,
      url: asset.url,
      storageKey: asset.storageKey,
      status: asset.status,
    },
    data: {
      url: storedFull.url,
      storageKey: storedFull.storageKey,
      sizeBytes: storedFull.sizeBytes || asset.sizeBytes,
      variantsJson: variantsJson as Prisma.InputJsonValue,
    },
  });

  if (update.count !== 1) {
    return {
      status: 'skipped' as const,
      reason: 'db_row_changed_during_migration',
      localStorageKey,
      uploadedStorageKey: storedFull.storageKey,
    };
  }

  return {
    status: 'migrated' as const,
    localStorageKey,
    oldUrl: asset.url,
    oldStorageKey: asset.storageKey,
    newUrl: storedFull.url,
    newStorageKey: storedFull.storageKey,
    variantKinds: Object.keys(variantsJson),
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const s3Config = createS3Config();
  const missingConfig = getMissingS3MediaStorageConfigValues(s3Config);

  console.log(`[media:s3-migrate] mode=${args.apply ? 'apply' : 'dry-run'} batchSize=${args.batchSize} limit=${args.limit ?? 'none'} status=${args.status ?? 'not_removed'}`);

  if (missingConfig.length) {
    const message = `[media:s3-migrate] missing S3 config: ${missingConfig.join(', ')}`;
    if (args.apply) throw new Error(`${message}. Configure backend-only S3/CDN envs before running --apply.`);
    console.warn(`${message}. Dry-run will still inspect local media files.`);
  }

  const provider = args.apply ? new S3MediaStorageProvider(s3Config) : null;
  let cursor: string | undefined;
  let scanned = 0;
  let localCandidates = 0;
  let wouldMigrate = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  while (args.limit === null || localCandidates < args.limit) {
    const take = Math.min(args.batchSize, args.limit === null ? args.batchSize : Math.max(1, args.limit - localCandidates));
    const batch = await prisma.mediaAsset.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where: {
        ...(args.status ? { status: args.status } : { status: { not: 'removed' } }),
      },
      orderBy: { id: 'asc' },
      take,
      select: {
        id: true,
        url: true,
        storageKey: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
      },
    });

    if (!batch.length) break;
    cursor = batch[batch.length - 1]?.id;

    for (const asset of batch) {
      scanned += 1;
      if (args.limit !== null && localCandidates >= args.limit) break;
      if (isHttpUrl(asset.url)) continue;

      const localStorageKey = getLocalStorageKey(asset);
      if (!localStorageKey) continue;

      localCandidates += 1;
      const localFilePath = getLocalMediaStorageProvider().resolveLocalPath(localStorageKey);
      const exists = Boolean(localFilePath && await fileExists(localFilePath));

      if (!exists) {
        skipped += 1;
        console.warn(`[media:s3-migrate] skip id=${asset.id} reason=local_file_missing storageKey=${localStorageKey}`);
        continue;
      }

      if (!args.apply) {
        wouldMigrate += 1;
        console.log(`[media:s3-migrate] dry-run id=${asset.id} storageKey=${localStorageKey} file=${path.basename(localFilePath!)}`);
        continue;
      }

      try {
        const result = await migrateOne(asset, provider!);
        if (result.status === 'migrated') {
          migrated += 1;
          console.log(`[media:s3-migrate] migrated ${JSON.stringify(result)}`);
        } else {
          skipped += 1;
          console.warn(`[media:s3-migrate] skip id=${asset.id} ${JSON.stringify(result)}`);
        }
      } catch (error) {
        failed += 1;
        console.error(`[media:s3-migrate] failed id=${asset.id} error=${serializeError(error)}`);
      }
    }

    if (batch.length < take) break;
  }

  console.log(`[media:s3-migrate] summary scanned=${scanned} localCandidates=${localCandidates} wouldMigrate=${wouldMigrate} migrated=${migrated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error(`[media:s3-migrate] ${serializeError(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
