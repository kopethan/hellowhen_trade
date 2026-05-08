-- Phase 14: Support/feedback screenshots use the same MediaAsset pipeline.
-- Ticket-level attachments belong to support_ticket.
-- Reply-level attachments belong to support_message.

ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'support_ticket';
ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'support_message';

