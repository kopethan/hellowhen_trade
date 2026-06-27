-- Manual Place translations.
-- Users write their reusable Place in a default language, then optionally add manual translated copy.

ALTER TYPE "InventoryTranslationTargetType" ADD VALUE IF NOT EXISTS 'place';

ALTER TABLE "Place" ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'en';
