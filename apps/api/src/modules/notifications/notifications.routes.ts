import { Router } from 'express';
import { listNotificationsQuerySchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const notificationsRoutes = Router();
notificationsRoutes.use(requireAuth);

function toNotificationDto(notification: {
  id: string;
  type: string;
  title: string;
  body: string;
  targetPath: string | null;
  tradeId: string | null;
  proposalId: string | null;
  supportTicketId: string | null;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    targetPath: notification.targetPath,
    tradeId: notification.tradeId,
    proposalId: notification.proposalId,
    supportTicketId: notification.supportTicketId,
    metadata: notification.metadata,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

async function unreadCount(userId: string) {
  return prisma.inAppNotification.count({ where: { userId, readAt: null } });
}

notificationsRoutes.get('/mine', asyncRoute(async (req, res) => {
  const input = listNotificationsQuerySchema.parse(req.query);
  const userId = req.user!.id;
  const where = { userId, ...(input.unreadOnly ? { readAt: null } : {}) };
  const [notifications, count] = await Promise.all([
    prisma.inAppNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: input.take }),
    unreadCount(userId),
  ]);
  res.json({ notifications: notifications.map(toNotificationDto), unreadCount: count });
}));

notificationsRoutes.get('/unread-count', asyncRoute(async (req, res) => {
  res.json({ unreadCount: await unreadCount(req.user!.id) });
}));

notificationsRoutes.patch('/mark-all-read', asyncRoute(async (req, res) => {
  const userId = req.user!.id;
  const result = await prisma.inAppNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  res.json({ updatedCount: result.count, unreadCount: 0 });
}));

notificationsRoutes.patch('/:notificationId/read', asyncRoute(async (req, res) => {
  const userId = req.user!.id;
  const notification = await prisma.inAppNotification.findFirst({ where: { id: req.params.notificationId, userId } });
  if (!notification) return res.status(404).json({ error: 'not_found' });
  const updated = notification.readAt
    ? notification
    : await prisma.inAppNotification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
  res.json({ notification: toNotificationDto(updated) });
}));
