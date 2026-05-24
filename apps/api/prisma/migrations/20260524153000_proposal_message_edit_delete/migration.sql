ALTER TABLE "TradeProposal"
  ADD COLUMN "messageEditedAt" TIMESTAMP(3),
  ADD COLUMN "messageEditCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "messageDeletedAt" TIMESTAMP(3);

ALTER TABLE "ProposalMessage"
  ADD COLUMN "updatedAt" TIMESTAMP(3),
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "editCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "ProposalMessage"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "ProposalMessage"
  ALTER COLUMN "updatedAt" SET NOT NULL;
