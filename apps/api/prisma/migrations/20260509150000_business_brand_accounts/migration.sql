-- Phase 21.6: business and brand profile accounts.
-- This migration depends on the Phase 21.2 money-provider enums/tables.

DO $$ BEGIN
  CREATE TYPE "BusinessProfileType" AS ENUM ('business', 'agency', 'brand', 'enterprise');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BusinessProfileStatus" AS ENUM ('draft', 'active', 'pending_review', 'verified', 'restricted', 'disabled', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BusinessProfileMemberRole" AS ENUM ('owner', 'admin', 'finance', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "BusinessProfile" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" "BusinessProfileType" NOT NULL DEFAULT 'business',
  "status" "BusinessProfileStatus" NOT NULL DEFAULT 'active',
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "handle" TEXT,
  "description" TEXT,
  "websiteUrl" TEXT,
  "countryCode" TEXT,
  "preferredCurrency" TEXT NOT NULL DEFAULT 'eur',
  "verificationProvider" "MoneyProviderName",
  "verificationProviderStatus" "MoneyProviderAccountStatus",
  "verifiedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BusinessProfileMember" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "BusinessProfileMemberRole" NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessProfileMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Need"
  ADD COLUMN IF NOT EXISTS "businessProfileId" TEXT;

ALTER TABLE "Offer"
  ADD COLUMN IF NOT EXISTS "businessProfileId" TEXT;

ALTER TABLE "Trade"
  ADD COLUMN IF NOT EXISTS "businessProfileId" TEXT;

ALTER TABLE "MoneyProviderAccount"
  ADD COLUMN IF NOT EXISTS "businessProfileId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessProfile_handle_key" ON "BusinessProfile"("handle");
CREATE INDEX IF NOT EXISTS "BusinessProfile_ownerId_status_idx" ON "BusinessProfile"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "BusinessProfile_type_status_idx" ON "BusinessProfile"("type", "status");
CREATE INDEX IF NOT EXISTS "BusinessProfile_countryCode_idx" ON "BusinessProfile"("countryCode");
CREATE INDEX IF NOT EXISTS "BusinessProfile_verificationProvider_verificationProviderStatus_idx" ON "BusinessProfile"("verificationProvider", "verificationProviderStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessProfileMember_businessProfileId_userId_key" ON "BusinessProfileMember"("businessProfileId", "userId");
CREATE INDEX IF NOT EXISTS "BusinessProfileMember_userId_role_idx" ON "BusinessProfileMember"("userId", "role");
CREATE INDEX IF NOT EXISTS "BusinessProfileMember_businessProfileId_role_idx" ON "BusinessProfileMember"("businessProfileId", "role");

CREATE INDEX IF NOT EXISTS "Need_businessProfileId_status_idx" ON "Need"("businessProfileId", "status");
CREATE INDEX IF NOT EXISTS "Offer_businessProfileId_status_idx" ON "Offer"("businessProfileId", "status");
CREATE INDEX IF NOT EXISTS "Trade_businessProfileId_status_idx" ON "Trade"("businessProfileId", "status");
CREATE INDEX IF NOT EXISTS "MoneyProviderAccount_businessProfileId_provider_idx" ON "MoneyProviderAccount"("businessProfileId", "provider");

DO $$ BEGIN
  ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BusinessProfileMember" ADD CONSTRAINT "BusinessProfileMember_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BusinessProfileMember" ADD CONSTRAINT "BusinessProfileMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Need" ADD CONSTRAINT "Need_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Offer" ADD CONSTRAINT "Offer_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Trade" ADD CONSTRAINT "Trade_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyProviderAccount" ADD CONSTRAINT "MoneyProviderAccount_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
