-- Allow an applicant to send a revised proposal after a previous one was declined or withdrawn.
-- Pending and accepted duplicates are still blocked in application code.
DROP INDEX IF EXISTS "TradeProposal_tradeId_applicantId_key";

CREATE INDEX IF NOT EXISTS "TradeProposal_tradeId_applicantId_status_idx"
  ON "TradeProposal"("tradeId", "applicantId", "status");
