-- Phase 21.2: Airwallex sandbox connected-account scaffolding.
-- This migration intentionally keeps Stripe legacy tables and adds provider-neutral money records.

DO $$ BEGIN
  CREATE TYPE "MoneyProviderName" AS ENUM ('none', 'stripe', 'airwallex');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MoneyProviderAccountType" AS ENUM ('individual', 'business', 'brand');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MoneyProviderAccountStatus" AS ENUM ('not_started', 'onboarding', 'pending', 'active', 'restricted', 'disabled', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MoneyProviderTransactionType" AS ENUM ('payin', 'internal_transfer', 'trade_hold', 'trade_release', 'platform_fee', 'payout', 'refund', 'reversal', 'dispute_hold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MoneyProviderTransactionStatus" AS ENUM ('pending', 'succeeded', 'failed', 'canceled', 'reversed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MoneyProviderEventProcessingStatus" AS ENUM ('received', 'processed', 'ignored', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "PayoutRequest"
  ADD COLUMN IF NOT EXISTS "provider" "MoneyProviderName",
  ADD COLUMN IF NOT EXISTS "providerAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerTransferId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPayoutId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerFailureCode" TEXT,
  ADD COLUMN IF NOT EXISTS "providerFailureMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "providerExternalStatus" TEXT;

CREATE TABLE IF NOT EXISTS "MoneyProviderAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "MoneyProviderName" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "accountType" "MoneyProviderAccountType" NOT NULL DEFAULT 'individual',
  "status" "MoneyProviderAccountStatus" NOT NULL DEFAULT 'onboarding',
  "country" TEXT,
  "defaultCurrency" TEXT,
  "capabilities" JSONB,
  "requirements" JSONB,
  "rawProviderStatus" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MoneyProviderAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MoneyProviderWalletBalance" (
  "id" TEXT NOT NULL,
  "moneyProviderAccountId" TEXT NOT NULL,
  "provider" "MoneyProviderName" NOT NULL,
  "currency" TEXT NOT NULL,
  "availableCents" INTEGER NOT NULL DEFAULT 0,
  "reservedCents" INTEGER NOT NULL DEFAULT 0,
  "pendingCents" INTEGER NOT NULL DEFAULT 0,
  "externalUpdatedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MoneyProviderWalletBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MoneyProviderTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "tradeId" TEXT,
  "payoutRequestId" TEXT,
  "provider" "MoneyProviderName" NOT NULL,
  "providerTransactionId" TEXT NOT NULL,
  "type" "MoneyProviderTransactionType" NOT NULL,
  "status" "MoneyProviderTransactionStatus" NOT NULL DEFAULT 'pending',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'eur',
  "moneyProviderAccountId" TEXT,
  "counterpartyProviderAccountId" TEXT,
  "rawProviderStatus" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MoneyProviderTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MoneyProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" "MoneyProviderName" NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerAccountId" TEXT,
  "status" "MoneyProviderEventProcessingStatus" NOT NULL DEFAULT 'received',
  "payload" JSONB,
  "error" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoneyProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MoneyProviderAccount_provider_providerAccountId_key" ON "MoneyProviderAccount"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "MoneyProviderAccount_userId_provider_idx" ON "MoneyProviderAccount"("userId", "provider");
CREATE INDEX IF NOT EXISTS "MoneyProviderAccount_provider_status_updatedAt_idx" ON "MoneyProviderAccount"("provider", "status", "updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "MoneyProviderWalletBalance_moneyProviderAccountId_currency_key" ON "MoneyProviderWalletBalance"("moneyProviderAccountId", "currency");
CREATE INDEX IF NOT EXISTS "MoneyProviderWalletBalance_provider_currency_idx" ON "MoneyProviderWalletBalance"("provider", "currency");
CREATE INDEX IF NOT EXISTS "MoneyProviderWalletBalance_lastSyncedAt_idx" ON "MoneyProviderWalletBalance"("lastSyncedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "MoneyProviderTransaction_provider_providerTransactionId_key" ON "MoneyProviderTransaction"("provider", "providerTransactionId");
CREATE INDEX IF NOT EXISTS "MoneyProviderTransaction_userId_createdAt_idx" ON "MoneyProviderTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MoneyProviderTransaction_tradeId_createdAt_idx" ON "MoneyProviderTransaction"("tradeId", "createdAt");
CREATE INDEX IF NOT EXISTS "MoneyProviderTransaction_payoutRequestId_createdAt_idx" ON "MoneyProviderTransaction"("payoutRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "MoneyProviderTransaction_provider_type_status_createdAt_idx" ON "MoneyProviderTransaction"("provider", "type", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "MoneyProviderEvent_provider_providerEventId_key" ON "MoneyProviderEvent"("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "MoneyProviderEvent_provider_eventType_createdAt_idx" ON "MoneyProviderEvent"("provider", "eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "MoneyProviderEvent_providerAccountId_createdAt_idx" ON "MoneyProviderEvent"("providerAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "MoneyProviderEvent_status_createdAt_idx" ON "MoneyProviderEvent"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "PayoutRequest_provider_status_idx" ON "PayoutRequest"("provider", "status");
CREATE INDEX IF NOT EXISTS "PayoutRequest_providerAccountId_status_idx" ON "PayoutRequest"("providerAccountId", "status");
CREATE INDEX IF NOT EXISTS "PayoutRequest_providerTransferId_idx" ON "PayoutRequest"("providerTransferId");
CREATE INDEX IF NOT EXISTS "PayoutRequest_providerPayoutId_idx" ON "PayoutRequest"("providerPayoutId");

DO $$ BEGIN
  ALTER TABLE "MoneyProviderAccount" ADD CONSTRAINT "MoneyProviderAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyProviderWalletBalance" ADD CONSTRAINT "MoneyProviderWalletBalance_moneyProviderAccountId_fkey" FOREIGN KEY ("moneyProviderAccountId") REFERENCES "MoneyProviderAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyProviderTransaction" ADD CONSTRAINT "MoneyProviderTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyProviderTransaction" ADD CONSTRAINT "MoneyProviderTransaction_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyProviderTransaction" ADD CONSTRAINT "MoneyProviderTransaction_moneyProviderAccountId_fkey" FOREIGN KEY ("moneyProviderAccountId") REFERENCES "MoneyProviderAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyProviderTransaction" ADD CONSTRAINT "MoneyProviderTransaction_counterpartyProviderAccountId_fkey" FOREIGN KEY ("counterpartyProviderAccountId") REFERENCES "MoneyProviderAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "MoneyProviderAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
