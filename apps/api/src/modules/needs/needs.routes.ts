import { Router } from 'express';
import { createNeedRequestSchema, updateNeedRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, withMedia, withOneMedia } from '../media/media.helpers.js';

export const needsRoutes = Router();
needsRoutes.use(requireAuth);

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : undefined;
}

function buildNeedUpdateData(input: ReturnType<typeof updateNeedRequestSchema.parse>) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.timing !== undefined ? { timing: input.timing } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
    ...(input.tags !== undefined ? { tags: cleanList(input.tags) ?? [] } : {})
  };
}

needsRoutes.get('/mine', asyncRoute(async (req, res) => {
  const needs = await prisma.need.findMany({ where: { ownerId: req.user!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ needs: await withMedia('need', needs) });
}));

needsRoutes.get('/:needId', asyncRoute(async (req, res) => {
  const need = await prisma.need.findFirst({ where: { id: req.params.needId, ownerId: req.user!.id } });
  if (!need) return res.status(404).json({ error: 'not_found' });
  res.json({ need: await withOneMedia('need', need) });
}));

needsRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createNeedRequestSchema.parse(req.body);
  const need = await prisma.need.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
      category: input.category ?? null,
      timing: input.timing ?? null,
      mode: input.mode ?? null,
      locationLabel: input.locationLabel ?? null,
      tags: input.tags ?? [],
      status: input.status ?? 'draft',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'need', need.id);
  res.status(201).json({ need: await withOneMedia('need', need) });
}));

needsRoutes.patch('/:needId', asyncRoute(async (req, res) => {
  const input = updateNeedRequestSchema.parse(req.body);
  const existing = await prisma.need.findFirst({ where: { id: req.params.needId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const need = await prisma.need.update({ where: { id: existing.id }, data: buildNeedUpdateData(input) });
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'need', need.id);
  res.json({ need: await withOneMedia('need', need) });
}));

needsRoutes.delete('/:needId', asyncRoute(async (req, res) => {
  const existing = await prisma.need.findFirst({ where: { id: req.params.needId, ownerId: req.user!.id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const linkedTradeCount = await prisma.trade.count({ where: { needId: existing.id } });
  if (linkedTradeCount > 0) {
    const archived = await prisma.need.update({ where: { id: existing.id }, data: { status: 'closed' } });
    return res.json({ need: await withOneMedia('need', archived), archived: true });
  }
  await prisma.$transaction([
    prisma.mediaAsset.updateMany({ where: { entityType: 'need', entityId: existing.id, status: { not: 'removed' } }, data: { status: 'removed' } }),
    prisma.need.delete({ where: { id: existing.id } })
  ]);
  res.status(204).send();
}));
