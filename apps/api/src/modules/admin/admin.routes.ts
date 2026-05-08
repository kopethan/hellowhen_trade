import { Router } from 'express';
import { adminCreateSupportMessageRequestSchema, adminListMediaQuerySchema, adminUpdateSupportTicketRequestSchema, supportTicketCategorySchema, supportTicketPrioritySchema, supportTicketStatusSchema, updateMediaStatusRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const adminRoutes = Router();
const mediaUserSelect = { id: true, email: true, profile: true } as const;

async function withMediaEntityContext<T extends { entityType: 'need' | 'offer' | 'trade' | null; entityId: string | null }>(media: T[]) {
  const needIds = media.filter((item) => item.entityType === 'need' && item.entityId).map((item) => item.entityId!);
  const offerIds = media.filter((item) => item.entityType === 'offer' && item.entityId).map((item) => item.entityId!);
  const tradeIds = media.filter((item) => item.entityType === 'trade' && item.entityId).map((item) => item.entityId!);

  const [needs, offers, trades] = await Promise.all([
    needIds.length ? prisma.need.findMany({ where: { id: { in: needIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, timing: true, mode: true, locationLabel: true } }) : [],
    offerIds.length ? prisma.offer.findMany({ where: { id: { in: offerIds } }, select: { id: true, ownerId: true, title: true, status: true, category: true, availability: true, mode: true, locationLabel: true } }) : [],
    tradeIds.length ? prisma.trade.findMany({ where: { id: { in: tradeIds } }, select: { id: true, ownerId: true, title: true, status: true, needId: true, offerId: true, creditAmount: true } }) : []
  ]);

  const needsById = new Map(needs.map((need) => [need.id, need]));
  const offersById = new Map(offers.map((offer) => [offer.id, offer]));
  const tradesById = new Map(trades.map((trade) => [trade.id, trade]));

  return media.map((item) => {
    if (item.entityType === 'need' && item.entityId) return { ...item, entity: needsById.get(item.entityId) ?? null };
    if (item.entityType === 'offer' && item.entityId) return { ...item, entity: offersById.get(item.entityId) ?? null };
    if (item.entityType === 'trade' && item.entityId) return { ...item, entity: tradesById.get(item.entityId) ?? null };
    return { ...item, entity: null };
  });
}

adminRoutes.use(requireAuth);

adminRoutes.use(asyncRoute(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true } });
  if (user?.role !== 'admin') return res.status(403).json({ error: 'admin_required', message: 'Admin access is required.' });
  return next();
}));

adminRoutes.get('/media', asyncRoute(async (req, res) => {
  const input = adminListMediaQuerySchema.parse(req.query);
  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.ownerId ? { ownerId: input.ownerId } : {})
  };
  const media = await prisma.mediaAsset.findMany({
    where,
    include: {
      owner: { select: mediaUserSelect },
      reviewer: { select: mediaUserSelect }
    },
    orderBy: { createdAt: 'desc' },
    take: input.take ?? 100
  });
  res.json({ media: await withMediaEntityContext(media) });
}));

adminRoutes.get('/media/summary', asyncRoute(async (_req, res) => {
  const [byStatus, byEntityType] = await Promise.all([
    prisma.mediaAsset.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.mediaAsset.groupBy({ by: ['entityType'], _count: { _all: true } })
  ]);

  res.json({
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
    byEntityType: Object.fromEntries(byEntityType.map((row) => [row.entityType ?? 'unattached', row._count._all]))
  });
}));

adminRoutes.get('/media/:mediaId', asyncRoute(async (req, res) => {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: req.params.mediaId },
    include: {
      owner: { select: mediaUserSelect },
      reviewer: { select: mediaUserSelect }
    }
  });
  if (!media) return res.status(404).json({ error: 'not_found' });
  res.json({ media: (await withMediaEntityContext([media]))[0] });
}));

adminRoutes.patch('/media/:mediaId/status', asyncRoute(async (req, res) => {
  const input = updateMediaStatusRequestSchema.parse(req.body);
  const media = await prisma.mediaAsset.findUnique({ where: { id: req.params.mediaId } });
  if (!media) return res.status(404).json({ error: 'not_found' });
  const updated = await prisma.mediaAsset.update({
    where: { id: media.id },
    data: { status: input.status, reviewNote: input.reviewNote ?? null, reviewerId: req.user!.id, reviewedAt: new Date() },
    include: { owner: { select: { id: true, email: true, profile: true } }, reviewer: { select: { id: true, email: true, profile: true } } }
  });
  res.json({ media: (await withMediaEntityContext([updated]))[0] });
}));

adminRoutes.get('/credits/purchases', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where = rawStatus && ['pending', 'paid', 'failed', 'expired'].includes(rawStatus) ? { status: rawStatus as 'pending' | 'paid' | 'failed' | 'expired' } : {};
  const purchases = await prisma.creditPurchase.findMany({
    where,
    include: { user: { select: { id: true, email: true, profile: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json({ purchases });
}));


const supportUserSelect = { id: true, email: true, profile: true } as const;
const supportTicketIncludeForAdmin = {
  user: { select: supportUserSelect },
  assignedAdmin: { select: supportUserSelect },
  messages: {
    include: { sender: { select: supportUserSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

adminRoutes.get('/support/tickets', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const rawCategory = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rawPriority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const status = rawStatus ? supportTicketStatusSchema.safeParse(rawStatus) : null;
  const category = rawCategory ? supportTicketCategorySchema.safeParse(rawCategory) : null;
  const priority = rawPriority ? supportTicketPrioritySchema.safeParse(rawPriority) : null;
  const where = {
    ...(status?.success ? { status: status.data } : {}),
    ...(category?.success ? { category: category.data } : {}),
    ...(priority?.success ? { priority: priority.data } : {}),
  };
  const tickets = await prisma.supportTicket.findMany({
    where,
    include: { user: { select: supportUserSelect }, assignedAdmin: { select: supportUserSelect }, _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ tickets });
}));

adminRoutes.get('/support/tickets/:ticketId', asyncRoute(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId }, include: supportTicketIncludeForAdmin });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  res.json({ ticket });
}));

adminRoutes.patch('/support/tickets/:ticketId', asyncRoute(async (req, res) => {
  const input = adminUpdateSupportTicketRequestSchema.parse(req.body);
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const status = input.status ?? existing.status;
  const updated = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: {
      status,
      priority: input.priority ?? existing.priority,
      assignedAdminId: input.assignedAdminId === undefined ? existing.assignedAdminId : input.assignedAdminId,
      resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null,
    },
    include: supportTicketIncludeForAdmin,
  });
  res.json({ ticket: updated });
}));

adminRoutes.post('/support/tickets/:ticketId/messages', asyncRoute(async (req, res) => {
  const input = adminCreateSupportMessageRequestSchema.parse(req.body);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  const message = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: req.user!.id,
      senderRole: 'admin',
      body: input.body,
      internal: input.internal ?? false,
    },
    include: { sender: { select: supportUserSelect } },
  });
  const nextStatus = input.status ?? (input.internal ? ticket.status : 'waiting_for_user');
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: nextStatus, assignedAdminId: ticket.assignedAdminId ?? req.user!.id, resolvedAt: nextStatus === 'resolved' || nextStatus === 'closed' ? new Date() : null },
  });
  res.status(201).json({ message });
}));
