CREATE TYPE "PlanPlaceMode" AS ENUM ('local', 'remote');

ALTER TABLE "PlanPlace" ADD COLUMN "mode" "PlanPlaceMode" NOT NULL DEFAULT 'local';

CREATE INDEX "PlanPlace_mode_idx" ON "PlanPlace"("mode");
