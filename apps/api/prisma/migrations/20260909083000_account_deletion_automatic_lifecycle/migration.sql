ALTER TYPE "AccountDeletionRequestStatus" ADD VALUE IF NOT EXISTS 'processing';

ALTER TABLE "AccountDeletionRequest"
ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- Existing active requests predate the automatic lifecycle. Give them a fresh
-- 30-day grace period instead of deleting accounts immediately on deployment.
UPDATE "AccountDeletionRequest"
SET "scheduledFor" = CASE
  WHEN "status" IN ('requested', 'in_review') THEN CURRENT_TIMESTAMP + INTERVAL '30 days'
  ELSE "requestedAt" + INTERVAL '30 days'
END
WHERE "scheduledFor" IS NULL;

ALTER TABLE "AccountDeletionRequest"
ALTER COLUMN "scheduledFor" SET NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "AccountDeletionRequest"
DROP CONSTRAINT IF EXISTS "AccountDeletionRequest_userId_fkey";

ALTER TABLE "AccountDeletionRequest"
ADD CONSTRAINT "AccountDeletionRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AccountDeletionRequest_status_scheduledFor_idx"
ON "AccountDeletionRequest"("status", "scheduledFor");
