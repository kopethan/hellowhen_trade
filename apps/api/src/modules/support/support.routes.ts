import { Router } from 'express';
import {
  createSupportMessageRequestSchema,
  createSupportTicketRequestSchema,
  updateSupportTicketStatusRequestSchema,
} from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const supportRoutes = Router();
supportRoutes.use(requireAuth);

const supportUserSelect = { id: true, email: true, profile: true } as const;
const ticketIncludeForUser = {
  messages: {
    where: { internal: false },
    include: { sender: { select: supportUserSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

supportRoutes.get('/tickets/mine', asyncRoute(async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ tickets });
}));

supportRoutes.post('/tickets', asyncRoute(async (req, res) => {
  const input = createSupportTicketRequestSchema.parse(req.body);
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user!.id,
      category: input.category,
      subject: input.subject,
      message: input.message,
      priority: input.priority ?? 'normal',
      relatedTradeId: input.relatedTradeId ?? null,
      relatedProposalId: input.relatedProposalId ?? null,
      relatedMediaId: input.relatedMediaId ?? null,
      messages: {
        create: {
          senderId: req.user!.id,
          senderRole: 'user',
          body: input.message,
        },
      },
    },
    include: ticketIncludeForUser,
  });
  res.status(201).json({ ticket });
}));

supportRoutes.get('/tickets/:ticketId', asyncRoute(async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.ticketId, userId: req.user!.id },
    include: ticketIncludeForUser,
  });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  res.json({ ticket });
}));

supportRoutes.post('/tickets/:ticketId/messages', asyncRoute(async (req, res) => {
  const input = createSupportMessageRequestSchema.parse(req.body);
  const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.ticketId, userId: req.user!.id } });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  if (ticket.status === 'closed') return res.status(400).json({ error: 'support_ticket_closed', message: 'This support ticket is closed.' });
  const message = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: req.user!.id,
      senderRole: 'user',
      body: input.body,
    },
    include: { sender: { select: supportUserSelect } },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: ticket.status === 'waiting_for_user' || ticket.status === 'resolved' ? 'open' : ticket.status },
  });
  res.status(201).json({ message });
}));

supportRoutes.patch('/tickets/:ticketId/status', asyncRoute(async (req, res) => {
  const input = updateSupportTicketStatusRequestSchema.parse(req.body);
  if (!['open', 'closed'].includes(input.status)) return res.status(400).json({ error: 'unsupported_user_status', message: 'Users can reopen or close their own support tickets.' });
  const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.ticketId, userId: req.user!.id } });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: input.status, resolvedAt: input.status === 'closed' ? new Date() : null },
    include: ticketIncludeForUser,
  });
  res.json({ ticket: updated });
}));
