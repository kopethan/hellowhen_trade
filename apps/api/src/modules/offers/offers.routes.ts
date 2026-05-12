import { Router } from 'express';
import { createOfferRequestSchema, updateOfferRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, withMedia, withOneMedia } from '../media/media.helpers.js';

export const offersRoutes = Router();
offersRoutes.use(requireAuth);

const activeLinkedTradeStatuses = ['active', 'funded', 'in_progress', 'submitted', 'disputed'] as const;

function activeLinkedTradeWhere(offerId: string) {
  return { offerId, status: { in: [...activeLinkedTradeStatuses] } };
}

async function loadActiveLinkedTrades(offerId: string) {
  const [activeTradeCount, activeTrades] = await Promise.all([
    prisma.trade.count({ where: activeLinkedTradeWhere(offerId) }),
    prisma.trade.findMany({
      where: activeLinkedTradeWhere(offerId),
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 3
    })
  ]);
  return { activeTradeCount, activeTrades };
}

function linkedOfferBlockedPayload(activeTradeCount: number, activeTrades: Array<{ id: string; title: string; status: string }>, action: 'edit' | 'delete') {
  return {
    error: 'offer_in_active_trade',
    message: `This offer is used by an active trade. Close or delete that trade before ${action === 'edit' ? 'editing' : 'deleting'} this offer.`,
    activeTradeCount,
    activeTrades
  };
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : undefined;
}

function buildOfferUpdateData(input: ReturnType<typeof updateOfferRequestSchema.parse>) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.availability !== undefined ? { availability: input.availability } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
    ...(input.includes !== undefined ? { includes: cleanList(input.includes) ?? [] } : {}),
    ...(input.tags !== undefined ? { tags: cleanList(input.tags) ?? [] } : {})
  };
}

offersRoutes.get('/mine', asyncRoute(async (req, res) => {
  const offers = await prisma.offer.findMany({ where: { ownerId: req.user!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ offers: await withMedia('offer', offers) });
}));

offersRoutes.get('/:offerId', asyncRoute(async (req, res) => {
  const offer = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id } });
  if (!offer) return res.status(404).json({ error: 'not_found' });
  res.json({ offer: await withOneMedia('offer', offer) });
}));

offersRoutes.get('/:offerId/delete-impact', asyncRoute(async (req, res) => {
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const [linkedTradeCount, active] = await Promise.all([
    prisma.trade.count({ where: { offerId: existing.id } }),
    loadActiveLinkedTrades(existing.id)
  ]);
  res.json({
    blocked: active.activeTradeCount > 0,
    linkedTradeCount,
    historicalTradeCount: Math.max(0, linkedTradeCount - active.activeTradeCount),
    activeTradeCount: active.activeTradeCount,
    activeTrades: active.activeTrades
  });
}));

offersRoutes.post('/', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = createOfferRequestSchema.parse(req.body);
  const offer = await prisma.offer.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
      itemType: input.itemType ?? 'service',
      category: input.category ?? null,
      availability: input.availability ?? null,
      mode: input.mode ?? null,
      locationLabel: input.locationLabel ?? null,
      includes: input.includes ?? [],
      tags: input.tags ?? [],
      status: input.status ?? 'draft',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'offer', offer.id);
  res.status(201).json({ offer: await withOneMedia('offer', offer) });
}));

offersRoutes.patch('/:offerId', requireActiveAccount, asyncRoute(async (req, res) => {
  const input = updateOfferRequestSchema.parse(req.body);
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const active = await loadActiveLinkedTrades(existing.id);
  if (active.activeTradeCount > 0) {
    return res.status(409).json(linkedOfferBlockedPayload(active.activeTradeCount, active.activeTrades, 'edit'));
  }
  const offer = await prisma.offer.update({ where: { id: existing.id }, data: buildOfferUpdateData(input) });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'offer', offer.id);
  res.json({ offer: await withOneMedia('offer', offer) });
}));

offersRoutes.delete('/:offerId', requireActiveAccount, asyncRoute(async (req, res) => {
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const active = await loadActiveLinkedTrades(existing.id);
  if (active.activeTradeCount > 0) {
    return res.status(409).json(linkedOfferBlockedPayload(active.activeTradeCount, active.activeTrades, 'delete'));
  }

  await prisma.$transaction([
    prisma.trade.updateMany({ where: { offerId: existing.id }, data: { offerId: null } }),
    prisma.mediaAsset.updateMany({ where: { entityType: 'offer', entityId: existing.id, status: { not: 'removed' } }, data: { status: 'removed' } }),
    prisma.offer.delete({ where: { id: existing.id } })
  ]);
  res.status(204).send();
}));
