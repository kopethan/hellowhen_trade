import { Router } from 'express';
import { updateSettingsRequestSchema } from '@zizilia/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth);

settingsRoutes.get('/me', asyncRoute(async (req, res) => {
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id },
    update: {}
  });

  res.json({ settings });
}));

settingsRoutes.patch('/me', asyncRoute(async (req, res) => {
  const input = updateSettingsRequestSchema.parse(req.body);
  const settings = await prisma.userSettings.update({
    where: { userId: req.user!.id },
    data: input
  });

  res.json({ settings });
}));
