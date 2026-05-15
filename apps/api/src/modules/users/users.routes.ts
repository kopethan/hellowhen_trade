import { Router } from 'express';
import { createUserBlockRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { publicTradeVisibilityWhere, withTradeDeckMedia } from '../trades/trades.routes.js';
import { publicUserProfileSelect } from './publicUser.js';
import { userBlockState } from './userBlocks.js';

export const usersRoutes = Router();

const publicPostWhereBase = (userId: string) => ({
  AND: [publicTradeVisibilityWhere(), { ownerId: userId }],
});

const publicTradeSummaryInclude = {
  need: true,
  offer: true,
} as const;

usersRoutes.get('/blocked', requireAuth, asyncRoute(async (req, res) => {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: req.user!.id },
    include: { blocked: { select: publicUserProfileSelect } },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
  res.json({ blocks });
}));

usersRoutes.post('/:userId/block', requireAuth, asyncRoute(async (req, res) => {
  const input = createUserBlockRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const targetId = req.params.userId;
  if (!targetId || targetId === actorId) return res.status(400).json({ error: 'invalid_block_target', message: 'Choose another member to block.' });
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return res.status(404).json({ error: 'not_found' });
  const block = await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: actorId, blockedId: targetId } },
    update: { reason: input.reason?.trim() || null },
    create: { blockerId: actorId, blockedId: targetId, reason: input.reason?.trim() || null },
  });
  res.json({ blocked: true, block });
}));

usersRoutes.delete('/:userId/block', requireAuth, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const targetId = req.params.userId;
  if (!targetId || targetId === actorId) return res.status(400).json({ error: 'invalid_block_target' });
  await prisma.userBlock.deleteMany({ where: { blockerId: actorId, blockedId: targetId } });
  res.json({ blocked: false });
}));

usersRoutes.get('/:userId/public-profile', optionalAuth, asyncRoute(async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: 'missing_user_id' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicUserProfileSelect, trustTier: true },
  });

  if (!user || user.trustTier === 'restricted') return res.status(404).json({ error: 'not_found' });

  const viewerState = req.user ? await userBlockState(req.user.id, userId) : undefined;
  if (viewerState?.isBlockingMe) return res.status(404).json({ error: 'not_found' });

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
      activeTrades: viewerState?.isBlockedByMe ? [] : activeTradesWithMedia,
      openNeeds: viewerState?.isBlockedByMe ? [] : openNeedsWithMedia,
      openOffers: viewerState?.isBlockedByMe ? [] : openOffersWithMedia,
    },
    viewerState,
  });
}));
