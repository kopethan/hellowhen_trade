-- Add public discussion messages for trades.
CREATE TYPE "TradePublicMessageStatus" AS ENUM ('visible', 'hidden', 'deleted');

ALTER TYPE "ReportTargetType" ADD VALUE 'public_message';

CREATE TABLE "TradePublicMessage" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TradePublicMessageStatus" NOT NULL DEFAULT 'visible',
    "editedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradePublicMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradePublicMessage_tradeId_status_createdAt_idx" ON "TradePublicMessage"("tradeId", "status", "createdAt");
CREATE INDEX "TradePublicMessage_authorId_createdAt_idx" ON "TradePublicMessage"("authorId", "createdAt");
CREATE INDEX "TradePublicMessage_hiddenById_hiddenAt_idx" ON "TradePublicMessage"("hiddenById", "hiddenAt");

ALTER TABLE "TradePublicMessage" ADD CONSTRAINT "TradePublicMessage_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradePublicMessage" ADD CONSTRAINT "TradePublicMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradePublicMessage" ADD CONSTRAINT "TradePublicMessage_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
