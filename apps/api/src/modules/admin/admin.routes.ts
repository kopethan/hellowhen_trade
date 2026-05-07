import { Router } from 'express';
import { adminCreateSupportMessageRequestSchema, adminUpdateSupportTicketRequestSchema, mediaAssetStatusSchema, supportTicketCategorySchema, supportTicketPrioritySchema, supportTicketStatusSchema, updateMediaStatusRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const adminRoutes = Router();
adminRoutes.use(requireAuth);

adminRoutes.use(asyncRoute(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true } });
  if (user?.role !== 'admin') return res.status(403).json({ error: 'admin_required', message: 'Admin access is required.' });
  return next();
}));

adminRoutes.get('/media', asyncRoute(async (req, res) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const parsedStatus = rawStatus ? mediaAssetStatusSchema.safeParse(rawStatus) : null;
  const where = parsedStatus?.success ? { status: parsedStatus.data } : {};
  const media = await prisma.mediaAsset.findMany({
    where,
    include: {
      owner: { select: { id: true, email: true, profile: true } },
      reviewer: { select: { id: true, email: true, profile: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json({ media });
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
  res.json({ media: updated });
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
