-- Phase 13: profile pictures use the same media pipeline as Need/Offer images.
-- Existing string avatar URLs are kept for Google/imported avatars. New mobile uploads
-- store avatarMediaId so admin moderation can clear the profile picture if needed.

ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'profile';

ALTER TABLE "Profile"
  ADD COLUMN "avatarMediaId" TEXT;

CREATE INDEX "Profile_avatarMediaId_idx" ON "Profile"("avatarMediaId");
