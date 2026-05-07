import type { MediaAsset, MediaEntityType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type EntityWithId = { id: string };
export type EntityWithMedia<T extends EntityWithId> = T & { media: MediaAsset[] };

export async function attachUploadedMediaToEntity(ownerId: string, mediaIds: string[] | undefined, entityType: MediaEntityType, entityId: string) {
  const ids = Array.from(new Set(mediaIds ?? [])).slice(0, 5);
  if (ids.length === 0) return;

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

export async function loadMediaByEntityIds(entityType: MediaEntityType, entityIds: string[]) {
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, MediaAsset[]>();
  const media = await prisma.mediaAsset.findMany({
    where: { entityType, entityId: { in: ids }, status: { not: 'removed' } },
    orderBy: { createdAt: 'asc' }
  });
  const byEntity = new Map<string, MediaAsset[]>();
  for (const item of media) {
    if (!item.entityId) continue;
    const current = byEntity.get(item.entityId) ?? [];
    current.push(item);
    byEntity.set(item.entityId, current);
  }
  return byEntity;
}

export async function withMedia<T extends EntityWithId>(entityType: MediaEntityType, items: T[]): Promise<Array<EntityWithMedia<T>>> {
  const map = await loadMediaByEntityIds(entityType, items.map((item) => item.id));
  return items.map((item) => ({ ...item, media: map.get(item.id) ?? [] }));
}

export async function withOneMedia<T extends EntityWithId>(entityType: MediaEntityType, item: T): Promise<EntityWithMedia<T>> {
  const [result] = await withMedia(entityType, [item]);
  return result ?? { ...item, media: [] };
}
