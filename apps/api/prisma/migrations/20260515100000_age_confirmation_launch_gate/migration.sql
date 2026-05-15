-- First-launch 18+ age confirmation.
-- This stores only a self-declared adult confirmation, not a date of birth or identity document.

ALTER TABLE "User" ADD COLUMN "ageConfirmedAt" TIMESTAMP(3), ADD COLUMN "declaredAgeBucket" TEXT;

-- Existing beta/demo accounts are backfilled as 18+ for launch continuity.
-- New accounts must explicitly confirm 18+ through the registration/API contract.
UPDATE "User"
SET
  "ageConfirmedAt" = COALESCE("ageConfirmedAt", "termsAcceptedAt", "createdAt", CURRENT_TIMESTAMP),
  "declaredAgeBucket" = COALESCE("declaredAgeBucket", '18_plus')
WHERE "declaredAgeBucket" IS NULL OR "ageConfirmedAt" IS NULL;
