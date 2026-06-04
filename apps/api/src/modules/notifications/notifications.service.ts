import type { Prisma, InAppNotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type NotificationDb = typeof prisma | Prisma.TransactionClient;

type CreateInAppNotificationInput = {
  userId: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  targetPath?: string | null;
  tradeId?: string | null;
  proposalId?: string | null;
  supportTicketId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

function safeMetadata(input?: Prisma.InputJsonValue | null): Prisma.InputJsonValue | undefined {
  return input === null || typeof input === 'undefined' ? undefined : input;
}

function uniqueRecipients(recipients: Array<string | null | undefined>, actorId?: string | null) {
  return Array.from(new Set(recipients.filter((recipient): recipient is string => Boolean(recipient)))).filter((recipient) => recipient !== actorId);
}

export async function createInAppNotification(db: NotificationDb, input: CreateInAppNotificationInput) {
  return db.inAppNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      targetPath: input.targetPath ?? null,
      tradeId: input.tradeId ?? null,
      proposalId: input.proposalId ?? null,
      supportTicketId: input.supportTicketId ?? null,
      metadata: safeMetadata(input.metadata),
    },
  });
}

function quoteTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return 'this trade';
  return `“${trimmed.slice(0, 120)}”`;
}

function tradeStatusLabel(status: string) {
  if (status === 'submitted') return 'submitted for review';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'disputed') return 'marked as disputed';
  if (status === 'closed') return 'closed';
  if (status === 'expired') return 'expired';
  if (status === 'in_progress') return 'in progress';
  return status.replaceAll('_', ' ');
}

export async function notifyTradeProposalReceived(db: NotificationDb, input: { ownerId: string; actorId: string; tradeId: string; proposalId: string; tradeTitle: string }) {
  if (input.ownerId === input.actorId) return null;
  const tradeTitle = quoteTitle(input.tradeTitle);
  return createInAppNotification(db, {
    userId: input.ownerId,
    type: 'trade_proposal_received',
    title: 'New proposal',
    body: `Someone sent a proposal on ${tradeTitle}.`,
    targetPath: `/trades/${input.tradeId}/proposals/${input.proposalId}`,
    tradeId: input.tradeId,
    proposalId: input.proposalId,
    metadata: { tradeTitle: input.tradeTitle },
  });
}

export async function notifyProposalDecision(db: NotificationDb, input: { applicantId: string; actorId: string; tradeId: string; proposalId: string; tradeTitle: string; decision: 'accepted' | 'declined' }) {
  if (input.applicantId === input.actorId) return null;
  const accepted = input.decision === 'accepted';
  const tradeTitle = quoteTitle(input.tradeTitle);
  return createInAppNotification(db, {
    userId: input.applicantId,
    type: accepted ? 'trade_proposal_accepted' : 'trade_proposal_declined',
    title: accepted ? 'Proposal accepted' : 'Proposal declined',
    body: accepted ? `Your proposal on ${tradeTitle} was accepted.` : `Your proposal on ${tradeTitle} was declined.`,
    targetPath: `/trades/${input.tradeId}/proposals/${input.proposalId}`,
    tradeId: input.tradeId,
    proposalId: input.proposalId,
    metadata: { tradeTitle: input.tradeTitle },
  });
}

export async function notifyProposalWithdrawn(db: NotificationDb, input: { ownerId: string; actorId: string; tradeId: string; proposalId: string; tradeTitle: string }) {
  if (input.ownerId === input.actorId) return null;
  const tradeTitle = quoteTitle(input.tradeTitle);
  return createInAppNotification(db, {
    userId: input.ownerId,
    type: 'trade_proposal_withdrawn',
    title: 'Proposal withdrawn',
    body: `A proposal on ${tradeTitle} was withdrawn.`,
    targetPath: `/trades/${input.tradeId}/proposals/${input.proposalId}`,
    tradeId: input.tradeId,
    proposalId: input.proposalId,
    metadata: { tradeTitle: input.tradeTitle },
  });
}

export async function notifyProposalMessageReceived(db: NotificationDb, input: { recipientId: string; actorId: string; tradeId: string; proposalId: string; tradeTitle: string }) {
  if (input.recipientId === input.actorId) return null;
  const tradeTitle = quoteTitle(input.tradeTitle);
  return createInAppNotification(db, {
    userId: input.recipientId,
    type: 'proposal_message_received',
    title: 'New private message',
    body: `You have a new private message about ${tradeTitle}.`,
    targetPath: `/trades/${input.tradeId}/proposals/${input.proposalId}`,
    tradeId: input.tradeId,
    proposalId: input.proposalId,
    metadata: { tradeTitle: input.tradeTitle },
  });
}

export async function notifyTradeStatusUpdated(db: NotificationDb, input: { recipientIds: Array<string | null | undefined>; actorId: string; tradeId: string; tradeTitle: string; status: string; proposalId?: string | null }) {
  const recipients = uniqueRecipients(input.recipientIds, input.actorId);
  if (recipients.length === 0) return [];
  const tradeTitle = quoteTitle(input.tradeTitle);
  const statusLabel = tradeStatusLabel(input.status);
  return Promise.all(recipients.map((userId) => createInAppNotification(db, {
    userId,
    type: 'trade_status_updated',
    title: 'Trade update',
    body: `${tradeTitle} was ${statusLabel}.`,
    targetPath: input.proposalId ? `/trades/${input.tradeId}/proposals/${input.proposalId}` : `/trades/${input.tradeId}`,
    tradeId: input.tradeId,
    proposalId: input.proposalId ?? null,
    metadata: { tradeTitle: input.tradeTitle, status: input.status, statusLabel },
  })));
}

export async function notifySupportTicketUpdated(db: NotificationDb, input: { userId?: string | null; actorId?: string | null; ticketId: string; subject: string }) {
  if (!input.userId || input.userId === input.actorId) return null;
  const subject = input.subject.trim() ? input.subject.trim().slice(0, 120) : 'your support ticket';
  return createInAppNotification(db, {
    userId: input.userId,
    type: 'support_ticket_updated',
    title: 'Support updated',
    body: `Support replied to “${subject}”.`,
    targetPath: `/account/support/${input.ticketId}`,
    supportTicketId: input.ticketId,
    metadata: { ticketSubject: subject },
  });
}
