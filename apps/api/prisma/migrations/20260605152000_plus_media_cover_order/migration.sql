-- Add stable media ordering and a single cover marker for Plus visual customization.
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "isCover" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "MediaAsset_entityType_entityId_isCover_sortOrder_idx"
  ON "MediaAsset"("entityType", "entityId", "isCover", "sortOrder");
