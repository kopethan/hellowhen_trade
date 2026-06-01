-- Content Intelligence C1: rule-based classification storage only.
-- No public labels, no AI provider calls, and no automatic moderation actions are enabled by this migration.

CREATE TYPE "ContentClassificationTargetType" AS ENUM (
  'need',
  'offer',
  'trade',
  'profile',
  'business_template',
  'business_need',
  'business_offer',
  'business_campaign'
);

CREATE TYPE "ContentClassificationSource" AS ENUM ('rules', 'ai', 'admin');

CREATE TYPE "ContentClassificationStatus" AS ENUM (
  'pending',
  'completed',
  'failed',
  'reviewed',
  'overridden'
);

CREATE TYPE "ContentSafetyCategory" AS ENUM (
  'safe',
  'adult',
  'sexual',
  'violence',
  'hate_or_harassment',
  'self_harm',
  'illegal_or_regulated',
  'spam_or_scam',
  'unknown'
);

CREATE TYPE "ContentSafetySeverity" AS ENUM ('none', 'low', 'medium', 'high', 'critical');

CREATE TYPE "ContentSuggestedAction" AS ENUM ('allow', 'review', 'hide');

CREATE TYPE "ContentDomainCategory" AS ENUM (
  'design',
  'development',
  'photography_video',
  'writing_copywriting',
  'translation_language',
  'marketing_social',
  'business_startup',
  'education_tutoring',
  'local_help',
  'events_community',
  'creative_art',
  'health_wellness',
  'home_practical',
  'other'
);

CREATE TABLE "ContentClassification" (
  "id" TEXT NOT NULL,
  "targetType" "ContentClassificationTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "source" "ContentClassificationSource" NOT NULL DEFAULT 'rules',
  "status" "ContentClassificationStatus" NOT NULL DEFAULT 'pending',
  "userCategory" TEXT,
  "systemCategory" "ContentDomainCategory",
  "categoryConfidence" DOUBLE PRECISION,
  "categoryMismatch" BOOLEAN NOT NULL DEFAULT false,
  "suggestedTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "suggestedNewTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "safetyCategory" "ContentSafetyCategory" NOT NULL DEFAULT 'unknown',
  "safetySeverity" "ContentSafetySeverity" NOT NULL DEFAULT 'none',
  "adultRelated" BOOLEAN NOT NULL DEFAULT false,
  "childSafe" BOOLEAN NOT NULL DEFAULT true,
  "spamOrScamRisk" BOOLEAN NOT NULL DEFAULT false,
  "regulatedRisk" BOOLEAN NOT NULL DEFAULT false,
  "suggestedAction" "ContentSuggestedAction" NOT NULL DEFAULT 'allow',
  "reason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentClassification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentClassification_targetType_targetId_source_key"
  ON "ContentClassification"("targetType", "targetId", "source");

CREATE INDEX "ContentClassification_targetType_targetId_idx"
  ON "ContentClassification"("targetType", "targetId");

CREATE INDEX "ContentClassification_status_updatedAt_idx"
  ON "ContentClassification"("status", "updatedAt");

CREATE INDEX "ContentClassification_safetyCategory_safetySeverity_idx"
  ON "ContentClassification"("safetyCategory", "safetySeverity");

CREATE INDEX "ContentClassification_systemCategory_categoryMismatch_idx"
  ON "ContentClassification"("systemCategory", "categoryMismatch");

CREATE INDEX "ContentClassification_suggestedAction_updatedAt_idx"
  ON "ContentClassification"("suggestedAction", "updatedAt");

CREATE INDEX "ContentClassification_reviewedById_reviewedAt_idx"
  ON "ContentClassification"("reviewedById", "reviewedAt");

ALTER TABLE "ContentClassification"
  ADD CONSTRAINT "ContentClassification_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
