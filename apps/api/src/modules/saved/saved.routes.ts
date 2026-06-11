import { Router } from 'express';
import type { Prisma, SavedItemType } from '@prisma/client';
import { evaluatePlusGate } from '@hellowhen/shared';
import {
  SAVED_LIBRARY_FREE_COLLECTION_LIMIT,
  SAVED_LIBRARY_FREE_ITEM_LIMIT,
  addSavedCollectionItemRequestSchema,
  createSavedCollectionRequestSchema,
  createSavedItemRequestSchema,
  listSavedItemsQuerySchema,
  savedItemStatusQuerySchema,
  updateSavedCollectionRequestSchema,
} from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { publicTradeVisibilityWhere } from '../trades/trades.routes.js';
import { publicUserPreviewSelect } from '../users/publicUser.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { plusConfigSnapshot } from '../subscriptions/plus.routes.js';

export const savedRoutes = Router();
savedRoutes.use(requireAuth);

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

const userPreviewWithTrustSelect = { ...publicUserPreviewSelect, trustTier: true } as const;

const savedTradeInclude = {
  owner: { select: userPreviewWithTrustSelect },
  provider: { select: userPreviewWithTrustSelect },
  need: true,
  offer: true,
  payment: true,
  escrow: true,
  cashPromise: true,
} satisfies Prisma.TradeInclude;

const savedItemTargetInclude = {
  trade: { include: savedTradeInclude },
  need: { include: { owner: { select: { id: true, trustTier: true } } } },
  offer: { include: { owner: { select: { id: true, trustTier: true } } } },
  targetUser: { select: userPreviewWithTrustSelect },
} satisfies Prisma.SavedItemInclude;

