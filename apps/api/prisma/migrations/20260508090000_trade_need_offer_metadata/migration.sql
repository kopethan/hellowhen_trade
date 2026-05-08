-- Phase 1: Need/Offer metadata for the new trade deck model.
-- New public trades should be composed from one saved Need and one saved Offer.
-- Existing nullable Trade.needId / Trade.offerId columns are kept nullable for legacy data;
-- the API contract now validates both IDs for newly published trades.

CREATE TYPE "TradeExchangeMode" AS ENUM ('remote', 'local', 'hybrid');

ALTER TABLE "Need"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "timing" TEXT,
  ADD COLUMN "mode" "TradeExchangeMode",
  ADD COLUMN "locationLabel" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Offer"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "availability" TEXT,
  ADD COLUMN "mode" "TradeExchangeMode",
  ADD COLUMN "locationLabel" TEXT,
  ADD COLUMN "includes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Need_category_idx" ON "Need"("category");
CREATE INDEX "Need_mode_idx" ON "Need"("mode");
CREATE INDEX "Offer_category_idx" ON "Offer"("category");
CREATE INDEX "Offer_mode_idx" ON "Offer"("mode");
CREATE INDEX "Trade_needId_idx" ON "Trade"("needId");
CREATE INDEX "Trade_offerId_idx" ON "Trade"("offerId");
