import { Router } from 'express';
import { createOfferRequestSchema, updateOfferRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, withMedia, withOneMedia } from '../media/media.helpers.js';

export const offersRoutes = Router();
offersRoutes.use(requireAuth);

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : undefined;
}

function buildOfferUpdateData(input: ReturnType<typeof updateOfferRequestSchema.parse>) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
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

offersRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createOfferRequestSchema.parse(req.body);
  const offer = await prisma.offer.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
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

offersRoutes.patch('/:offerId', asyncRoute(async (req, res) => {
  const input = updateOfferRequestSchema.parse(req.body);
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const offer = await prisma.offer.update({ where: { id: existing.id }, data: buildOfferUpdateData(input) });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'offer', offer.id);
  res.json({ offer: await withOneMedia('offer', offer) });
}));

offersRoutes.delete('/:offerId', asyncRoute(async (req, res) => {
  const existing = await prisma.offer.findFirst({ where: { id: req.params.offerId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const linkedTradeCount = await prisma.trade.count({ where: { offerId: existing.id } });
  if (linkedTradeCount > 0) {
    const archived = await prisma.offer.update({ where: { id: existing.id }, data: { status: 'closed' } });
    return res.json({ offer: await withOneMedia('offer', archived), archived: true });
  }
  await prisma.$transaction([
    prisma.mediaAsset.updateMany({ where: { entityType: 'offer', entityId: existing.id, status: { not: 'removed' } }, data: { status: 'removed' } }),
    prisma.offer.delete({ where: { id: existing.id } })
  ]);
  res.status(204).send();
}));
