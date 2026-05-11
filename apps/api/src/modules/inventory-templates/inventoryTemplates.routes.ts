import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { cloneInventoryTemplateRequestSchema, listInventoryTemplatesQuerySchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { withOneMedia } from '../media/media.helpers.js';

export const inventoryTemplatesRoutes = Router();

const businessProfileSelect = {
  id: true,
  displayName: true,
  handle: true,
  type: true,
  status: true,
} as const;

function buildTemplateWhere(input: ReturnType<typeof listInventoryTemplatesQuerySchema.parse>) {
  const and: Prisma.InventoryTemplateWhereInput[] = [{ status: 'active' }];

  if (input.kind) and.push({ kind: input.kind });
  if (input.itemType) and.push({ itemType: input.itemType });
  if (input.sourceType) and.push({ sourceType: input.sourceType });
  if (input.businessProfileId) and.push({ businessProfileId: input.businessProfileId });

  const q = input.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { locationLabel: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  return { AND: and };
}

inventoryTemplatesRoutes.get('/', asyncRoute(async (req, res) => {
  const input = listInventoryTemplatesQuerySchema.parse(req.query);
  const templates = await prisma.inventoryTemplate.findMany({
    where: buildTemplateWhere(input),
    include: { businessProfile: { select: businessProfileSelect } },
    orderBy: [{ sortOrder: 'asc' }, { itemType: 'asc' }, { title: 'asc' }],
    take: input.take ?? 80,
  });

  res.json({ templates });
}));

inventoryTemplatesRoutes.get('/:templateId', asyncRoute(async (req, res) => {
  const template = await prisma.inventoryTemplate.findFirst({
    where: { id: req.params.templateId, status: 'active' },
    include: { businessProfile: { select: businessProfileSelect } },
  });
  if (!template) return res.status(404).json({ error: 'not_found', message: 'Starter item not found.' });
  res.json({ template });
}));

inventoryTemplatesRoutes.post('/:templateId/clone', requireAuth, asyncRoute(async (req, res) => {
  const input = cloneInventoryTemplateRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const template = await prisma.inventoryTemplate.findFirst({
    where: { id: req.params.templateId, status: 'active' },
    include: { businessProfile: { select: businessProfileSelect } },
  });
  if (!template) return res.status(404).json({ error: 'not_found', message: 'Starter item not found.' });

  if (template.kind === 'need') {
    const need = await prisma.need.create({
      data: {
        ownerId: actorId,
        sourceTemplateId: template.id,
        title: template.title,
        description: template.description,
        itemType: template.itemType,
        category: template.category,
        timing: template.timing,
        mode: template.mode,
        locationLabel: template.locationLabel,
        tags: template.tags,
        status: input.status,
      },
    });
    return res.status(201).json({ template, need: await withOneMedia('need', need) });
  }

  const offer = await prisma.offer.create({
    data: {
      ownerId: actorId,
      sourceTemplateId: template.id,
      title: template.title,
      description: template.description,
      itemType: template.itemType,
      category: template.category,
      availability: template.availability,
      mode: template.mode,
      locationLabel: template.locationLabel,
      includes: template.includes,
      tags: template.tags,
      status: input.status,
    },
  });
  return res.status(201).json({ template, offer: await withOneMedia('offer', offer) });
}));
