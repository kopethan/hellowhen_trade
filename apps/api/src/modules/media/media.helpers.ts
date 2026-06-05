import type { MediaAsset, MediaEntityType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type EntityWithId = { id: string };
export type EntityWithMedia<T extends EntityWithId> = T & { media: MediaAsset[] };
export type MediaVisibility = 'owner' | 'public' | 'trade_public' | 'admin';

function createMediaRequestError(code: string, publicMessage: string, statusCode = 400) {
  return Object.assign(new Error(publicMessage), { code, publicMessage, statusCode });
}

export type AttachMediaOptions = {
  coverMediaId?: string | null;
  enableOrderAndCover?: boolean;
  syncSelection?: boolean;
};

export async function attachUploadedMediaToEntity(
  ownerId: string,
  mediaIds: string[] | undefined,
  entityType: MediaEntityType,
  entityId: string,
  options: AttachMediaOptions = {},
) {
  if (mediaIds === undefined) return;

  const ids = Array.from(new Set(mediaIds));
  if (ids.length > 5) {
    throw createMediaRequestError('too_many_images', 'You can attach up to 5 images. Remove one image before adding another.');
  }

  const [selectedMedia, existingEntityMedia] = await Promise.all([
    ids.length
      ? prisma.mediaAsset.findMany({ where: { id: { in: ids }, ownerId, status: 'active' } })
      : Promise.resolve([]),
    prisma.mediaAsset.findMany({ where: { entityType, entityId, status: { not: 'removed' } }, select: { id: true } })
  ]);

  if (selectedMedia.length !== ids.length) {
    throw createMediaRequestError('invalid_media_ids', 'One or more selected images could not be attached. Upload the images again and retry.');
  }

  const alreadyAttachedElsewhere = selectedMedia.find((item) => item.entityType && item.entityId && (item.entityType !== entityType || item.entityId !== entityId));
  if (alreadyAttachedElsewhere) {
    throw createMediaRequestError('media_already_attached', 'One or more selected images already belong to another item. Upload a new copy if you want to reuse it.');
  }

  const existingIds = new Set(existingEntityMedia.map((item) => item.id));
  const newIds = ids.filter((id) => !existingIds.has(id));
  if (existingEntityMedia.length + newIds.length > 5) {
    throw createMediaRequestError('too_many_images', 'You can attach up to 5 images. Remove one image before adding another.');
  }

  if (options.syncSelection) {
    const removedIds = existingEntityMedia.map((item) => item.id).filter((id) => !ids.includes(id));
    if (removedIds.length) {
      await prisma.mediaAsset.updateMany({
        where: { id: { in: removedIds }, ownerId, entityType, entityId },
        data: { entityType: null, entityId: null, sortOrder: 0, isCover: false }
      });
    }
  }

  if (ids.length === 0) return;

  const coverMediaId = options.enableOrderAndCover && options.coverMediaId && ids.includes(options.coverMediaId)
    ? options.coverMediaId
    : ids[0] ?? null;

  if (options.enableOrderAndCover) {
    await prisma.$transaction(ids.map((id, index) => prisma.mediaAsset.update({
      where: { id },
      data: { entityType, entityId, sortOrder: index, isCover: coverMediaId === id }
    })));
    return;
  }

  await prisma.mediaAsset.updateMany({
    where: {
      id: { in: ids },
      ownerId,
      status: { not: 'removed' },
      OR: [{ entityId: null }, { entityId }]
    },
    data: { entityType, entityId, sortOrder: 0, isCover: false }
  });
}

export async function loadMediaByEntityIds(entityType: MediaEntityType, entityIds: string[], visibility: MediaVisibility = 'owner') {
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, MediaAsset[]>();
  const statusWhere = visibility === 'admin'
    ? {}
    : visibility === 'public'
      ? { status: 'active' as const }
      : visibility === 'trade_public'
        ? { status: 'active' as const }
        : { status: { not: 'removed' as const } };

  const media = await prisma.mediaAsset.findMany({
    where: { entityType, entityId: { in: ids }, ...statusWhere },
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
  // First beta policy: uploads are active immediately. Public trade pages only
  // render active media; flagged/removed media is hidden from public decks and
  // details, while owners and admins can still see moderation state.
  const visibleMedia = media;
  const byEntity = new Map<string, MediaAsset[]>();
  for (const item of visibleMedia) {
    if (!item.entityId) continue;
    const current = byEntity.get(item.entityId) ?? [];
    current.push(item);
    byEntity.set(item.entityId, current);
  }
  return byEntity;
}

export async function withMedia<T extends EntityWithId>(entityType: MediaEntityType, items: T[], visibility: MediaVisibility = 'owner'): Promise<Array<EntityWithMedia<T>>> {
  const map = await loadMediaByEntityIds(entityType, items.map((item) => item.id), visibility);
  return items.map((item) => ({ ...item, media: map.get(item.id) ?? [] }));
}

export async function withOneMedia<T extends EntityWithId>(entityType: MediaEntityType, item: T, visibility: MediaVisibility = 'owner'): Promise<EntityWithMedia<T>> {
  const [result] = await withMedia(entityType, [item], visibility);
  return result ?? { ...item, media: [] };
}
