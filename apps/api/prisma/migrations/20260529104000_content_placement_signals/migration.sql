-- CreateEnum
CREATE TYPE "ContentPlacementSignalStatus" AS ENUM ('pending', 'active', 'disabled', 'archived');

-- CreateTable
CREATE TABLE "ContentPlacementSignal" (
    "id" TEXT NOT NULL,
    "targetType" "ContentClassificationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "source" "ContentClassificationSource" NOT NULL DEFAULT 'admin',
    "status" "ContentPlacementSignalStatus" NOT NULL DEFAULT 'pending',
    "sourceClassificationId" TEXT,
    "category" "ContentDomainCategory",
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedNewTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "safetyCategory" "ContentSafetyCategory" NOT NULL DEFAULT 'unknown',
    "safetySeverity" "ContentSafetySeverity" NOT NULL DEFAULT 'none',
    "adultRelated" BOOLEAN NOT NULL DEFAULT false,
    "childSafe" BOOLEAN NOT NULL DEFAULT true,
    "spamOrScamRisk" BOOLEAN NOT NULL DEFAULT false,
    "regulatedRisk" BOOLEAN NOT NULL DEFAULT false,
    "contextualEligible" BOOLEAN NOT NULL DEFAULT false,
    "businessPlacementEligible" BOOLEAN NOT NULL DEFAULT false,
    "adsPlacementEligible" BOOLEAN NOT NULL DEFAULT false,
    "surfaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlacementSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlacementSignal_targetType_targetId_key" ON "ContentPlacementSignal"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ContentPlacementSignal_status_updatedAt_idx" ON "ContentPlacementSignal"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ContentPlacementSignal_category_status_idx" ON "ContentPlacementSignal"("category", "status");

-- CreateIndex
CREATE INDEX "ContentPlacementSignal_contextualEligible_updatedAt_idx" ON "ContentPlacementSignal"("contextualEligible", "updatedAt");

-- CreateIndex
CREATE INDEX "ContentPlacementSignal_businessPlacementEligible_updatedAt_idx" ON "ContentPlacementSignal"("businessPlacementEligible", "updatedAt");

-- CreateIndex
CREATE INDEX "ContentPlacementSignal_adsPlacementEligible_updatedAt_idx" ON "ContentPlacementSignal"("adsPlacementEligible", "updatedAt");

-- CreateIndex
CREATE INDEX "ContentPlacementSignal_sourceClassificationId_idx" ON "ContentPlacementSignal"("sourceClassificationId");

-- CreateIndex
CREATE INDEX "ContentPlacementSignal_approvedById_approvedAt_idx" ON "ContentPlacementSignal"("approvedById", "approvedAt");

-- AddForeignKey
ALTER TABLE "ContentPlacementSignal" ADD CONSTRAINT "ContentPlacementSignal_sourceClassificationId_fkey" FOREIGN KEY ("sourceClassificationId") REFERENCES "ContentClassification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlacementSignal" ADD CONSTRAINT "ContentPlacementSignal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
