-- Phase 3: new image uploads enter admin review by default.
-- Existing active media remains active. Only future uploads default to pending_review.
-- Public deck responses already show only active media; owners/admins can still see pending/flagged media.

ALTER TABLE "MediaAsset"
  ALTER COLUMN "status" SET DEFAULT 'pending_review';
