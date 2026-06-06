-- CHAIN2: structured Need/Offer availability and duration fields for future Trade Chain matching.
-- Existing timing/availability text fields stay as human-facing display fallbacks.
CREATE TYPE "InventoryAvailabilityPreset" AS ENUM ('today', 'this_week', 'this_month', 'flexible', 'custom');
CREATE TYPE "InventoryDurationPreset" AS ENUM ('min_15', 'min_30', 'hour_1', 'hour_2', 'half_day', 'day_1', 'flexible', 'not_sure', 'depends');

ALTER TABLE "Need"
  ADD COLUMN "availabilityPreset" "InventoryAvailabilityPreset",
  ADD COLUMN "availabilityStartAt" TIMESTAMP(3),
  ADD COLUMN "availabilityEndAt" TIMESTAMP(3),
  ADD COLUMN "estimatedDurationPreset" "InventoryDurationPreset",
  ADD COLUMN "estimatedDurationMinutes" INTEGER;

ALTER TABLE "Offer"
  ADD COLUMN "availabilityPreset" "InventoryAvailabilityPreset",
  ADD COLUMN "availabilityStartAt" TIMESTAMP(3),
  ADD COLUMN "availabilityEndAt" TIMESTAMP(3),
  ADD COLUMN "typicalDurationPreset" "InventoryDurationPreset",
  ADD COLUMN "typicalDurationMinutes" INTEGER;

ALTER TABLE "InventoryTemplate"
  ADD COLUMN "availabilityPreset" "InventoryAvailabilityPreset",
  ADD COLUMN "availabilityStartAt" TIMESTAMP(3),
  ADD COLUMN "availabilityEndAt" TIMESTAMP(3),
  ADD COLUMN "durationPreset" "InventoryDurationPreset",
  ADD COLUMN "durationMinutes" INTEGER;

CREATE INDEX "Need_availabilityPreset_idx" ON "Need"("availabilityPreset");
CREATE INDEX "Need_estimatedDurationPreset_idx" ON "Need"("estimatedDurationPreset");
CREATE INDEX "Offer_availabilityPreset_idx" ON "Offer"("availabilityPreset");
CREATE INDEX "Offer_typicalDurationPreset_idx" ON "Offer"("typicalDurationPreset");
CREATE INDEX "InventoryTemplate_availabilityPreset_idx" ON "InventoryTemplate"("availabilityPreset");
CREATE INDEX "InventoryTemplate_durationPreset_idx" ON "InventoryTemplate"("durationPreset");

ALTER TABLE "Need" ADD CONSTRAINT "Need_estimatedDurationMinutes_positive_check" CHECK ("estimatedDurationMinutes" IS NULL OR "estimatedDurationMinutes" > 0);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_typicalDurationMinutes_positive_check" CHECK ("typicalDurationMinutes" IS NULL OR "typicalDurationMinutes" > 0);
ALTER TABLE "InventoryTemplate" ADD CONSTRAINT "InventoryTemplate_durationMinutes_positive_check" CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0);
