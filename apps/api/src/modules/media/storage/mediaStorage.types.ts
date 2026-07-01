export type MediaStorageDriver = 'local' | 's3';

export type MediaStorageImageExtension = '.jpg' | '.png' | '.webp';

export type StoreMediaImageInput = {
  buffer: Buffer;
  filenameBase: string;
  extension: MediaStorageImageExtension;
  mimeType: string;
};

export type StoredMediaImage = {
  storageKey: string;
  url: string;
  sizeBytes: number;
};

export type DeleteStoredMediaImagesInput = {
  storageKeys: string[];
};

export type DeleteStoredMediaImagesResult = {
  requested: number;
  deleted: number;
  skipped: number;
};

export interface MediaStorageProvider {
  readonly driver: MediaStorageDriver;
  storeImage(input: StoreMediaImageInput): Promise<StoredMediaImage>;
  deleteImages(input: DeleteStoredMediaImagesInput): Promise<DeleteStoredMediaImagesResult>;
}
