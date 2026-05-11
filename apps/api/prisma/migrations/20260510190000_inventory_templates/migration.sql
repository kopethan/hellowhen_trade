-- Phase 23.7A: starter inventory templates for reusable Need/Offer library.


DO $$ BEGIN
  CREATE TYPE "InventoryItemType" AS ENUM ('service', 'goods', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryTemplateKind" AS ENUM ('need', 'offer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryTemplateSourceType" AS ENUM ('hellowhen', 'business', 'brand', 'partner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryTemplateStatus" AS ENUM ('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "kind" "InventoryTemplateKind" NOT NULL,
  "sourceType" "InventoryTemplateSourceType" NOT NULL DEFAULT 'hellowhen',
  "businessProfileId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "itemType" "InventoryItemType" NOT NULL DEFAULT 'service',
  "category" TEXT,
  "timing" TEXT,
  "availability" TEXT,
  "mode" "TradeExchangeMode",
  "locationLabel" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "includes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "InventoryTemplateStatus" NOT NULL DEFAULT 'active',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Need"
  ADD COLUMN IF NOT EXISTS "itemType" "InventoryItemType" NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS "sourceTemplateId" TEXT;

ALTER TABLE "Offer"
  ADD COLUMN IF NOT EXISTS "itemType" "InventoryItemType" NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS "sourceTemplateId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryTemplate_key_key" ON "InventoryTemplate"("key");
CREATE INDEX IF NOT EXISTS "InventoryTemplate_kind_status_itemType_sortOrder_idx" ON "InventoryTemplate"("kind", "status", "itemType", "sortOrder");
CREATE INDEX IF NOT EXISTS "InventoryTemplate_sourceType_status_idx" ON "InventoryTemplate"("sourceType", "status");
CREATE INDEX IF NOT EXISTS "InventoryTemplate_businessProfileId_status_idx" ON "InventoryTemplate"("businessProfileId", "status");
CREATE INDEX IF NOT EXISTS "InventoryTemplate_category_idx" ON "InventoryTemplate"("category");
CREATE INDEX IF NOT EXISTS "Need_itemType_idx" ON "Need"("itemType");
CREATE INDEX IF NOT EXISTS "Offer_itemType_idx" ON "Offer"("itemType");
CREATE INDEX IF NOT EXISTS "Need_sourceTemplateId_idx" ON "Need"("sourceTemplateId");
CREATE INDEX IF NOT EXISTS "Offer_sourceTemplateId_idx" ON "Offer"("sourceTemplateId");

DO $$ BEGIN
  ALTER TABLE "InventoryTemplate" ADD CONSTRAINT "InventoryTemplate_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Need" ADD CONSTRAINT "Need_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "InventoryTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "InventoryTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
