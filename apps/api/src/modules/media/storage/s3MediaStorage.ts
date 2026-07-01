import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { DeleteStoredMediaImagesInput, DeleteStoredMediaImagesResult, MediaStorageProvider, StoreMediaImageInput, StoredMediaImage } from './mediaStorage.types.js';

export type S3MediaStorageConfig = {
  region: string;
  bucket: string;
  prefix: string;
  publicBaseUrl: string;
};

const uploadedImageCacheControl = 'public, max-age=31536000, immutable';
const maxDeleteObjectsBatchSize = 1000;

function sanitizeKeySegment(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function normalizeFilenameBase(value: string) {
  return sanitizeKeySegment(value.replace(/\.[A-Za-z0-9]+$/, '')) || `${Date.now()}-upload`;
}

function normalizePrefix(value: string) {
  return value
    .split('/')
    .map((part) => sanitizeKeySegment(part))
    .filter(Boolean)
    .join('/');
}

function normalizePublicBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return trimmed;
  } catch {
    return '';
  }
}

function normalizeConfig(config: S3MediaStorageConfig): S3MediaStorageConfig {
  return {
    region: config.region.trim(),
    bucket: config.bucket.trim(),
    prefix: normalizePrefix(config.prefix),
    publicBaseUrl: normalizePublicBaseUrl(config.publicBaseUrl)
  };
}

export function getMissingS3MediaStorageConfigValues(config: S3MediaStorageConfig) {
  const normalized = normalizeConfig(config);
  const missing: string[] = [];
  if (!normalized.region) missing.push('AWS_REGION');
  if (!normalized.bucket) missing.push('MEDIA_S3_BUCKET');
  if (!normalized.publicBaseUrl) missing.push('MEDIA_PUBLIC_BASE_URL');
  return missing;
}

function createPublicUrl(publicBaseUrl: string, storageKey: string) {
  const encodedKey = storageKey.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${publicBaseUrl}/${encodedKey}`;
}

function createS3UploadError() {
  return Object.assign(new Error('Could not upload image to S3 media storage.'), {
    statusCode: 502,
    code: 'media_s3_upload_failed',
    publicMessage: 'Image upload failed. Try again in a moment.'
  });
}

export class S3MediaStorageProvider implements MediaStorageProvider {
  readonly driver = 's3' as const;

  private readonly client: S3Client;
  private readonly config: S3MediaStorageConfig;

  constructor(config: S3MediaStorageConfig) {
    const missing = getMissingS3MediaStorageConfigValues(config);
    if (missing.length) {
      throw Object.assign(new Error(`Missing S3 media storage configuration: ${missing.join(', ')}`), {
        statusCode: 500,
        code: 'media_s3_config_missing',
        publicMessage: 'Image storage is not configured correctly.'
      });
    }

    this.config = normalizeConfig(config);
    this.client = new S3Client({ region: this.config.region });
  }

  async storeImage(input: StoreMediaImageInput): Promise<StoredMediaImage> {
    const filename = `${normalizeFilenameBase(input.filenameBase)}${input.extension}`;
    const storageKey = this.config.prefix ? `${this.config.prefix}/${filename}` : filename;

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentLength: input.buffer.length,
        ContentType: input.mimeType,
        CacheControl: uploadedImageCacheControl
      }));
    } catch {
      throw createS3UploadError();
    }

    return {
      storageKey,
      url: createPublicUrl(this.config.publicBaseUrl, storageKey),
      sizeBytes: input.buffer.length
    };
  }

  async deleteImages(input: DeleteStoredMediaImagesInput): Promise<DeleteStoredMediaImagesResult> {
    const normalizedKeys = Array.from(new Set(input.storageKeys.map((key) => key.trim()).filter(Boolean)));
    if (!normalizedKeys.length) return { requested: 0, deleted: 0, skipped: 0 };

    let deleted = 0;
    for (let index = 0; index < normalizedKeys.length; index += maxDeleteObjectsBatchSize) {
      const batch = normalizedKeys.slice(index, index + maxDeleteObjectsBatchSize);
      await this.client.send(new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: {
          Quiet: true,
          Objects: batch.map((Key) => ({ Key })),
        },
      }));
      deleted += batch.length;
    }

    return { requested: normalizedKeys.length, deleted, skipped: 0 };
  }
}
