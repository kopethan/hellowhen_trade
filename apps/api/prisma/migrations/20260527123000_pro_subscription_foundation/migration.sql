-- Hidden Pro/subscription database foundation.
-- First launch remains Free only; these tables are inert unless hidden flags are enabled later.

DO $$ BEGIN
  CREATE TYPE "AccountKind" AS ENUM ('individual', 'business_later');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProfessionalStatus" AS ENUM ('none', 'pending_verification', 'verified', 'rejected', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionTier" AS ENUM ('free', 'plus_later', 'pro', 'business_later');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('none', 'trialing', 'active', 'past_due', 'canceled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "IdentityVerificationProvider" AS ENUM ('none', 'manual', 'stripe_identity', 'airwallex');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "IdentityVerificationStatus" AS ENUM ('none', 'pending', 'verified', 'rejected', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "accountKind" "AccountKind" NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS "professionalStatus" "ProfessionalStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "professionalStatusUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "subscriptionStatusUpdatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProfessionalProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT,
  "headline" TEXT,
  "professionalBio" TEXT,
  "category" TEXT,
  "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "websiteUrl" TEXT,
  "portfolioUrl" TEXT,
  "countryCode" TEXT,
  "preferredCurrency" TEXT NOT NULL DEFAULT 'eur',
  "status" "ProfessionalStatus" NOT NULL DEFAULT 'none',
  "statusNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriptionState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tier" "SubscriptionTier" NOT NULL DEFAULT 'free',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'none',
  "provider" TEXT,
  "externalCustomerId" TEXT,
  "externalSubscriptionId" TEXT,
  "currentPeriodStartedAt" TIMESTAMP(3),
  "currentPeriodEndsAt" TIMESTAMP(3),
  "trialStartedAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "pastDueAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IdentityVerificationState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "IdentityVerificationProvider" NOT NULL DEFAULT 'none',
  "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'none',
  "externalVerificationId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdentityVerificationState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "User_accountKind_idx" ON "User"("accountKind");
CREATE INDEX IF NOT EXISTS "User_professionalStatus_idx" ON "User"("professionalStatus");
CREATE INDEX IF NOT EXISTS "User_subscriptionTier_subscriptionStatus_idx" ON "User"("subscriptionTier", "subscriptionStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");
CREATE INDEX IF NOT EXISTS "ProfessionalProfile_status_updatedAt_idx" ON "ProfessionalProfile"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "ProfessionalProfile_countryCode_idx" ON "ProfessionalProfile"("countryCode");
CREATE INDEX IF NOT EXISTS "ProfessionalProfile_category_idx" ON "ProfessionalProfile"("category");
CREATE INDEX IF NOT EXISTS "ProfessionalProfile_reviewedById_reviewedAt_idx" ON "ProfessionalProfile"("reviewedById", "reviewedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionState_userId_key" ON "SubscriptionState"("userId");
CREATE INDEX IF NOT EXISTS "SubscriptionState_tier_status_idx" ON "SubscriptionState"("tier", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionState_status_currentPeriodEndsAt_idx" ON "SubscriptionState"("status", "currentPeriodEndsAt");
CREATE INDEX IF NOT EXISTS "SubscriptionState_externalCustomerId_idx" ON "SubscriptionState"("externalCustomerId");
CREATE INDEX IF NOT EXISTS "SubscriptionState_externalSubscriptionId_idx" ON "SubscriptionState"("externalSubscriptionId");

CREATE UNIQUE INDEX IF NOT EXISTS "IdentityVerificationState_userId_key" ON "IdentityVerificationState"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "IdentityVerificationState_provider_externalVerificationId_key" ON "IdentityVerificationState"("provider", "externalVerificationId");
CREATE INDEX IF NOT EXISTS "IdentityVerificationState_status_updatedAt_idx" ON "IdentityVerificationState"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "IdentityVerificationState_provider_status_idx" ON "IdentityVerificationState"("provider", "status");
CREATE INDEX IF NOT EXISTS "IdentityVerificationState_reviewedById_reviewedAt_idx" ON "IdentityVerificationState"("reviewedById", "reviewedAt");

DO $$ BEGIN
  ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SubscriptionState" ADD CONSTRAINT "SubscriptionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IdentityVerificationState" ADD CONSTRAINT "IdentityVerificationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IdentityVerificationState" ADD CONSTRAINT "IdentityVerificationState_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
