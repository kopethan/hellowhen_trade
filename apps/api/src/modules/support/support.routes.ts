import { Router } from 'express';
import {
  createSupportMessageRequestSchema,
  createSupportTicketRequestSchema,
  updateSupportTicketStatusRequestSchema,
} from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { attachUploadedMediaToEntity, loadMediaByEntityIds, type MediaVisibility } from '../media/media.helpers.js';

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

type SupportMessageWithId = { id: string };
type SupportTicketWithMessages = { id: string; messages?: SupportMessageWithId[] };

export async function withSupportTicketMedia<T extends SupportTicketWithMessages>(tickets: T[], visibility: MediaVisibility = 'owner') {
  const ticketIds = tickets.map((ticket) => ticket.id);
  const messageIds = tickets.flatMap((ticket) => ticket.messages?.map((message) => message.id) ?? []);

  const [ticketMedia, messageMedia] = await Promise.all([
    loadMediaByEntityIds('support_ticket', ticketIds, visibility),
    loadMediaByEntityIds('support_message', messageIds, visibility),
  ]);

  return tickets.map((ticket) => ({
    ...ticket,
    media: ticketMedia.get(ticket.id) ?? [],
    messages: ticket.messages?.map((message) => ({ ...message, media: messageMedia.get(message.id) ?? [] })) ?? [],
  }));
}

export async function withOneSupportTicketMedia<T extends SupportTicketWithMessages>(ticket: T, visibility: MediaVisibility = 'owner') {
  const [result] = await withSupportTicketMedia([ticket], visibility);
  return result;
}

export async function withSupportMessageMedia<T extends SupportMessageWithId>(messages: T[], visibility: MediaVisibility = 'owner') {
  const messageMedia = await loadMediaByEntityIds('support_message', messages.map((message) => message.id), visibility);
  return messages.map((message) => ({ ...message, media: messageMedia.get(message.id) ?? [] }));
}

export async function withOneSupportMessageMedia<T extends SupportMessageWithId>(message: T, visibility: MediaVisibility = 'owner') {
  const [result] = await withSupportMessageMedia([message], visibility);
  return result;
}


async function canReferenceProposal(actorId: string, proposalId?: string) {
  if (!proposalId) return null;
  return prisma.tradeProposal.findFirst({
    where: {
      id: proposalId,
      OR: [
        { applicantId: actorId },
        { trade: { ownerId: actorId } },
        { trade: { providerId: actorId } },
      ],
    },
    select: { id: true, tradeId: true },
  });
}

async function canReferenceMedia(actorId: string, mediaId?: string) {
  if (!mediaId) return null;
  return prisma.mediaAsset.findFirst({ where: { id: mediaId, ownerId: actorId, status: { not: 'removed' } }, select: { id: true } });
}

async function canReportTrade(actorId: string, tradeId?: string) {
  if (!tradeId) return null;
  return prisma.trade.findFirst({
    where: {
      id: tradeId,
      OR: [
        { ownerId: actorId },
        { providerId: actorId },
        { proposals: { some: { applicantId: actorId } } },
      ],
    },
    include: { payment: true },
  });
}

function shouldFreezeTrade(category: string) {
  return category === 'trade_issue' || category === 'safety_concern';
}

supportRoutes.get('/tickets/mine', asyncRoute(async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ tickets: await withSupportTicketMedia(tickets, 'owner') });
}));

supportRoutes.post('/tickets', asyncRoute(async (req, res) => {
  const input = createSupportTicketRequestSchema.parse(req.body);
  const actorId = req.user!.id;
  const relatedTrade = await canReportTrade(actorId, input.relatedTradeId);
  if (input.relatedTradeId && !relatedTrade) return res.status(403).json({ error: 'forbidden', message: 'You can only report a trade you created, joined, or proposed to.' });
  const relatedProposal = await canReferenceProposal(actorId, input.relatedProposalId);
  if (input.relatedProposalId && !relatedProposal) return res.status(403).json({ error: 'forbidden', message: 'You can only reference a proposal you can access.' });
  const relatedMedia = await canReferenceMedia(actorId, input.relatedMediaId);
  if (input.relatedMediaId && !relatedMedia) return res.status(403).json({ error: 'forbidden', message: 'You can only reference your own uploaded media.' });

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        userId: actorId,
        category: input.category,
        subject: input.subject,
        message: input.message,
        priority: input.priority ?? (relatedTrade?.amountCents ? 'high' : 'normal'),
        relatedTradeId: input.relatedTradeId ?? null,
        relatedProposalId: input.relatedProposalId ?? null,
        relatedMediaId: input.relatedMediaId ?? null,
        messages: { create: { senderId: actorId, senderRole: 'user', body: input.message } },
      },
      include: ticketIncludeForUser,
    });

    if (relatedTrade && shouldFreezeTrade(input.category) && ['active', 'in_progress', 'submitted', 'completed'].includes(relatedTrade.status)) {
      await tx.trade.update({ where: { id: relatedTrade.id }, data: { status: 'disputed', isPublic: false, disputedById: actorId, disputedAt: new Date(), disputeTicketId: created.id } });
      if (relatedTrade.payment?.sellerId) {
        await tx.payoutRequest.updateMany({
          where: { userId: relatedTrade.payment.sellerId, status: { in: ['requested', 'approved'] } },
          data: { stripeExternalStatus: 'paused_trade_dispute', notes: `Paused because trade ${relatedTrade.id} was reported. Review support ticket ${created.id}.` },
        });
      }
    }
    return created;
  });
  await attachUploadedMediaToEntity(actorId, input.mediaIds, 'support_ticket', ticket.id);
  res.status(201).json({ ticket: await withOneSupportTicketMedia(ticket, 'owner') });
}));

supportRoutes.get('/tickets/:ticketId', asyncRoute(async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.ticketId, userId: req.user!.id },
    include: ticketIncludeForUser,
  });
  if (!ticket) return res.status(404).json({ error: 'not_found' });
  res.json({ ticket: await withOneSupportTicketMedia(ticket, 'owner') });
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
  await attachUploadedMediaToEntity(req.user!.id, input.mediaIds, 'support_message', message.id);
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: ticket.status === 'waiting_for_user' || ticket.status === 'resolved' ? 'open' : ticket.status },
  });
  res.status(201).json({ message: await withOneSupportMessageMedia(message, 'owner') });
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
  res.json({ ticket: await withOneSupportTicketMedia(updated, 'owner') });
}));
