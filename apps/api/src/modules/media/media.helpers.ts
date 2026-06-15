import type { MediaAsset, MediaEntityType } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { enqueuePublicImageReviews } from '../moderation/moderation.mediaPipeline.js';

export type EntityWithId = { id: string };
export type PublicMediaAccess = {
  requiresAuth: boolean;
  hiddenCount: number;
  reason?: 'auth_required';
};
export type EntityWithMedia<T extends EntityWithId> = T & { media: MediaAsset[]; mediaAccess?: PublicMediaAccess };
export type MediaVisibility = 'owner' | 'public' | 'trade_public' | 'public_anonymous' | 'admin';

function createMediaRequestError(code: string, publicMessage: string, statusCode = 400) {
  return Object.assign(new Error(publicMessage), { code, publicMessage, statusCode });
}

export function shouldHidePublicMediaForAnonymous(visibility: MediaVisibility) {
  return visibility === 'public_anonymous' && env.publicMediaRequiresAuth;
}

function publicActiveStatusWhere() {
  return { status: 'active' as const };
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
      ? prisma.mediaAsset.findMany({ where: { id: { in: ids }, ownerId, status: { in: ['active', 'pending_review'] } } })
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
    await enqueuePublicImageReviews(ids, { actorId: ownerId });
    return;
  }

  await prisma.mediaAsset.updateMany({
    where: {
      id: { in: ids },
      ownerId,
      status: { in: ['active', 'pending_review'] },
      OR: [{ entityId: null }, { entityId }]
    },
    data: { entityType, entityId, sortOrder: 0, isCover: false }
  });
  await enqueuePublicImageReviews(ids, { actorId: ownerId });
}

export async function loadMediaByEntityIds(entityType: MediaEntityType, entityIds: string[], visibility: MediaVisibility = 'owner') {
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, MediaAsset[]>();
  if (shouldHidePublicMediaForAnonymous(visibility)) return new Map<string, MediaAsset[]>();

  const statusWhere = visibility === 'admin'
    ? {}
    : visibility === 'public' || visibility === 'trade_public' || visibility === 'public_anonymous'
      ? publicActiveStatusWhere()
      : { status: { not: 'removed' as const } };

  const media = await prisma.mediaAsset.findMany({
    where: { entityType, entityId: { in: ids }, ...statusWhere },
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
  // Public pages render only active media. Pending, flagged, and removed
  // images stay visible to owners/admins as moderation state, but are hidden
  // from public decks and details until reviewed. When PUBLIC_MEDIA_REQUIRES_AUTH
  // is enabled, anonymous public reads receive no image URLs at all.
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

export async function loadMediaAccessByEntityIds(entityType: MediaEntityType, entityIds: string[], visibility: MediaVisibility = 'owner') {
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  const byEntity = new Map<string, PublicMediaAccess>();
  if (ids.length === 0 || !shouldHidePublicMediaForAnonymous(visibility)) return byEntity;

  const grouped = await prisma.mediaAsset.groupBy({
    by: ['entityId'],
    where: { entityType, entityId: { in: ids }, ...publicActiveStatusWhere() },
    _count: { _all: true }
  });

  for (const item of grouped) {
    if (!item.entityId) continue;
    const hiddenCount = item._count._all;
    if (hiddenCount > 0) byEntity.set(item.entityId, { requiresAuth: true, hiddenCount, reason: 'auth_required' });
  }
  return byEntity;
}

export async function withMedia<T extends EntityWithId>(entityType: MediaEntityType, items: T[], visibility: MediaVisibility = 'owner'): Promise<Array<EntityWithMedia<T>>> {
  const ids = items.map((item) => item.id);
  const [mediaMap, accessMap] = await Promise.all([
    loadMediaByEntityIds(entityType, ids, visibility),
    loadMediaAccessByEntityIds(entityType, ids, visibility)
  ]);
  return items.map((item) => {
    const mediaAccess = accessMap.get(item.id);
    return { ...item, media: mediaMap.get(item.id) ?? [], ...(mediaAccess ? { mediaAccess } : {}) };
  });
}

export async function withOneMedia<T extends EntityWithId>(entityType: MediaEntityType, item: T, visibility: MediaVisibility = 'owner'): Promise<EntityWithMedia<T>> {
  const [result] = await withMedia(entityType, [item], visibility);
  return result ?? { ...item, media: [] };
}
