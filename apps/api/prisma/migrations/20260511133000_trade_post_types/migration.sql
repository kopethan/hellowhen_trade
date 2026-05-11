-- Phase 23.9A: trade post types for Need + Offer, Open Need, and Open Offer.

DO $$ BEGIN
  CREATE TYPE "TradePostType" AS ENUM ('need_offer', 'open_need', 'open_offer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Trade"
  ADD COLUMN IF NOT EXISTS "postType" "TradePostType" NOT NULL DEFAULT 'need_offer';

-- Existing trades are all complete Need + Offer posts unless a future migration/import says otherwise.
UPDATE "Trade"
SET "postType" = 'need_offer'
WHERE "postType" IS NULL;

CREATE INDEX IF NOT EXISTS "Trade_postType_status_isPublic_createdAt_idx" ON "Trade"("postType", "status", "isPublic", "createdAt");
