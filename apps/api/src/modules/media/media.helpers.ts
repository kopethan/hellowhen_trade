import type { MediaAsset, MediaEntityType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type EntityWithId = { id: string };
export type EntityWithMedia<T extends EntityWithId> = T & { media: MediaAsset[] };
export type MediaVisibility = 'owner' | 'public' | 'trade_public' | 'admin';

function createMediaRequestError(code: string, publicMessage: string, statusCode = 400) {
  return Object.assign(new Error(publicMessage), { code, publicMessage, statusCode });
}

export async function attachUploadedMediaToEntity(ownerId: string, mediaIds: string[] | undefined, entityType: MediaEntityType, entityId: string) {
  const ids = Array.from(new Set(mediaIds ?? []));
  if (ids.length === 0) return;
  if (ids.length > 5) {
    throw createMediaRequestError('too_many_images', 'You can attach up to 5 images. Remove one image before adding another.');
  }

  const [selectedMedia, existingEntityMedia] = await Promise.all([
    prisma.mediaAsset.findMany({ where: { id: { in: ids }, ownerId, status: { not: 'removed' } } }),
    prisma.mediaAsset.findMany({ where: { entityType, entityId, status: { not: 'removed' } }, select: { id: true } })
  ]);

  if (selectedMedia.length !== ids.length) {
    throw createMediaRequestError('invalid_media_ids', 'One or more selected images could not be attached. Upload the images again and retry.');
  }

  const alreadyAttachedElsewhere = selectedMedia.find((item) => item.entityType && item.entityId && (item.entityType !== entityType || item.entityId !== entityId));
  if (alreadyAttachedElsewhere) {
    throw createMediaRequestError('media_already_attached', 'One or more selected images already belong to another need or offer. Upload a new copy if you want to reuse it.');
  }

  const existingIds = new Set(existingEntityMedia.map((item) => item.id));
  const newIds = ids.filter((id) => !existingIds.has(id));
  if (existingEntityMedia.length + newIds.length > 5) {
    throw createMediaRequestError('too_many_images', 'You can attach up to 5 images. Remove one image before adding another.');
  }


  await prisma.mediaAsset.updateMany({
    where: {
      id: { in: ids },
      ownerId,
      status: { not: 'removed' },
      OR: [{ entityId: null }, { entityId }]
    },
    data: { entityType, entityId }
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
        ? { status: { in: ['active', 'pending_review'] as const } }
        : { status: { not: 'removed' as const } };

  const media = await prisma.mediaAsset.findMany({
    where: { entityType, entityId: { in: ids }, ...statusWhere },
    orderBy: { createdAt: 'asc' }
  });
  // Needs and Offers stay private inventory, but once they are attached to an
  // active public trade their images are part of the public trade content. We
  // expose non-removed/non-flagged pending media for that trade context only,
  // and normalize it to active in the public response so visitors do not see
  // internal review labels on normal trade image cards.
  const visibleMedia = visibility === 'trade_public'
    ? media.map((item) => item.status === 'pending_review' ? { ...item, status: 'active' as const } : item)
    : media;
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
