import { Router } from 'express';
import { createAccountDeletionRequestSchema } from '@hellowhen/contracts';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { accountDeletionScheduledFor } from './accountDeletion.lifecycle.js';

export const accountRoutes = Router();
accountRoutes.use(requireAuth);

const activeDeletionStatuses = ['requested', 'in_review'] as const;

function deletionMessage(scheduledFor: Date, reason?: string, details?: string) {
  const lines = [
    'The user requested account deletion from the account deletion flow.',
    `Automatic deletion is scheduled for ${scheduledFor.toISOString()}.`,
    'The user can cancel before the scheduled deletion begins. Routine deletion does not require admin approval.',
    reason ? `Reason: ${reason}` : null,
    details ? `Details: ${details}` : null,
    'Support can help with account access or exceptional safety/legal questions during the grace period.',
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

  const requestedAt = new Date();
  const scheduledFor = accountDeletionScheduledFor(requestedAt);
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.accountDeletionRequest.create({
      data: {
        userId: actorId,
        reason: input.reason?.trim() || null,
        details: input.details?.trim() || null,
        requestedAt,
        scheduledFor,
      },
    });
    const message = deletionMessage(scheduledFor, input.reason?.trim(), input.details?.trim());
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

  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.accountDeletionRequest.updateMany({
      where: {
        id: existing.id,
        userId: actorId,
        status: { in: [...activeDeletionStatuses] },
        scheduledFor: { gt: now },
      },
      data: { status: 'cancelled', cancelledAt: now },
    });
    if (cancelled.count !== 1) return null;
    if (existing.supportTicketId) {
      await tx.supportTicket.updateMany({ where: { id: existing.supportTicketId, userId: actorId }, data: { status: 'closed', resolvedAt: now } });
      await tx.supportTicketMessage.create({ data: { ticketId: existing.supportTicketId, senderId: actorId, senderRole: 'user', body: 'I cancelled my account deletion request.' } }).catch(() => null);
    }
    return tx.accountDeletionRequest.findUnique({ where: { id: existing.id } });
  });
  if (!request) {
    return res.status(409).json({ error: 'deletion_processing', message: 'The deletion grace period has ended and account deletion is being processed.' });
  }

  res.json({ request });
}));
