-- Add support-escalation tracking for moderation reports.
ALTER TABLE "Report" ADD COLUMN "escalatedSupportTicketId" TEXT;
ALTER TABLE "Report" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "escalatedById" TEXT;

CREATE INDEX "Report_escalatedSupportTicketId_idx" ON "Report"("escalatedSupportTicketId");
CREATE INDEX "Report_escalatedById_escalatedAt_idx" ON "Report"("escalatedById", "escalatedAt");
