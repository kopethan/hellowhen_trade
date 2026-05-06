import { Router } from 'express';
import { updateProfileRequestSchema } from '@zizilia/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const profileRoutes = Router();

profileRoutes.use(requireAuth);

profileRoutes.patch('/me', asyncRoute(async (req, res) => {
  const input = updateProfileRequestSchema.parse(req.body);
  const profile = await prisma.profile.upsert({
    where: { userId: req.user!.id },
    create: {
      userId: req.user!.id,
      ...input
    },
    update: input
  });

  res.json({ profile });
}));
