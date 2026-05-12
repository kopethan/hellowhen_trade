import { Router } from 'express';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { withTradeDeckMedia } from '../trades/trades.routes.js';
import { publicUserProfileSelect } from './publicUser.js';

export const usersRoutes = Router();

const publicPostWhereBase = (userId: string) => ({
  ownerId: userId,
  isPublic: true,
  status: 'active' as const,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

const publicTradeSummaryInclude = {
  need: true,
  offer: true,
} as const;

usersRoutes.get('/:userId/public-profile', asyncRoute(async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: 'missing_user_id' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserProfileSelect,
  });

  if (!user) return res.status(404).json({ error: 'not_found' });

  const [completedTradesCount, activeTradesCount, openNeedsCount, openOffersCount, activeTrades, openNeeds, openOffers] = await Promise.all([
    prisma.trade.count({ where: { status: 'completed', OR: [{ ownerId: userId }, { providerId: userId }] } }),
    prisma.trade.count({ where: { ...publicPostWhereBase(userId), postType: 'need_offer' } }),
    prisma.trade.count({ where: { ...publicPostWhereBase(userId), postType: 'open_need' } }),
    prisma.trade.count({ where: { ...publicPostWhereBase(userId), postType: 'open_offer' } }),
    prisma.trade.findMany({ where: { ...publicPostWhereBase(userId), postType: 'need_offer' }, include: publicTradeSummaryInclude, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.trade.findMany({ where: { ...publicPostWhereBase(userId), postType: 'open_need' }, include: publicTradeSummaryInclude, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.trade.findMany({ where: { ...publicPostWhereBase(userId), postType: 'open_offer' }, include: publicTradeSummaryInclude, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const [activeTradesWithMedia, openNeedsWithMedia, openOffersWithMedia] = await Promise.all([
    withTradeDeckMedia(activeTrades, 'trade_public'),
    withTradeDeckMedia(openNeeds, 'trade_public'),
    withTradeDeckMedia(openOffers, 'trade_public'),
  ]);

  res.json({
    user: {
      id: user.id,
      memberSince: user.createdAt,
      profile: user.profile,
    },
    stats: {
      completedTradesCount,
      activeTradesCount,
      openNeedsCount,
      openOffersCount,
    },
    sections: {
      activeTrades: activeTradesWithMedia,
      openNeeds: openNeedsWithMedia,
      openOffers: openOffersWithMedia,
    },
  });
}));
