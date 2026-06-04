-- Freeze the accepted proposal package so later Need/Offer edits cannot silently change a Deal agreement.
CREATE TABLE "AcceptedDealSnapshot" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "tradeSnapshotJson" JSONB NOT NULL,
    "proposalSnapshotJson" JSONB NOT NULL,
    "ownerGivesJson" JSONB NOT NULL,
    "ownerReceivesJson" JSONB NOT NULL,
    "applicantGivesJson" JSONB NOT NULL,
    "applicantReceivesJson" JSONB NOT NULL,
    "acceptedMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcceptedDealSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcceptedDealSnapshot_tradeId_key" ON "AcceptedDealSnapshot"("tradeId");
CREATE UNIQUE INDEX "AcceptedDealSnapshot_proposalId_key" ON "AcceptedDealSnapshot"("proposalId");
CREATE INDEX "AcceptedDealSnapshot_ownerId_createdAt_idx" ON "AcceptedDealSnapshot"("ownerId", "createdAt");
CREATE INDEX "AcceptedDealSnapshot_applicantId_createdAt_idx" ON "AcceptedDealSnapshot"("applicantId", "createdAt");
CREATE INDEX "AcceptedDealSnapshot_createdAt_idx" ON "AcceptedDealSnapshot"("createdAt");

ALTER TABLE "AcceptedDealSnapshot" ADD CONSTRAINT "AcceptedDealSnapshot_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcceptedDealSnapshot" ADD CONSTRAINT "AcceptedDealSnapshot_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TradeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcceptedDealSnapshot" ADD CONSTRAINT "AcceptedDealSnapshot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcceptedDealSnapshot" ADD CONSTRAINT "AcceptedDealSnapshot_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
