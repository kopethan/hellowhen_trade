-- Business budget sandbox scaffolding only.
-- This migration does not move money, create wallet balances, or connect to a real provider flow.

CREATE TYPE "BusinessBudgetStatus" AS ENUM (
  'draft',
  'pending_provider_review',
  'pending_admin_review',
  'sandbox_ready',
  'rejected',
  'paused',
  'archived'
);

CREATE TYPE "BusinessBudgetLedgerEntryType" AS ENUM (
  'requested',
  'reserved_preview',
  'spend_preview',
  'refund_preview',
  'platform_fee_preview',
  'adjustment'
);

CREATE TABLE "BusinessBudget" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "campaignId" TEXT,
  "provider" "MoneyProviderName" NOT NULL DEFAULT 'none',
  "providerAccountId" TEXT,
  "status" "BusinessBudgetStatus" NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'eur',
  "requestedAmountCents" INTEGER NOT NULL DEFAULT 0,
  "reservedAmountCents" INTEGER NOT NULL DEFAULT 0,
  "spentAmountCents" INTEGER NOT NULL DEFAULT 0,
  "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
  "platformFeeRateBps" INTEGER NOT NULL DEFAULT 1000,
  "purpose" TEXT,
  "riskNote" TEXT,
  "providerExternalId" TEXT,
  "providerReviewNote" TEXT,
  "createdById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessBudgetLedgerEntry" (
  "id" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "type" "BusinessBudgetLedgerEntryType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'eur',
  "note" TEXT,
  "providerTransactionId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BusinessBudgetLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessBudget_businessProfileId_status_idx" ON "BusinessBudget"("businessProfileId", "status");
CREATE INDEX "BusinessBudget_campaignId_status_idx" ON "BusinessBudget"("campaignId", "status");
CREATE INDEX "BusinessBudget_provider_status_idx" ON "BusinessBudget"("provider", "status");
CREATE INDEX "BusinessBudget_providerAccountId_status_idx" ON "BusinessBudget"("providerAccountId", "status");
CREATE INDEX "BusinessBudget_createdById_createdAt_idx" ON "BusinessBudget"("createdById", "createdAt");
CREATE INDEX "BusinessBudget_reviewedById_reviewedAt_idx" ON "BusinessBudget"("reviewedById", "reviewedAt");

CREATE INDEX "BusinessBudgetLedgerEntry_budgetId_createdAt_idx" ON "BusinessBudgetLedgerEntry"("budgetId", "createdAt");
CREATE INDEX "BusinessBudgetLedgerEntry_type_createdAt_idx" ON "BusinessBudgetLedgerEntry"("type", "createdAt");
CREATE INDEX "BusinessBudgetLedgerEntry_providerTransactionId_idx" ON "BusinessBudgetLedgerEntry"("providerTransactionId");
CREATE INDEX "BusinessBudgetLedgerEntry_createdById_createdAt_idx" ON "BusinessBudgetLedgerEntry"("createdById", "createdAt");

ALTER TABLE "BusinessBudget" ADD CONSTRAINT "BusinessBudget_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessBudget" ADD CONSTRAINT "BusinessBudget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BusinessCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessBudget" ADD CONSTRAINT "BusinessBudget_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "MoneyProviderAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessBudget" ADD CONSTRAINT "BusinessBudget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessBudget" ADD CONSTRAINT "BusinessBudget_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessBudgetLedgerEntry" ADD CONSTRAINT "BusinessBudgetLedgerEntry_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "BusinessBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessBudgetLedgerEntry" ADD CONSTRAINT "BusinessBudgetLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
