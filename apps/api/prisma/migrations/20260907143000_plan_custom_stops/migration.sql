CREATE TYPE "PlanPlaceKind" AS ENUM ('place', 'pause', 'free_time', 'meeting_point', 'custom');

ALTER TABLE "PlanPlace"
ADD COLUMN "kind" "PlanPlaceKind" NOT NULL DEFAULT 'place';

CREATE INDEX "PlanPlace_kind_idx" ON "PlanPlace"("kind");
