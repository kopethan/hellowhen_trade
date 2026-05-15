CREATE TYPE "PlanStatus" AS ENUM ('draft', 'open', 'full', 'started', 'completed', 'cancelled', 'expired', 'hidden');
CREATE TYPE "PlanJoinApprovalMode" AS ENUM ('owner_approval', 'automatic');
CREATE TYPE "PlanParticipantStatus" AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'left', 'removed');

ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'plan';
ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'plan_place';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'plan';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'plan_place';

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mode" "TradeExchangeMode",
    "locationLabel" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "maxParticipants" INTEGER,
    "joinApprovalMode" "PlanJoinApprovalMode" NOT NULL DEFAULT 'owner_approval',
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanPlace" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "addressPublicText" TEXT,
    "addressPrivateText" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPlace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanParticipant" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "PlanParticipantStatus" NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanPlace" ADD CONSTRAINT "PlanPlace_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanParticipant" ADD CONSTRAINT "PlanParticipant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanParticipant" ADD CONSTRAINT "PlanParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanParticipant" ADD CONSTRAINT "PlanParticipant_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Plan_status_startsAt_idx" ON "Plan"("status", "startsAt");
CREATE INDEX "Plan_ownerId_status_startsAt_idx" ON "Plan"("ownerId", "status", "startsAt");
CREATE INDEX "Plan_category_idx" ON "Plan"("category");
CREATE INDEX "Plan_mode_idx" ON "Plan"("mode");
CREATE INDEX "PlanPlace_planId_order_idx" ON "PlanPlace"("planId", "order");
CREATE INDEX "PlanPlace_startsAt_idx" ON "PlanPlace"("startsAt");
CREATE UNIQUE INDEX "PlanParticipant_planId_userId_key" ON "PlanParticipant"("planId", "userId");
CREATE INDEX "PlanParticipant_userId_status_createdAt_idx" ON "PlanParticipant"("userId", "status", "createdAt");
CREATE INDEX "PlanParticipant_planId_status_createdAt_idx" ON "PlanParticipant"("planId", "status", "createdAt");
CREATE INDEX "PlanParticipant_decidedById_decidedAt_idx" ON "PlanParticipant"("decidedById", "decidedAt");
