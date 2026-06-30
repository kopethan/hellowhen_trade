-- Add optional persisted Place static map template assignment.
ALTER TABLE "Place" ADD COLUMN "staticMapTemplateFamily" TEXT;
ALTER TABLE "Place" ADD COLUMN "staticMapTemplateSeed" TEXT;

ALTER TABLE "PlanPlace" ADD COLUMN "staticMapTemplateFamily" TEXT;
ALTER TABLE "PlanPlace" ADD COLUMN "staticMapTemplateSeed" TEXT;

CREATE INDEX "Place_staticMapTemplateFamily_idx" ON "Place"("staticMapTemplateFamily");
CREATE INDEX "PlanPlace_staticMapTemplateFamily_idx" ON "PlanPlace"("staticMapTemplateFamily");
