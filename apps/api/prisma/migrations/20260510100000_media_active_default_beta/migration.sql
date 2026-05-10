-- Phase 23.0E: first beta uses immediate image visibility.
-- Uploads are active by default; admins can still flag/remove reported media.
ALTER TABLE "MediaAsset"
  ALTER COLUMN "status" SET DEFAULT 'active';

UPDATE "MediaAsset"
SET "status" = 'active'
WHERE "status" = 'pending_review';
