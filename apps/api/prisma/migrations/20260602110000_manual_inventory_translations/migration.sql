-- Manual Need/Offer translations.
-- Users write their original Need/Offer in a default language, then optionally add manual translated copy.

CREATE TYPE "InventoryTranslationTargetType" AS ENUM ('need', 'offer');

ALTER TABLE "Need" ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Offer" ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'en';

CREATE TABLE "InventoryTranslation" (
  "id" TEXT NOT NULL,
  "targetType" "InventoryTranslationTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "languageCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryTranslation_targetType_targetId_languageCode_key"
  ON "InventoryTranslation"("targetType", "targetId", "languageCode");

CREATE INDEX "InventoryTranslation_targetType_targetId_idx"
  ON "InventoryTranslation"("targetType", "targetId");

CREATE INDEX "InventoryTranslation_languageCode_idx"
  ON "InventoryTranslation"("languageCode");

CREATE INDEX "InventoryTranslation_createdById_idx"
  ON "InventoryTranslation"("createdById");

ALTER TABLE "InventoryTranslation"
  ADD CONSTRAINT "InventoryTranslation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
