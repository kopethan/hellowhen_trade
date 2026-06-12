-- AGENDA1: private Plus-only Hellowhen Agenda item foundation.
-- This stores personal calendar-style organization items only.
-- It does not notify other users, create bookings, expose shared availability,
-- or integrate with Google Calendar / Apple Calendar.
CREATE TYPE "AgendaItemSourceType" AS ENUM (
  'trade',
  'need',
  'offer',
  'proposal',
  'deal',
  'user',
  'saved_item',
  'custom'
);

CREATE TYPE "AgendaItemType" AS ENUM (
  'trade',
  'need',
  'offer',
  'proposal',
  'deal',
  'person',
  'reminder'
);

CREATE TYPE "AgendaItemStatus" AS ENUM (
  'active',
  'done',
  'cancelled'
);

CREATE TABLE "AgendaItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceType" "AgendaItemSourceType" NOT NULL DEFAULT 'custom',
  "sourceId" TEXT,
  "itemType" "AgendaItemType" NOT NULL DEFAULT 'reminder',
  "title" TEXT NOT NULL,
  "note" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "status" "AgendaItemStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgendaItem_userId_startAt_idx" ON "AgendaItem"("userId", "startAt");
CREATE INDEX "AgendaItem_userId_status_startAt_idx" ON "AgendaItem"("userId", "status", "startAt");
CREATE INDEX "AgendaItem_userId_itemType_startAt_idx" ON "AgendaItem"("userId", "itemType", "startAt");
CREATE INDEX "AgendaItem_sourceType_sourceId_idx" ON "AgendaItem"("sourceType", "sourceId");
CREATE INDEX "AgendaItem_createdAt_idx" ON "AgendaItem"("createdAt");

ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_linked_source_requires_id_check" CHECK (
  ("sourceType" = 'custom' AND "sourceId" IS NULL)
  OR
  ("sourceType" <> 'custom' AND "sourceId" IS NOT NULL)
);

ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_end_after_start_check" CHECK (
  "endAt" IS NULL OR "endAt" >= "startAt"
);
