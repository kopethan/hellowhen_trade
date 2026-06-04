import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';

export type SelectedLocalImage = {
  uri: string;
  name: string;
  type: string;
  sizeBytes?: number;
};

type UploadResponse = { media: { id: string } };

type TFunction = (
  key: string,
  values?: Record<string, string | number | boolean | null | undefined>,
) => string;

export type SelectedImageUploadProgress = {
  uploaded: number;
  total: number;
  current: number;
  fileName: string;
};

export class SelectedImageUploadError extends Error {
  readonly current: number;
  readonly total: number;
  readonly fileName: string;
  readonly originalError: unknown;

  constructor({
    current,
    total,
    fileName,
    originalError,
  }: {
    current: number;
    total: number;
    fileName: string;
    originalError: unknown;
  }) {
    super(`Image upload failed (${current}/${total})`);
    this.name = 'SelectedImageUploadError';
    this.current = current;
    this.total = total;
    this.fileName = fileName;
    this.originalError = originalError;
  }
}

export async function uploadSelectedImages(
  images: SelectedLocalImage[],
  options: { onProgress?: (progress: SelectedImageUploadProgress) => void } = {},
) {
  const ids: string[] = [];
  const total = images.length;

  for (let index = 0; index < total; index += 1) {
    const image = images[index];
    if (!image) continue;
    const current = index + 1;
    options.onProgress?.({ uploaded: index, total, current, fileName: image.name });

    try {
      const formData = new FormData();
      formData.append('image', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
      const response = await api.media.uploadImage(formData) as UploadResponse;
      ids.push(response.media.id);
      options.onProgress?.({ uploaded: current, total, current, fileName: image.name });
    } catch (caughtError) {
      throw new SelectedImageUploadError({ current, total, fileName: image.name, originalError: caughtError });
    }
  }

  return ids;
}

export function getFriendlyUploadErrorMessage(error: unknown, t: TFunction) {
  if (error instanceof SelectedImageUploadError) {
    const reason = getFriendlyApiErrorMessage(error.originalError, t('media.errors.uploadFailed'));
    return t('media.errors.uploadFailedAt', { current: error.current, total: error.total, reason });
  }

  return getFriendlyApiErrorMessage(error, t('media.errors.uploadFailed'));
}

export function formatUploadProgress(progress: SelectedImageUploadProgress | null, t: TFunction) {
  if (!progress) return null;
  return t('media.states.uploadingImage', { current: progress.current, total: progress.total });
}
