/*
  Warnings:

  - Added the required column `updatedAt` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserTrustTier" AS ENUM ('new', 'email_verified', 'stripe_verified', 'trusted', 'restricted');

-- CreateEnum
CREATE TYPE "StripeConnectAccountStatus" AS ENUM ('not_started', 'onboarding', 'restricted', 'pending', 'enabled', 'disabled');

-- CreateEnum
CREATE TYPE "StripeEventProcessingStatus" AS ENUM ('received', 'processed', 'failed');

-- AlterTable
ALTER TABLE "PayoutRequest" ADD COLUMN     "stripeConnectAccountId" TEXT,
ADD COLUMN     "stripeEventId" TEXT,
ADD COLUMN     "stripeExternalStatus" TEXT,
ADD COLUMN     "stripeFailureCode" TEXT,
ADD COLUMN     "stripeFailureMessage" TEXT,
ADD COLUMN     "stripePayoutId" TEXT,
ADD COLUMN     "stripeTransferId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "forceTwoFactor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sensitiveActionVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "sessionRevokedAt" TIMESTAMP(3),
ADD COLUMN     "trustTier" "UserTrustTier" NOT NULL DEFAULT 'new',
ADD COLUMN     "trustTierNote" TEXT,
ADD COLUMN     "trustTierUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorLastUsedStep" INTEGER,
ADD COLUMN     "twoFactorRecoveryCodes" JSONB,
ADD COLUMN     "twoFactorSecretEncrypted" TEXT;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeConnectAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "status" "StripeConnectAccountStatus" NOT NULL DEFAULT 'onboarding',
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "currentlyDue" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventuallyDue" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pastDue" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disabledReason" TEXT,
    "defaultCurrency" TEXT,
    "country" TEXT,
    "onboardingStartedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastWebhookEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeConnectAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "stripeAccountId" TEXT,
    "stripeConnectAccountId" TEXT,
    "objectId" TEXT,
    "processingStatus" "StripeEventProcessingStatus" NOT NULL DEFAULT 'received',
    "payload" JSONB,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorChallenge_tokenHash_key" ON "TwoFactorChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_userId_expiresAt_idx" ON "TwoFactorChallenge"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_expiresAt_idx" ON "TwoFactorChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StripeConnectAccount_userId_key" ON "StripeConnectAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeConnectAccount_stripeAccountId_key" ON "StripeConnectAccount"("stripeAccountId");

-- CreateIndex
CREATE INDEX "StripeConnectAccount_status_updatedAt_idx" ON "StripeConnectAccount"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "StripeConnectAccount_payoutsEnabled_status_idx" ON "StripeConnectAccount"("payoutsEnabled", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_stripeEventId_key" ON "StripeEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeEvent_type_createdAt_idx" ON "StripeEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StripeEvent_stripeAccountId_createdAt_idx" ON "StripeEvent"("stripeAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "StripeEvent_stripeConnectAccountId_createdAt_idx" ON "StripeEvent"("stripeConnectAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutRequest_stripeConnectAccountId_status_idx" ON "PayoutRequest"("stripeConnectAccountId", "status");

-- CreateIndex
CREATE INDEX "PayoutRequest_stripeTransferId_idx" ON "PayoutRequest"("stripeTransferId");

-- CreateIndex
CREATE INDEX "PayoutRequest_stripePayoutId_idx" ON "PayoutRequest"("stripePayoutId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorChallenge" ADD CONSTRAINT "TwoFactorChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_stripeConnectAccountId_fkey" FOREIGN KEY ("stripeConnectAccountId") REFERENCES "StripeConnectAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeConnectAccount" ADD CONSTRAINT "StripeConnectAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "BusinessProfile_verificationProvider_verificationProviderStatus" RENAME TO "BusinessProfile_verificationProvider_verificationProviderSt_idx";
