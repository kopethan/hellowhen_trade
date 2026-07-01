import { env } from '../../../config/env.js';
import { LocalMediaStorageProvider } from './localMediaStorage.js';
import { getMissingS3MediaStorageConfigValues, S3MediaStorageProvider } from './s3MediaStorage.js';
import type { MediaStorageProvider } from './mediaStorage.types.js';

const localMediaStorageProvider = new LocalMediaStorageProvider(env.uploadDir);

let writeProvider: MediaStorageProvider | null = null;
let warnedAboutS3Fallback = false;

export function getLocalMediaStorageProvider() {
  return localMediaStorageProvider;
}

function getS3Config() {
  return {
    region: env.awsRegion,
    bucket: env.mediaS3Bucket,
    prefix: env.mediaS3Prefix,
    publicBaseUrl: env.mediaPublicBaseUrl
  };
}

function warnAboutS3Fallback(missing: string[]) {
  if (warnedAboutS3Fallback) return;
  warnedAboutS3Fallback = true;
  console.warn(`[media] MEDIA_STORAGE_DRIVER=s3 is set, but S3 media storage is missing configuration (${missing.join(', ')}). Falling back to local uploads.`);
}

export function getMediaStorageProvider() {
  if (writeProvider) return writeProvider;

  if (env.mediaStorageDriver === 's3') {
    const config = getS3Config();
    const missing = getMissingS3MediaStorageConfigValues(config);
    if (missing.length) {
      warnAboutS3Fallback(missing);
      writeProvider = localMediaStorageProvider;
      return writeProvider;
    }

    writeProvider = new S3MediaStorageProvider(config);
    return writeProvider;
  }

  writeProvider = localMediaStorageProvider;
  return writeProvider;
}
