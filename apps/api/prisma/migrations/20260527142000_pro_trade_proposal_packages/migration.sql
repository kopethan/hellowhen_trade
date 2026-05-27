-- Hidden Pro Trade Packages backend foundation.
-- Keeps existing one Need <-> one Offer proposal behavior intact while preparing
-- future Pro-only package proposals behind disabled feature flags.

DO $$ BEGIN
  CREATE TYPE "TradeProposalPackageKind" AS ENUM ('standard', 'main_need_multi_offer', 'main_offer_multi_need');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TradeProposalPackageItemKind" AS ENUM ('need', 'offer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TradeProposalPackageItemRole" AS ENUM ('main', 'supporting');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "TradeProposal"
  ADD COLUMN IF NOT EXISTS "packageKind" "TradeProposalPackageKind" NOT NULL DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS "TradeProposalPackageItem" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "kind" "TradeProposalPackageItemKind" NOT NULL,
  "role" "TradeProposalPackageItemRole" NOT NULL,
  "needId" TEXT,
  "offerId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TradeProposalPackageItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TradeProposal_packageKind_idx" ON "TradeProposal"("packageKind");
CREATE INDEX IF NOT EXISTS "TradeProposalPackageItem_proposalId_sortOrder_idx" ON "TradeProposalPackageItem"("proposalId", "sortOrder");
CREATE INDEX IF NOT EXISTS "TradeProposalPackageItem_needId_idx" ON "TradeProposalPackageItem"("needId");
CREATE INDEX IF NOT EXISTS "TradeProposalPackageItem_offerId_idx" ON "TradeProposalPackageItem"("offerId");

DO $$ BEGIN
  ALTER TABLE "TradeProposalPackageItem"
    ADD CONSTRAINT "TradeProposalPackageItem_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "TradeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TradeProposalPackageItem"
    ADD CONSTRAINT "TradeProposalPackageItem_needId_fkey"
    FOREIGN KEY ("needId") REFERENCES "Need"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TradeProposalPackageItem"
    ADD CONSTRAINT "TradeProposalPackageItem_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
