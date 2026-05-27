-- Hidden Business campaign/opportunity skeleton.
-- This groups approved Business-owned content for future opportunities.
-- It intentionally does not add campaign budgets, credits, tokens, tickets,
-- checks, wallet balances, payouts, provider money flow, or public campaign feed logic.
CREATE TYPE "BusinessCampaignOpportunityType" AS ENUM (
  'collaboration',
  'creator_request',
  'service_request',
  'community',
  'research',
  'other'
);

CREATE TYPE "BusinessCampaignStatus" AS ENUM (
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'paused',
  'archived',
  'completed'
);

CREATE TYPE "BusinessCampaignItemTargetType" AS ENUM (
  'need',
  'offer',
  'inventory_template'
);

CREATE TYPE "BusinessCampaignApplicationStatus" AS ENUM (
  'pending',
  'reviewed',
  'accepted',
  'declined',
  'withdrawn',
  'archived'
);

CREATE TABLE "BusinessCampaign" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "opportunityType" "BusinessCampaignOpportunityType" NOT NULL DEFAULT 'collaboration',
  "status" "BusinessCampaignStatus" NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "description" TEXT NOT NULL,
  "eligibility" TEXT,
  "deliverables" TEXT,
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

  CONSTRAINT "BusinessCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessCampaignItem" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "targetType" "BusinessCampaignItemTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "note" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessCampaignItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessCampaignApplication" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "status" "BusinessCampaignApplicationStatus" NOT NULL DEFAULT 'pending',
  "message" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessCampaignApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessCampaign_businessProfileId_status_idx" ON "BusinessCampaign"("businessProfileId", "status");
CREATE INDEX "BusinessCampaign_opportunityType_status_idx" ON "BusinessCampaign"("opportunityType", "status");
CREATE INDEX "BusinessCampaign_createdById_createdAt_idx" ON "BusinessCampaign"("createdById", "createdAt");
CREATE INDEX "BusinessCampaign_reviewedById_reviewedAt_idx" ON "BusinessCampaign"("reviewedById", "reviewedAt");
CREATE INDEX "BusinessCampaign_startsAt_endsAt_idx" ON "BusinessCampaign"("startsAt", "endsAt");

CREATE UNIQUE INDEX "BusinessCampaignItem_campaignId_targetType_targetId_key" ON "BusinessCampaignItem"("campaignId", "targetType", "targetId");
CREATE INDEX "BusinessCampaignItem_campaignId_sortOrder_idx" ON "BusinessCampaignItem"("campaignId", "sortOrder");
CREATE INDEX "BusinessCampaignItem_targetType_targetId_idx" ON "BusinessCampaignItem"("targetType", "targetId");

CREATE UNIQUE INDEX "BusinessCampaignApplication_campaignId_applicantId_key" ON "BusinessCampaignApplication"("campaignId", "applicantId");
CREATE INDEX "BusinessCampaignApplication_campaignId_status_idx" ON "BusinessCampaignApplication"("campaignId", "status");
CREATE INDEX "BusinessCampaignApplication_applicantId_status_idx" ON "BusinessCampaignApplication"("applicantId", "status");
CREATE INDEX "BusinessCampaignApplication_reviewedById_reviewedAt_idx" ON "BusinessCampaignApplication"("reviewedById", "reviewedAt");

ALTER TABLE "BusinessCampaign"
  ADD CONSTRAINT "BusinessCampaign_businessProfileId_fkey"
  FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessCampaign"
  ADD CONSTRAINT "BusinessCampaign_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessCampaign"
  ADD CONSTRAINT "BusinessCampaign_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessCampaignItem"
  ADD CONSTRAINT "BusinessCampaignItem_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "BusinessCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessCampaignApplication"
  ADD CONSTRAINT "BusinessCampaignApplication_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "BusinessCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessCampaignApplication"
  ADD CONSTRAINT "BusinessCampaignApplication_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessCampaignApplication"
  ADD CONSTRAINT "BusinessCampaignApplication_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
