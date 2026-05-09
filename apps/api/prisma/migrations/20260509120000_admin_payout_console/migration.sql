-- Phase 20.4: admin payout console audit trail.
CREATE TABLE "AdminPayoutEvent" (
  "id" TEXT NOT NULL,
  "payoutRequestId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "previousStatus" "PayoutRequestStatus",
  "nextStatus" "PayoutRequestStatus",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminPayoutEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminPayoutEvent_payoutRequestId_createdAt_idx" ON "AdminPayoutEvent"("payoutRequestId", "createdAt");
CREATE INDEX "AdminPayoutEvent_adminId_createdAt_idx" ON "AdminPayoutEvent"("adminId", "createdAt");
CREATE INDEX "AdminPayoutEvent_action_createdAt_idx" ON "AdminPayoutEvent"("action", "createdAt");

ALTER TABLE "AdminPayoutEvent" ADD CONSTRAINT "AdminPayoutEvent_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminPayoutEvent" ADD CONSTRAINT "AdminPayoutEvent_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
