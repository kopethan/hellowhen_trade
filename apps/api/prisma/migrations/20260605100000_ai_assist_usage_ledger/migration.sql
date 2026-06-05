-- Hidden Plus AI assist usage ledger and monthly quota accounting.
-- This does not call any AI provider and does not expose user-facing AI helpers yet.
CREATE TYPE "AiAssistUsageTaskType" AS ENUM (
  'need_title',
  'need_description',
  'offer_title',
  'offer_description',
  'proposal_message',
  'translate_text',
  'category_tags',
  'safety_readability'
);

CREATE TYPE "AiAssistUsageStatus" AS ENUM (
  'reserved',
  'completed',
  'failed',
  'refunded'
);

CREATE TABLE "AiAssistUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "taskType" "AiAssistUsageTaskType" NOT NULL,
  "status" "AiAssistUsageStatus" NOT NULL DEFAULT 'completed',
  "planTierAtUse" "SubscriptionTier" NOT NULL DEFAULT 'free',
  "quotaLimitAtUse" INTEGER NOT NULL,
  "inputHash" TEXT,
  "metadata" JSONB,
  "errorCode" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiAssistUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiAssistUsage_userId_periodKey_status_idx" ON "AiAssistUsage"("userId", "periodKey", "status");
CREATE INDEX "AiAssistUsage_userId_taskType_requestedAt_idx" ON "AiAssistUsage"("userId", "taskType", "requestedAt");
CREATE INDEX "AiAssistUsage_periodKey_status_requestedAt_idx" ON "AiAssistUsage"("periodKey", "status", "requestedAt");
CREATE INDEX "AiAssistUsage_createdAt_idx" ON "AiAssistUsage"("createdAt");

ALTER TABLE "AiAssistUsage"
  ADD CONSTRAINT "AiAssistUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
