import { Router } from 'express';
import { createNeedRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const needsRoutes = Router();

needsRoutes.use(requireAuth);

needsRoutes.get('/mine', asyncRoute(async (req, res) => {
  const needs = await prisma.need.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ needs });
}));

needsRoutes.post('/', asyncRoute(async (req, res) => {
  const input = createNeedRequestSchema.parse(req.body);
  const need = await prisma.need.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
      status: input.status ?? 'draft',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });

  res.status(201).json({ need });
}));
