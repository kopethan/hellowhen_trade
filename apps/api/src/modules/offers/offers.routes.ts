import { Router } from 'express';
import { createOfferRequestSchema } from '@zizilia/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const offersRoutes = Router();

offersRoutes.use(requireAuth);

offersRoutes.get('/mine', asyncRoute(async (req, res) => {
  const offers = await prisma.offer.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ offers });
}));

offersRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createOfferRequestSchema.parse(req.body);
  const offer = await prisma.offer.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
      status: input.status ?? 'draft',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });

  res.status(201).json({ offer });
}));
