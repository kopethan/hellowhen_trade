import { Router } from 'express';
import type { InventoryFolderItemType, Prisma } from '@prisma/client';
import { evaluatePlusGate } from '@hellowhen/shared';
import {
  addInventoryFolderItemRequestSchema,
  createInventoryFolderRequestSchema,
  listInventoryFoldersQuerySchema,
  updateInventoryFolderRequestSchema,
} from '@hellowhen/contracts';
import { asyncRoute } from '../lib/asyncRoute.js';
import { prisma } from '../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../middleware/auth.js';
import { requireInventoryFoldersEnabled } from '../middleware/featureGates.js';
import { plusConfigSnapshot } from './subscriptions/plus.routes.js';

export const inventoryFoldersRoutes = Router();
inventoryFoldersRoutes.use(requireAuth);
inventoryFoldersRoutes.use(requireInventoryFoldersEnabled());

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function buildFolderItemInclude(itemType?: InventoryFolderItemType) {
  return {
    where: { ...(itemType ? { itemType } : {}) },
    include: { need: true, offer: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  } satisfies Prisma.InventoryFolderItemFindManyArgs;
}

async function loadOwnedFolder(folderId: string, ownerId: string, includeItems = true, itemType?: InventoryFolderItemType) {
  if (!includeItems) {
    return prisma.inventoryFolder.findFirst({ where: { id: folderId, ownerId } });
  }

  return prisma.inventoryFolder.findFirst({
    where: { id: folderId, ownerId },
    include: { items: buildFolderItemInclude(itemType) },
  });
}

async function ensureOwnedInventoryItem(ownerId: string, itemType: InventoryFolderItemType, itemId: string) {
  if (itemType === 'need') {
    return prisma.need.findFirst({ where: { id: itemId, ownerId, businessProfileId: null }, select: { id: true } });
  }
  return prisma.offer.findFirst({ where: { id: itemId, ownerId, businessProfileId: null }, select: { id: true } });
}

function folderItemWhere(folderId: string, ownerId: string, itemType: InventoryFolderItemType, itemId: string): Prisma.InventoryFolderItemWhereInput {
  return itemType === 'need'
    ? { folderId, ownerId, itemType, needId: itemId }
    : { folderId, ownerId, itemType, offerId: itemId };
}

async function findFolderItem(folderId: string, ownerId: string, itemType: InventoryFolderItemType, itemId: string) {
  return prisma.inventoryFolderItem.findFirst({
    where: folderItemWhere(folderId, ownerId, itemType, itemId),
    include: { need: true, offer: true },
  });
}

function duplicateFolderPayload() {
  return {
    error: 'inventory_folder_title_exists',
    message: 'You already have a folder with this title.',
  };
}


async function requireInventoryFoldersPlus(ownerId: string, res: any) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  const gate = evaluatePlusGate(plusConfigSnapshot(), {
    subscriptionTier: user?.subscriptionTier ?? 'free',
    subscriptionStatus: user?.subscriptionStatus ?? 'none',
  } as any);
  if (gate.hasPlusAccess) return true;
  res.status(403).json({
    error: 'inventory_folders_plus_required',
    message: 'Need/Offer folders are a Plus feature.',
    upgradeRequired: true,
    feature: 'inventory_folders',
  });
  return false;
}

inventoryFoldersRoutes.get('/', asyncRoute(async (req, res) => {
  const input = listInventoryFoldersQuerySchema.parse(req.query);
  const baseQuery = {
    where: { ownerId: req.user!.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  } satisfies Prisma.InventoryFolderFindManyArgs;
  const folders = input.includeItems
    ? await prisma.inventoryFolder.findMany({ ...baseQuery, include: { items: buildFolderItemInclude(input.itemType) } })
    : await prisma.inventoryFolder.findMany(baseQuery);

  res.json({ folders });
}));

inventoryFoldersRoutes.post('/', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createInventoryFolderRequestSchema.parse(req.body);
  if (!(await requireInventoryFoldersPlus(req.user!.id, res))) return;
  try {
    const folder = await prisma.inventoryFolder.create({
      data: {
        ownerId: req.user!.id,
        title: input.title,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      include: { items: buildFolderItemInclude() },
    });
    res.status(201).json({ folder });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json(duplicateFolderPayload());
    throw error;
  }
}));

inventoryFoldersRoutes.patch('/:folderId', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateInventoryFolderRequestSchema.parse(req.body);
  if (!(await requireInventoryFoldersPlus(req.user!.id, res))) return;
  const { folderId } = req.params;
  if (!folderId) return res.status(400).json({ error: 'missing_folder_id' });

  const existing = await loadOwnedFolder(folderId, req.user!.id, false);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  try {
    const folder = await prisma.inventoryFolder.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      include: { items: buildFolderItemInclude() },
    });
    res.json({ folder });
  } catch (error) {
    if (isUniqueConstraintError(error)) return res.status(409).json(duplicateFolderPayload());
    throw error;
  }
}));

inventoryFoldersRoutes.delete('/:folderId', requireActiveAccount, asyncRoute(async (req, res) => {
  const { folderId } = req.params;
  if (!folderId) return res.status(400).json({ error: 'missing_folder_id' });
  if (!(await requireInventoryFoldersPlus(req.user!.id, res))) return;

  const existing = await loadOwnedFolder(folderId, req.user!.id, false);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  await prisma.inventoryFolder.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

inventoryFoldersRoutes.post('/:folderId/items', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = addInventoryFolderItemRequestSchema.parse(req.body);
  if (!(await requireInventoryFoldersPlus(req.user!.id, res))) return;
  const { folderId } = req.params;
  if (!folderId) return res.status(400).json({ error: 'missing_folder_id' });

  const folder = await loadOwnedFolder(folderId, req.user!.id, false);
  if (!folder) return res.status(404).json({ error: 'not_found' });

  const inventoryItem = await ensureOwnedInventoryItem(req.user!.id, input.itemType, input.itemId);
  if (!inventoryItem) return res.status(404).json({ error: 'inventory_item_not_found' });

  const existing = await findFolderItem(folder.id, req.user!.id, input.itemType, input.itemId);
  if (existing) return res.json({ item: existing });

  try {
    const item = await prisma.inventoryFolderItem.create({
      data: {
        folderId: folder.id,
        ownerId: req.user!.id,
        itemType: input.itemType,
        needId: input.itemType === 'need' ? input.itemId : null,
        offerId: input.itemType === 'offer' ? input.itemId : null,
        sortOrder: input.sortOrder ?? 0,
      },
      include: { need: true, offer: true },
    });
    res.status(201).json({ item });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const item = await findFolderItem(folder.id, req.user!.id, input.itemType, input.itemId);
    if (item) return res.json({ item });
    throw error;
  }
}));

inventoryFoldersRoutes.delete('/:folderId/items/:itemId', requireActiveAccount, asyncRoute(async (req, res) => {
  const { folderId, itemId } = req.params;
  if (!folderId) return res.status(400).json({ error: 'missing_folder_id' });
  if (!itemId) return res.status(400).json({ error: 'missing_folder_item_id' });
  if (!(await requireInventoryFoldersPlus(req.user!.id, res))) return;

  const existing = await prisma.inventoryFolderItem.findFirst({
    where: {
      id: itemId,
      folderId,
      ownerId: req.user!.id,
      folder: { ownerId: req.user!.id },
    },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  await prisma.inventoryFolderItem.delete({ where: { id: existing.id } });
  res.status(204).send();
}));
