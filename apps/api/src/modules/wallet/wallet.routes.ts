import { Router } from 'express';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const walletRoutes = Router();

walletRoutes.use(requireAuth);

walletRoutes.get('/me', asyncRoute(async (req, res) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId: req.user!.id },
    include: { entries: { orderBy: { createdAt: 'desc' }, take: 25 } }
  });

  res.json({ wallet });
}));
