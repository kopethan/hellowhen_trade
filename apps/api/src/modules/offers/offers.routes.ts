import { Router } from 'express';
import { createOfferRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, withMedia, withOneMedia } from '../media/media.helpers.js';

export const offersRoutes = Router();
offersRoutes.use(requireAuth);

offersRoutes.get('/mine', asyncRoute(async (req, res) => {
  const offers = await prisma.offer.findMany({ where: { ownerId: req.user!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ offers: await withMedia('offer', offers) });
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
