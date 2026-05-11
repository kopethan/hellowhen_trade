-- Phase 23.9D: proposal-side support for Open Need and Open Offer posts.
-- Open Need proposals must reference one of the applicant's Offers.
-- Open Offer proposals must reference one of the applicant's Needs.

ALTER TABLE "TradeProposal"
  ADD COLUMN IF NOT EXISTS "proposedNeedId" TEXT,
  ADD COLUMN IF NOT EXISTS "proposedOfferId" TEXT;

CREATE INDEX IF NOT EXISTS "TradeProposal_proposedNeedId_idx" ON "TradeProposal"("proposedNeedId");
CREATE INDEX IF NOT EXISTS "TradeProposal_proposedOfferId_idx" ON "TradeProposal"("proposedOfferId");

DO $$ BEGIN
  ALTER TABLE "TradeProposal" ADD CONSTRAINT "TradeProposal_proposedNeedId_fkey" FOREIGN KEY ("proposedNeedId") REFERENCES "Need"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TradeProposal" ADD CONSTRAINT "TradeProposal_proposedOfferId_fkey" FOREIGN KEY ("proposedOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
