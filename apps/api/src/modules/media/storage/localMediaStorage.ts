import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import type { DeleteStoredMediaImagesInput, DeleteStoredMediaImagesResult, MediaStorageProvider, StoreMediaImageInput, StoredMediaImage } from './mediaStorage.types.js';

const localUploadNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/i;

function normalizeFilenameBase(value: string) {
  const safeBase = path.basename(value, path.extname(value)).replace(/[^A-Za-z0-9._-]/g, '-');
  return safeBase || `${Date.now()}-upload`;
}

export class LocalMediaStorageProvider implements MediaStorageProvider {
  readonly driver = 'local' as const;

  constructor(private readonly uploadDir: string) {
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async storeImage(input: StoreMediaImageInput): Promise<StoredMediaImage> {
    const storageKey = `${normalizeFilenameBase(input.filenameBase)}${input.extension}`;
    const filePath = this.resolveLocalPath(storageKey);
    if (!filePath) {
      throw Object.assign(new Error('Invalid local media storage key.'), {
        statusCode: 400,
        code: 'invalid_media_storage_key',
        publicMessage: 'Image upload failed. Try uploading the image again.'
      });
    }

    await fsp.writeFile(filePath, input.buffer);
    return {
      storageKey,
      url: `/uploads/${storageKey}`,
      sizeBytes: input.buffer.length
    };
  }

  async deleteImages(input: DeleteStoredMediaImagesInput): Promise<DeleteStoredMediaImagesResult> {
    const storageKeys = Array.from(new Set(input.storageKeys.map((key) => key.trim()).filter(Boolean)));
    let deleted = 0;
    let skipped = 0;
    for (const storageKey of storageKeys) {
      const filePath = this.resolveLocalPath(storageKey);
      if (!filePath) {
        skipped += 1;
        continue;
      }
      try {
        await fsp.unlink(filePath);
        deleted += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          deleted += 1;
          continue;
        }
        throw error;
      }
    }
    return { requested: storageKeys.length, deleted, skipped };
  }

  resolveLocalPath(storageKey: string) {
    if (!storageKey || !localUploadNamePattern.test(storageKey)) return null;
    const uploadRoot = path.resolve(this.uploadDir);
    const filePath = path.resolve(uploadRoot, storageKey);
    if (filePath !== path.join(uploadRoot, path.basename(storageKey))) return null;
    if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) return null;
    return filePath;
  }
}
