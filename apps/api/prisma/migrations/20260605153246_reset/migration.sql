-- AlterEnum
ALTER TYPE "ReportReason" ADD VALUE 'impersonation';

-- DropIndex
DROP INDEX "User_accountKind_idx";

-- DropIndex
DROP INDEX "User_professionalStatus_idx";

-- DropIndex
DROP INDEX "User_subscriptionTier_subscriptionStatus_idx";

-- AlterTable
ALTER TABLE "TradeProposalPackageItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "BusinessSponsoredPlacement_businessProfileId_targetType_targetI" RENAME TO "BusinessSponsoredPlacement_businessProfileId_targetType_tar_key";
