-- Hidden Cash Promise foundation.
-- This stores written, outside-Hellowhen cash promises separately from wallet/payment/escrow tables.
CREATE TYPE "CashPromiseSide" AS ENUM ('need', 'offer');

CREATE TABLE "CashPromise" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT,
    "proposalId" TEXT,
    "side" "CashPromiseSide" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "note" TEXT,
    "acknowledgementText" TEXT NOT NULL,
    "acknowledgedById" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashPromise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashPromise_tradeId_key" ON "CashPromise"("tradeId");
CREATE UNIQUE INDEX "CashPromise_proposalId_key" ON "CashPromise"("proposalId");
CREATE INDEX "CashPromise_acknowledgedById_createdAt_idx" ON "CashPromise"("acknowledgedById", "createdAt");
CREATE INDEX "CashPromise_side_createdAt_idx" ON "CashPromise"("side", "createdAt");

ALTER TABLE "CashPromise" ADD CONSTRAINT "CashPromise_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashPromise" ADD CONSTRAINT "CashPromise_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TradeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashPromise" ADD CONSTRAINT "CashPromise_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashPromise" ADD CONSTRAINT "CashPromise_one_parent_check" CHECK (("tradeId" IS NOT NULL AND "proposalId" IS NULL) OR ("tradeId" IS NULL AND "proposalId" IS NOT NULL));
ALTER TABLE "CashPromise" ADD CONSTRAINT "CashPromise_amount_positive_check" CHECK ("amountCents" > 0);
