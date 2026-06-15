CREATE TYPE "ModerationContentType" AS ENUM ('user', 'profile', 'trade', 'need', 'offer', 'proposal', 'message', 'public_message', 'media', 'profile_image', 'trade_image', 'need_image', 'offer_image', 'support_ticket', 'support_message');
CREATE TYPE "ModerationContentVisibility" AS ENUM ('public', 'private', 'reported_private', 'admin_internal');
CREATE TYPE "ModerationCaseSource" AS ENUM ('upload', 'report', 'automatic', 'admin', 'backfill');
CREATE TYPE "ModerationCaseStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_review', 'limited', 'removed', 'skipped', 'failed');
CREATE TYPE "ModerationProviderName" AS ENUM ('none', 'mock', 'openai', 'aws_rekognition', 'google_vision', 'azure_content_safety', 'human_review');
CREATE TYPE "ModerationScanType" AS ENUM ('text', 'image', 'combined');
CREATE TYPE "ModerationLabelCategory" AS ENUM ('safe', 'adult', 'sexual', 'violence', 'hate_or_harassment', 'self_harm', 'illegal_or_regulated', 'spam_or_scam', 'personal_data', 'unknown');
CREATE TYPE "ModerationSeverity" AS ENUM ('none', 'low', 'medium', 'high', 'critical');
CREATE TYPE "ModerationSuggestedAction" AS ENUM ('allow', 'review', 'limit', 'reject', 'remove', 'no_action');
CREATE TYPE "ModerationActionType" AS ENUM ('case_created', 'provider_scan_skipped', 'provider_scan_failed', 'provider_result_stored', 'mark_needs_review', 'approve', 'reject', 'limit', 'remove', 'restore', 'resolve', 'admin_note');

CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "contentType" "ModerationContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentOwnerId" TEXT,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'pending',
    "source" "ModerationCaseSource" NOT NULL DEFAULT 'automatic',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "visibility" "ModerationContentVisibility" NOT NULL DEFAULT 'public',
    "reason" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationResult" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "provider" "ModerationProviderName" NOT NULL DEFAULT 'none',
    "scanType" "ModerationScanType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'skipped',
    "labelsJson" JSONB,
    "scoresJson" JSONB,
    "highestSeverity" "ModerationSeverity" NOT NULL DEFAULT 'none',
    "suggestedAction" "ModerationSuggestedAction" NOT NULL DEFAULT 'no_action',
    "reason" TEXT,
    "rawJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "actorId" TEXT,
    "note" TEXT,
    "previousStatus" "ModerationCaseStatus",
    "nextStatus" "ModerationCaseStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModerationCase_status_priority_createdAt_idx" ON "ModerationCase"("status", "priority", "createdAt");
CREATE INDEX "ModerationCase_contentType_contentId_idx" ON "ModerationCase"("contentType", "contentId");
CREATE INDEX "ModerationCase_contentOwnerId_status_idx" ON "ModerationCase"("contentOwnerId", "status");
CREATE INDEX "ModerationCase_source_createdAt_idx" ON "ModerationCase"("source", "createdAt");
CREATE INDEX "ModerationCase_resolvedById_resolvedAt_idx" ON "ModerationCase"("resolvedById", "resolvedAt");
CREATE INDEX "ModerationResult_caseId_createdAt_idx" ON "ModerationResult"("caseId", "createdAt");
CREATE INDEX "ModerationResult_provider_createdAt_idx" ON "ModerationResult"("provider", "createdAt");
CREATE INDEX "ModerationResult_highestSeverity_suggestedAction_idx" ON "ModerationResult"("highestSeverity", "suggestedAction");
CREATE INDEX "ModerationAction_caseId_createdAt_idx" ON "ModerationAction"("caseId", "createdAt");
CREATE INDEX "ModerationAction_actorId_createdAt_idx" ON "ModerationAction"("actorId", "createdAt");
CREATE INDEX "ModerationAction_action_createdAt_idx" ON "ModerationAction"("action", "createdAt");

ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_contentOwnerId_fkey" FOREIGN KEY ("contentOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationResult" ADD CONSTRAINT "ModerationResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
