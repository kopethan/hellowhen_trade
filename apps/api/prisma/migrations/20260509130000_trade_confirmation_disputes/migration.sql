ALTER TABLE "Trade"
  ADD COLUMN "deliverySubmittedById" TEXT,
  ADD COLUMN "deliverySubmittedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedById" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "disputedById" TEXT,
  ADD COLUMN "disputedAt" TIMESTAMP(3),
  ADD COLUMN "disputeTicketId" TEXT;

CREATE INDEX "Trade_disputedAt_idx" ON "Trade"("disputedAt");
CREATE INDEX "Trade_disputeTicketId_idx" ON "Trade"("disputeTicketId");
