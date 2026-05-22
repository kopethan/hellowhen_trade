ALTER TYPE "SupportTicketCategory" ADD VALUE IF NOT EXISTS 'account_recovery';

ALTER TABLE "SupportTicket"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "guestAccountEmail" TEXT,
  ADD COLUMN "guestName" TEXT,
  ADD COLUMN "guestUserAgent" TEXT;

ALTER TABLE "SupportTicketMessage"
  ALTER COLUMN "senderId" DROP NOT NULL;

CREATE INDEX "SupportTicket_guestEmail_status_createdAt_idx" ON "SupportTicket"("guestEmail", "status", "createdAt");
CREATE INDEX "SupportTicket_guestAccountEmail_status_createdAt_idx" ON "SupportTicket"("guestAccountEmail", "status", "createdAt");
