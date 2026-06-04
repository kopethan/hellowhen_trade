CREATE TYPE "InAppNotificationType" AS ENUM (
  'trade_proposal_received',
  'trade_proposal_accepted',
  'trade_proposal_declined',
  'proposal_message_received',
  'support_ticket_updated',
  'content_moderation_updated',
  'trade_status_updated'
);

CREATE TABLE "InAppNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "InAppNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "targetPath" TEXT,
  "tradeId" TEXT,
  "proposalId" TEXT,
  "supportTicketId" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InAppNotification"
  ADD CONSTRAINT "InAppNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "InAppNotification_userId_readAt_createdAt_idx" ON "InAppNotification"("userId", "readAt", "createdAt");
CREATE INDEX "InAppNotification_userId_createdAt_idx" ON "InAppNotification"("userId", "createdAt");
CREATE INDEX "InAppNotification_type_createdAt_idx" ON "InAppNotification"("type", "createdAt");
CREATE INDEX "InAppNotification_tradeId_idx" ON "InAppNotification"("tradeId");
CREATE INDEX "InAppNotification_proposalId_idx" ON "InAppNotification"("proposalId");
CREATE INDEX "InAppNotification_supportTicketId_idx" ON "InAppNotification"("supportTicketId");
