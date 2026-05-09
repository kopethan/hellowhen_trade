-- Phase 20.0: payout fee transparency.
-- Keep amountCents as the requested gross earnings amount for compatibility.

ALTER TABLE "PayoutRequest"
  ADD COLUMN "grossAmountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "netAmountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "platformFeeRateBps" INTEGER NOT NULL DEFAULT 1000;

UPDATE "PayoutRequest"
SET
  "grossAmountCents" = CASE WHEN "grossAmountCents" = 0 THEN "amountCents" ELSE "grossAmountCents" END,
  "netAmountCents" = CASE WHEN "netAmountCents" = 0 THEN "amountCents" ELSE "netAmountCents" END
WHERE "amountCents" <> 0;

CREATE INDEX "PayoutRequest_status_requestedAt_idx" ON "PayoutRequest"("status", "requestedAt");
