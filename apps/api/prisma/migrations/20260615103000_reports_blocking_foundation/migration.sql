ALTER TYPE "ModerationContentType" ADD VALUE IF NOT EXISTS 'plan';
ALTER TYPE "ModerationContentType" ADD VALUE IF NOT EXISTS 'plan_place';

ALTER TABLE "Report" ADD COLUMN "moderationCaseId" TEXT;
CREATE UNIQUE INDEX "Report_moderationCaseId_key" ON "Report"("moderationCaseId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_moderationCaseId_fkey" FOREIGN KEY ("moderationCaseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
