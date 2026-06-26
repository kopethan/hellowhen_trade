-- PLAN-PROD1: reusable Place foundation for production Plans.
-- Places are reusable library items. PlanPlace remains the per-plan snapshot
-- so existing/future plans do not silently change when a saved Place is edited.
ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'place';

CREATE TYPE "PlaceSource" AS ENUM (
  'user',
  'hellowhen_library'
);

CREATE TYPE "PlaceStatus" AS ENUM (
  'draft',
  'active',
  'archived',
  'hidden'
);

CREATE TYPE "PlaceVisibility" AS ENUM (
  'private',
  'public',
  'library'
);

CREATE TABLE "Place" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "source" "PlaceSource" NOT NULL DEFAULT 'user',
  "status" "PlaceStatus" NOT NULL DEFAULT 'active',
  "visibility" "PlaceVisibility" NOT NULL DEFAULT 'private',
  "mode" "PlanPlaceMode" NOT NULL DEFAULT 'local',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "areaLabel" TEXT,
  "addressPublicText" TEXT,
  "addressPrivateText" TEXT,
  "onlineLabel" TEXT,
  "onlineUrl" TEXT,
  "defaultDurationMinutes" INTEGER,
  "defaultNote" TEXT,
  "defaultMeetingInstructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlanPlace" ADD COLUMN "placeId" TEXT;
ALTER TABLE "PlanPlace" ADD COLUMN "onlineLabel" TEXT;
ALTER TABLE "PlanPlace" ADD COLUMN "onlineUrl" TEXT;

CREATE INDEX "Place_ownerId_status_updatedAt_idx" ON "Place"("ownerId", "status", "updatedAt");
CREATE INDEX "Place_source_status_visibility_idx" ON "Place"("source", "status", "visibility");
CREATE INDEX "Place_mode_idx" ON "Place"("mode");
CREATE INDEX "Place_category_idx" ON "Place"("category");
CREATE INDEX "PlanPlace_placeId_idx" ON "PlanPlace"("placeId");

ALTER TABLE "Place" ADD CONSTRAINT "Place_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanPlace" ADD CONSTRAINT "PlanPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Place" ADD CONSTRAINT "Place_user_source_requires_owner_check" CHECK (
  ("source" = 'user' AND "ownerId" IS NOT NULL)
  OR
  ("source" = 'hellowhen_library')
);
