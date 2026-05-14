ALTER TABLE "InventoryTemplate"
  ADD COLUMN "languageCode" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "countryCode" TEXT;

CREATE INDEX "InventoryTemplate_languageCode_status_sortOrder_idx" ON "InventoryTemplate"("languageCode", "status", "sortOrder");
CREATE INDEX "InventoryTemplate_countryCode_status_idx" ON "InventoryTemplate"("countryCode", "status");
