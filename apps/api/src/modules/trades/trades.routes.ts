import { Router } from 'express';
import { createTradeRequestSchema } from '@zizilia/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';

export const tradesRoutes = Router();

tradesRoutes.get('/feed', asyncRoute(async (_req, res) => {
  const trades = await prisma.trade.findMany({
    where: {
      status: 'active',
      isPublic: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    include: {
      owner: {
        select: {
          id: true,
          profile: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json({ trades });
}));

tradesRoutes.get('/mine', requireAuth, asyncRoute(async (req, res) => {
  const trades = await prisma.trade.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ trades });
}));

tradesRoutes.get('/:tradeId', optionalAuth, asyncRoute(async (req, res) => {
  const trade = await prisma.trade.findFirst({
    where: {
      id: req.params.tradeId,
      OR: [
        { isPublic: true, status: 'active' },
        { ownerId: req.user?.id }
      ]
    }
  });

  if (!trade) {
    return res.status(404).json({ error: 'not_found' });
  }

  res.json({ trade });
}));

tradesRoutes.post('/', requireAuth, asyncRoute(async (req, res) => {
  const input = createTradeRequestSchema.parse(req.body);
  const trade = await prisma.trade.create({
    data: {
      ownerId: req.user!.id,
      title: input.title,
      description: input.description,
      creditAmount: input.creditAmount,
      needId: input.needId ?? null,
      offerId: input.offerId ?? null,
      status: 'active',
      isPublic: true,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });

  res.status(201).json({ trade });
}));

tradesRoutes.post('/:tradeId/close', requireAuth, asyncRoute(async (req, res) => {
  const trade = await prisma.trade.findFirst({
    where: {
      id: req.params.tradeId,
      ownerId: req.user!.id
    }
  });

  if (!trade) {
    return res.status(404).json({ error: 'not_found' });
  }

  const closed = await prisma.trade.update({
    where: { id: trade.id },
    data: {
      status: 'closed',
      isPublic: false,
      closedAt: new Date()
    }
  });

  res.json({ trade: closed });
}));
