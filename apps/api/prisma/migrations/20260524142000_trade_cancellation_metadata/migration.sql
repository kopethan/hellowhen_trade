ALTER TABLE "Trade"
  ADD COLUMN "cancelledByUserId" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT;

CREATE INDEX "Trade_cancelledAt_idx" ON "Trade"("cancelledAt");
