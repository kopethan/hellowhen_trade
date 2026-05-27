-- Hidden first-party Business sponsored placement foundation.
-- This only stores reviewed placement intent. It does not add ad SDKs,
-- impression/click tracking, campaign budgets, credits, tokens, or money flow.
CREATE TYPE "BusinessSponsoredPlacementSurface" AS ENUM (
  'trades_feed',
  'starter_library',
  'needs_list',
  'offers_list',
  'business_profile'
);

CREATE TYPE "BusinessSponsoredPlacementTargetType" AS ENUM (
  'need',
  'offer',
  'inventory_template'
);

CREATE TYPE "BusinessSponsoredPlacementStatus" AS ENUM (
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'paused',
  'archived'
);

CREATE TABLE "BusinessSponsoredPlacement" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "targetType" "BusinessSponsoredPlacementTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "surface" "BusinessSponsoredPlacementSurface" NOT NULL,
  "status" "BusinessSponsoredPlacementStatus" NOT NULL DEFAULT 'draft',
  "label" TEXT NOT NULL DEFAULT 'Sponsored',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessSponsoredPlacement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessSponsoredPlacement_businessProfileId_targetType_targetId_surface_key"
  ON "BusinessSponsoredPlacement"("businessProfileId", "targetType", "targetId", "surface");
CREATE INDEX "BusinessSponsoredPlacement_businessProfileId_status_idx" ON "BusinessSponsoredPlacement"("businessProfileId", "status");
CREATE INDEX "BusinessSponsoredPlacement_targetType_targetId_idx" ON "BusinessSponsoredPlacement"("targetType", "targetId");
CREATE INDEX "BusinessSponsoredPlacement_surface_status_priority_idx" ON "BusinessSponsoredPlacement"("surface", "status", "priority");
CREATE INDEX "BusinessSponsoredPlacement_createdById_createdAt_idx" ON "BusinessSponsoredPlacement"("createdById", "createdAt");
CREATE INDEX "BusinessSponsoredPlacement_reviewedById_reviewedAt_idx" ON "BusinessSponsoredPlacement"("reviewedById", "reviewedAt");

ALTER TABLE "BusinessSponsoredPlacement"
  ADD CONSTRAINT "BusinessSponsoredPlacement_businessProfileId_fkey"
  FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessSponsoredPlacement"
  ADD CONSTRAINT "BusinessSponsoredPlacement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessSponsoredPlacement"
  ADD CONSTRAINT "BusinessSponsoredPlacement_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
