import { Router } from 'express';
import { createUserBlockRequestSchema } from '@hellowhen/contracts';
import { getUserVerificationBadges } from '@hellowhen/shared';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { optionalAuth, requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { publicTradeVisibilityWhere, withTradeDeckMedia } from '../trades/trades.routes.js';
import { publicUserProfileSelect, stripAnonymousPublicProfileMedia } from './publicUser.js';
import { normalizeProfileHandle, usernameErrorPayload } from '../profile/profileUsernames.js';
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

usersRoutes.post('/:userId/block', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
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

usersRoutes.delete('/:userId/block', requireAuth, requireActiveAccount, asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const targetId = req.params.userId;
  if (!targetId || targetId === actorId) return res.status(400).json({ error: 'invalid_block_target' });
  await prisma.userBlock.deleteMany({ where: { blockerId: actorId, blockedId: targetId } });
  res.json({ blocked: false });
}));


async function getPublicProfileResponse(userId: string, viewerId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserProfileSelect,
  });

  if (!user || user.trustTier === 'restricted') return null;

  const viewerState = viewerId ? await userBlockState(viewerId, userId) : undefined;
  if (viewerState?.isBlockingMe) return null;

  const [completedTradesCount, activeTradesCount, openNeedsCount, openOffersCount, activeTrades, openNeeds, openOffers] = await Promise.all([
    prisma.trade.count({ where: { status: 'completed', OR: [{ ownerId: userId }, { providerId: userId }] } }),
    prisma.trade.count({ where: { ...publicPostWhereBase(userId), postType: 'need_offer' } }),
    prisma.trade.count({ where: { ...publicPostWhereBase(userId), postType: 'open_need' } }),
    prisma.trade.count({ where: { ...publicPostWhereBase(userId), postType: 'open_offer' } }),
    prisma.trade.findMany({ where: { ...publicPostWhereBase(userId), postType: 'need_offer' }, include: publicTradeSummaryInclude, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.trade.findMany({ where: { ...publicPostWhereBase(userId), postType: 'open_need' }, include: publicTradeSummaryInclude, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.trade.findMany({ where: { ...publicPostWhereBase(userId), postType: 'open_offer' }, include: publicTradeSummaryInclude, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const publicMediaVisibility = viewerId ? 'trade_public' : 'public_anonymous';
  const [activeTradesWithMedia, openNeedsWithMedia, openOffersWithMedia] = await Promise.all([
    withTradeDeckMedia(activeTrades, publicMediaVisibility),
    withTradeDeckMedia(openNeeds, publicMediaVisibility),
    withTradeDeckMedia(openOffers, publicMediaVisibility),
  ]);

  return {
    user: {
      id: user.id,
      memberSince: user.createdAt,
      profile: user.profile,
      badges: getUserVerificationBadges({
        emailVerifiedAt: user.emailVerifiedAt,
        trustTier: user.trustTier,
        professionalStatus: user.professionalStatus,
      }),
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
  };
}

usersRoutes.get('/by-username/:username/public-profile', optionalAuth, asyncRoute(async (req, res) => {
  let username: string;
  try {
    username = normalizeProfileHandle(req.params.username) ?? '';
  } catch (caughtError) {
    const payload = usernameErrorPayload(caughtError);
    if (payload) return res.status(payload.status).json(payload.body);
    throw caughtError;
  }
  if (!username) return res.status(400).json({ error: 'missing_username' });

  const profile = await prisma.profile.findUnique({ where: { handle: username }, select: { userId: true } });
  if (!profile) return res.status(404).json({ error: 'not_found' });

  const response = await getPublicProfileResponse(profile.userId, req.user?.id);
  if (!response) return res.status(404).json({ error: 'not_found' });
  res.json(stripAnonymousPublicProfileMedia(response, req.user?.id));
}));

usersRoutes.get('/:userId/public-profile', optionalAuth, asyncRoute(async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: 'missing_user_id' });

  const response = await getPublicProfileResponse(userId, req.user?.id);
  if (!response) return res.status(404).json({ error: 'not_found' });
  res.json(stripAnonymousPublicProfileMedia(response, req.user?.id));
}));
