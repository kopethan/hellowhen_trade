import { Router } from 'express';
import { createAccountDeletionRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const accountRoutes = Router();
accountRoutes.use(requireAuth);

const activeDeletionStatuses = ['requested', 'in_review'] as const;

function deletionMessage(reason?: string, details?: string) {
  const lines = [
    'The user requested account deletion from the account deletion flow.',
    reason ? `Reason: ${reason}` : null,
    details ? `Details: ${details}` : null,
    'Support should confirm identity/safety retention requirements before final deletion.',
  ].filter(Boolean);
  return lines.join('\n\n');
}

accountRoutes.get('/deletion-request', asyncRoute(async (req, res) => {
  const request = await prisma.accountDeletionRequest.findFirst({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ request });
}));

accountRoutes.post('/deletion-request', asyncRoute(async (req, res) => {
  const input = createAccountDeletionRequestSchema.parse(req.body ?? {});
  const actorId = req.user!.id;
  const existing = await prisma.accountDeletionRequest.findFirst({
    where: { userId: actorId, status: { in: [...activeDeletionStatuses] } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return res.status(200).json({ request: existing, duplicate: true });

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.accountDeletionRequest.create({
      data: {
        userId: actorId,
        reason: input.reason?.trim() || null,
        details: input.details?.trim() || null,
      },
    });
    const message = deletionMessage(input.reason?.trim(), input.details?.trim());
    const ticket = await tx.supportTicket.create({
      data: {
        userId: actorId,
        category: 'account_issue',
        subject: 'Account deletion request',
        message,
        priority: 'normal',
        messages: { create: { senderId: actorId, senderRole: 'user', body: message } },
      },
    });
    return tx.accountDeletionRequest.update({ where: { id: created.id }, data: { supportTicketId: ticket.id } });
  });

  res.status(201).json({ request });
}));

accountRoutes.patch('/deletion-request/cancel', asyncRoute(async (req, res) => {
  const actorId = req.user!.id;
  const existing = await prisma.accountDeletionRequest.findFirst({
    where: { userId: actorId, status: { in: [...activeDeletionStatuses] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'There is no active account deletion request to cancel.' });

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.accountDeletionRequest.update({ where: { id: existing.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
    if (existing.supportTicketId) {
      await tx.supportTicket.updateMany({ where: { id: existing.supportTicketId, userId: actorId }, data: { status: 'closed', resolvedAt: new Date() } });
      await tx.supportTicketMessage.create({ data: { ticketId: existing.supportTicketId, senderId: actorId, senderRole: 'user', body: 'I cancelled my account deletion request.' } }).catch(() => null);
    }
    return updated;
  });

  res.json({ request });
}));