const savedItemWithCollectionsInclude = {
  ...savedItemTargetInclude,
  collectionItems: {
    include: { collection: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.SavedItemInclude;

const savedCollectionInclude = {
  items: {
    include: { savedItem: { include: savedItemTargetInclude } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.SavedCollectionInclude;

async function blockedUserIdsFor(ownerId: string): Promise<Set<string>> {
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: ownerId }, { blockedId: ownerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(blocks.map((block: any) => (block.blockerId === ownerId ? block.blockedId : block.blockerId)));
}

function savedItemTargetWhere(ownerId: string, itemType: SavedItemType, itemId: string): Prisma.SavedItemWhereInput {
  switch (itemType) {
    case 'trade':
      return { ownerId, itemType, tradeId: itemId };
    case 'need':
      return { ownerId, itemType, needId: itemId };
    case 'offer':
      return { ownerId, itemType, offerId: itemId };
    case 'user':
      return { ownerId, itemType, targetUserId: itemId };
  }
}

function savedItemCreateData(ownerId: string, itemType: SavedItemType, itemId: string): Prisma.SavedItemUncheckedCreateInput {
  switch (itemType) {
    case 'trade':
      return { ownerId, itemType, tradeId: itemId };
    case 'need':
      return { ownerId, itemType, needId: itemId };
    case 'offer':
      return { ownerId, itemType, offerId: itemId };
    case 'user':
      return { ownerId, itemType, targetUserId: itemId };
  }
}


function savedItemSearchWhere(query?: string): Prisma.SavedItemWhereInput {
  const q = query?.trim();
  if (!q) return {};
  const contains = { contains: q, mode: 'insensitive' as const };
  return {
    OR: [
      { trade: { is: { OR: [{ title: contains }, { description: contains }] } } },
      { need: { is: { OR: [{ title: contains }, { description: contains }, { category: contains }, { locationLabel: contains }] } } },
      { offer: { is: { OR: [{ title: contains }, { description: contains }, { category: contains }, { locationLabel: contains }] } } },
      { targetUser: { is: { profile: { is: { OR: [{ displayName: contains }, { handle: contains }, { bio: contains }, { countryCode: contains }] } } } } },
    ],
  };
}

function stripTrustTierFromUserPreview(user: unknown) {
  if (!user || typeof user !== 'object') return user;
  const { trustTier: _trustTier, ...rest } = user as Record<string, unknown>;
  return rest;
}

function stripInventoryOwner(inventory: unknown) {
  if (!inventory || typeof inventory !== 'object') return inventory;
  const { owner: _owner, ...rest } = inventory as Record<string, unknown>;
  return rest;
}

function stripPrivateTargetFields(savedItem: unknown) {
  const item = savedItem as Record<string, unknown>;
  return {
    ...item,
    trade: item.trade && typeof item.trade === 'object'
      ? {
          ...(item.trade as Record<string, unknown>),
          owner: stripTrustTierFromUserPreview((item.trade as Record<string, unknown>).owner),
          provider: stripTrustTierFromUserPreview((item.trade as Record<string, unknown>).provider),
        }
      : item.trade,
    need: stripInventoryOwner(item.need),
    offer: stripInventoryOwner(item.offer),
    targetUser: stripTrustTierFromUserPreview(item.targetUser),
  };
}

function savedItemIsVisible(savedItem: any, blockedUserIds: Set<string>) {
  switch (savedItem.itemType as SavedItemType) {
    case 'trade': {
      const trade = savedItem.trade;
      if (!trade) return false;
      if (blockedUserIds.has(trade.ownerId) || (trade.providerId && blockedUserIds.has(trade.providerId))) return false;
      if (trade.owner?.trustTier === 'restricted' || trade.provider?.trustTier === 'restricted') return false;
      return true;
    }
    case 'need': {
      const need = savedItem.need;
      if (!need) return false;
      if (blockedUserIds.has(need.ownerId)) return false;
      return need.owner?.trustTier !== 'restricted';
    }
    case 'offer': {
      const offer = savedItem.offer;
      if (!offer) return false;
      if (blockedUserIds.has(offer.ownerId)) return false;
      return offer.owner?.trustTier !== 'restricted';
    }
    case 'user': {
      const targetUser = savedItem.targetUser;
      if (!targetUser || !savedItem.targetUserId) return false;
      if (blockedUserIds.has(savedItem.targetUserId)) return false;
      return targetUser.trustTier !== 'restricted';
    }
  }
}

function toSavedItemDto(savedItem: any) {
  const { collectionItems = [], ...item } = savedItem;
  return {
    ...stripPrivateTargetFields(item),
    collections: collectionItems.map((collectionItem: any) => collectionItem.collection),
  };
}

function toSavedCollectionItemDto(collectionItem: any) {
  return {
    ...collectionItem,
    savedItem: collectionItem.savedItem ? stripPrivateTargetFields(collectionItem.savedItem) : collectionItem.savedItem,
  };
}

function toSavedCollectionDto(collection: any, blockedUserIds: Set<string>) {
  const { items = [], ...summary } = collection;
  return {
    ...summary,
    items: items.filter((item: any) => savedItemIsVisible(item.savedItem, blockedUserIds)).map(toSavedCollectionItemDto),
  };
}

async function loadOwnedCollection(collectionId: string, ownerId: string, includeItems = false) {
  return prisma.savedCollection.findFirst({
    where: { id: collectionId, ownerId },
    ...(includeItems ? { include: savedCollectionInclude } : {}),
  });
}

async function loadSavedItem(savedItemId: string, ownerId: string) {
  return prisma.savedItem.findFirst({ where: { id: savedItemId, ownerId }, include: savedItemWithCollectionsInclude });
}

async function ensureSavableTarget(ownerId: string, itemType: SavedItemType, itemId: string) {
  switch (itemType) {
    case 'trade': {
      const trade = await prisma.trade.findFirst({ where: { id: itemId, ...publicTradeVisibilityWhere() }, select: { id: true, ownerId: true, providerId: true } });
      if (!trade) return false;
      return !(await usersHaveBlockBetween(ownerId, trade.ownerId)) && !(await usersHaveBlockBetween(ownerId, trade.providerId));
    }
    case 'need': {
      const need = await prisma.need.findFirst({
        where: { id: itemId, status: 'active', owner: { trustTier: { not: 'restricted' } } },
        select: { id: true, ownerId: true },
      });
      if (!need) return false;
      return !(await usersHaveBlockBetween(ownerId, need.ownerId));
    }
    case 'offer': {
      const offer = await prisma.offer.findFirst({
        where: { id: itemId, status: 'active', owner: { trustTier: { not: 'restricted' } } },
        select: { id: true, ownerId: true },
      });
      if (!offer) return false;
      return !(await usersHaveBlockBetween(ownerId, offer.ownerId));
    }
    case 'user': {
      if (itemId === ownerId) return false;
      const user = await prisma.user.findUnique({ where: { id: itemId }, select: { id: true, trustTier: true } });
      if (!user || user.trustTier === 'restricted') return false;
      return !(await usersHaveBlockBetween(ownerId, user.id));
    }
  }
}

async function addSavedItemToCollection(ownerId: string, collectionId: string, savedItemId: string, sortOrder = 0) {
  const collection = await loadOwnedCollection(collectionId, ownerId, false);
  if (!collection) return null;
  const existing = await prisma.savedCollectionItem.findFirst({ where: { collectionId: collection.id, savedItemId, ownerId } });
  if (existing) return existing;
  try {
    return await prisma.savedCollectionItem.create({ data: { collectionId: collection.id, savedItemId, ownerId, sortOrder } });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return prisma.savedCollectionItem.findFirst({ where: { collectionId: collection.id, savedItemId, ownerId } });
  }
}

function duplicateCollectionPayload() {
  return {
    error: 'saved_collection_title_exists',
    message: 'You already have a saved collection with this title.',
  };
}

async function getSavedLibraryGate(ownerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  return evaluatePlusGate(plusConfigSnapshot(), {
    subscriptionTier: user?.subscriptionTier ?? 'free',
    subscriptionStatus: user?.subscriptionStatus ?? 'none',
  } as any);
}

async function requireSavedCollectionsPlus(ownerId: string, res: any) {
  const gate = await getSavedLibraryGate(ownerId);
  if (gate.hasPlusAccess) return true;
  res.status(403).json({
    error: 'saved_collections_plus_required',
    message: 'Custom saved collections are a Plus feature. You can still keep up to 10 saved items in your default saved list.',
    upgradeRequired: true,
    feature: 'saved_collections',
    freeLimit: SAVED_LIBRARY_FREE_COLLECTION_LIMIT,
  });
  return false;
}

async function enforceSavedItemFreeLimit(ownerId: string, res: any) {
  const gate = await getSavedLibraryGate(ownerId);
  if (gate.hasPlusAccess) return true;
  const savedCount = await prisma.savedItem.count({ where: { ownerId } });
  if (savedCount < SAVED_LIBRARY_FREE_ITEM_LIMIT) return true;
  res.status(403).json({
    error: 'saved_library_limit_reached',
    message: `Free accounts can keep up to ${SAVED_LIBRARY_FREE_ITEM_LIMIT} saved items. Upgrade to Plus for unlimited saved items and custom collections.`,
    upgradeRequired: true,
    feature: 'saved_library',
    freeLimit: SAVED_LIBRARY_FREE_ITEM_LIMIT,
    savedCount,
  });
  return false;
}

savedRoutes.get('/status', asyncRoute(async (req, res) => {
  const input = savedItemStatusQuerySchema.parse(req.query);
  const blockedUserIds = await blockedUserIdsFor(req.user!.id);
  const item = await prisma.savedItem.findFirst({
    where: savedItemTargetWhere(req.user!.id, input.itemType, input.itemId),
    include: savedItemWithCollectionsInclude,
  });
  const isVisible = item ? savedItemIsVisible(item, blockedUserIds) : false;

  res.json({
    itemType: input.itemType,
    itemId: input.itemId,
    isSaved: Boolean(item && isVisible),
    savedItem: item && isVisible ? toSavedItemDto(item) : null,
  });
}));

savedRoutes.get('/collections', asyncRoute(async (req, res) => {
  const [collections, blockedUserIds] = await Promise.all([
    prisma.savedCollection.findMany({
      where: { ownerId: req.user!.id },
      include: savedCollectionInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    blockedUserIdsFor(req.user!.id),
  ]);
  res.json({ collections: collections.map((collection: any) => toSavedCollectionDto(collection, blockedUserIds)) });
}));

savedRoutes.post('/collections', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createSavedCollectionRequestSchema.parse(req.body);
  if (!(await requireSavedCollectionsPlus(req.user!.id, res))) return;
  try {
    const collection = await prisma.savedCollection.create({
      data: {
        ownerId: req.user!.id,
        title: input.title,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      include: savedCollectionInclude,
    });
    res.status(201).json({ collection: toSavedCollectionDto(collection, new Set<string>()) });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json(duplicateCollectionPayload());
    throw error;
  }
}));

savedRoutes.patch('/collections/:collectionId', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateSavedCollectionRequestSchema.parse(req.body);
  const { collectionId } = req.params;
  if (!collectionId) return res.status(400).json({ error: 'missing_collection_id' });

  const existing = await loadOwnedCollection(collectionId, req.user!.id, false);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (!(await requireSavedCollectionsPlus(req.user!.id, res))) return;

  try {
    const collection = await prisma.savedCollection.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      include: savedCollectionInclude,
    });
    const blockedUserIds = await blockedUserIdsFor(req.user!.id);
    res.json({ collection: toSavedCollectionDto(collection, blockedUserIds) });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json(duplicateCollectionPayload());
    throw error;
  }
}));

savedRoutes.delete('/collections/:collectionId', requireActiveAccount, asyncRoute(async (req, res) => {
  const { collectionId } = req.params;
  if (!collectionId) return res.status(400).json({ error: 'missing_collection_id' });

  const existing = await loadOwnedCollection(collectionId, req.user!.id, false);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  await prisma.savedCollection.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

savedRoutes.post('/collections/:collectionId/items', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = addSavedCollectionItemRequestSchema.parse(req.body);
  const { collectionId } = req.params;
  if (!collectionId) return res.status(400).json({ error: 'missing_collection_id' });

  const collection = await loadOwnedCollection(collectionId, req.user!.id, false);
  if (!collection) return res.status(404).json({ error: 'not_found' });
  if (!(await requireSavedCollectionsPlus(req.user!.id, res))) return;
  const savedItem = await loadSavedItem(input.savedItemId, req.user!.id);
  if (!savedItem) return res.status(404).json({ error: 'saved_item_not_found' });

  const blockedUserIds = await blockedUserIdsFor(req.user!.id);
  if (!savedItemIsVisible(savedItem, blockedUserIds)) return res.status(404).json({ error: 'saved_item_not_found' });

  await addSavedItemToCollection(req.user!.id, collection.id, savedItem.id, input.sortOrder ?? 0);
  const item = await prisma.savedCollectionItem.findFirst({
    where: { collectionId: collection.id, savedItemId: savedItem.id, ownerId: req.user!.id },
    include: { savedItem: { include: savedItemTargetInclude } },
  });
  if (!item) throw new Error('saved_collection_item_create_failed');
  res.status(201).json({ item: toSavedCollectionItemDto(item) });
}));

savedRoutes.delete('/collections/:collectionId/items/:savedItemId', requireActiveAccount, asyncRoute(async (req, res) => {
  const { collectionId, savedItemId } = req.params;
  if (!collectionId) return res.status(400).json({ error: 'missing_collection_id' });
  if (!savedItemId) return res.status(400).json({ error: 'missing_saved_item_id' });

  const existing = await prisma.savedCollectionItem.findFirst({
    where: {
      collectionId,
      savedItemId,
      ownerId: req.user!.id,
      collection: { ownerId: req.user!.id },
      savedItem: { ownerId: req.user!.id },
    },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  await prisma.savedCollectionItem.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

savedRoutes.get('/', asyncRoute(async (req, res) => {
  const input = listSavedItemsQuerySchema.parse(req.query);
  const requestedTake = input.take ?? 50;
  const sortDirection = input.sort === 'oldest' ? 'asc' : 'desc';
  const [items, blockedUserIds] = await Promise.all([
    prisma.savedItem.findMany({
      where: {
        ownerId: req.user!.id,
        ...(input.itemType ? { itemType: input.itemType } : {}),
        ...(input.collectionId ? { collectionItems: { some: { collectionId: input.collectionId, ownerId: req.user!.id } } } : {}),
        ...savedItemSearchWhere(input.q),
      },
      include: savedItemWithCollectionsInclude,
      orderBy: [{ createdAt: sortDirection }, { id: sortDirection }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: Math.min(200, requestedTake * 3 + 1),
    }),
    blockedUserIdsFor(req.user!.id),
  ]);
  const visibleItems = items.filter((item: any) => savedItemIsVisible(item, blockedUserIds)).slice(0, requestedTake + 1);
  const pageItems = visibleItems.slice(0, requestedTake);
  const nextCursor = visibleItems.length > requestedTake ? visibleItems[requestedTake]?.id ?? null : null;
  res.json({ items: pageItems.map(toSavedItemDto), nextCursor });
}));

savedRoutes.post('/', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createSavedItemRequestSchema.parse(req.body);
  const targetIsSavable = await ensureSavableTarget(req.user!.id, input.itemType, input.itemId);
  if (!targetIsSavable) return res.status(404).json({ error: 'saved_target_not_found' });

  if (input.collectionId) {
    const collection = await loadOwnedCollection(input.collectionId, req.user!.id, false);
    if (!collection) return res.status(404).json({ error: 'collection_not_found' });
    if (!(await requireSavedCollectionsPlus(req.user!.id, res))) return;
  }

  let item = await prisma.savedItem.findFirst({ where: savedItemTargetWhere(req.user!.id, input.itemType, input.itemId), include: savedItemWithCollectionsInclude });
  let created = false;

  if (!item) {
    if (!(await enforceSavedItemFreeLimit(req.user!.id, res))) return;
    try {
      item = await prisma.savedItem.create({
        data: savedItemCreateData(req.user!.id, input.itemType, input.itemId),
        include: savedItemWithCollectionsInclude,
      });
      created = true;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      item = await prisma.savedItem.findFirst({ where: savedItemTargetWhere(req.user!.id, input.itemType, input.itemId), include: savedItemWithCollectionsInclude });
    }
  }

  if (!item) throw new Error('saved_item_create_failed');

  if (input.collectionId) {
    await addSavedItemToCollection(req.user!.id, input.collectionId, item.id);
    item = await loadSavedItem(item.id, req.user!.id);
  }

  res.status(created ? 201 : 200).json({ item: toSavedItemDto(item) });
}));

savedRoutes.delete('/:savedItemId', requireActiveAccount, asyncRoute(async (req, res) => {
  const existing = await prisma.savedItem.findFirst({ where: { id: req.params.savedItemId, ownerId: req.user!.id }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  await prisma.savedItem.delete({ where: { id: existing.id } });
  res.status(204).send();
}));
