-- Add the Plan soft-delete fields used by the API and Prisma schema.
ALTER TABLE "Plan"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Plan_deletedAt_idx" ON "Plan"("deletedAt");
CREATE INDEX "Plan_ownerId_deletedAt_startsAt_idx" ON "Plan"("ownerId", "deletedAt", "startsAt");
