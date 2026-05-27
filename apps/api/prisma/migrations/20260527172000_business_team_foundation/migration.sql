-- CreateEnum
CREATE TYPE "BusinessProfileInvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "BusinessProfileInvitation" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "BusinessProfileMemberRole" NOT NULL DEFAULT 'member',
    "status" "BusinessProfileInvitationStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfileInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfileTeamAuditLog" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    "note" TEXT,
    "previousValue" JSONB,
    "nextValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessProfileTeamAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessProfileInvitation_businessProfileId_status_idx" ON "BusinessProfileInvitation"("businessProfileId", "status");
CREATE INDEX "BusinessProfileInvitation_email_status_idx" ON "BusinessProfileInvitation"("email", "status");
CREATE INDEX "BusinessProfileInvitation_invitedById_createdAt_idx" ON "BusinessProfileInvitation"("invitedById", "createdAt");
CREATE INDEX "BusinessProfileInvitation_acceptedById_acceptedAt_idx" ON "BusinessProfileInvitation"("acceptedById", "acceptedAt");
CREATE INDEX "BusinessProfileTeamAuditLog_businessProfileId_createdAt_idx" ON "BusinessProfileTeamAuditLog"("businessProfileId", "createdAt");
CREATE INDEX "BusinessProfileTeamAuditLog_actorId_createdAt_idx" ON "BusinessProfileTeamAuditLog"("actorId", "createdAt");
CREATE INDEX "BusinessProfileTeamAuditLog_targetUserId_createdAt_idx" ON "BusinessProfileTeamAuditLog"("targetUserId", "createdAt");
CREATE INDEX "BusinessProfileTeamAuditLog_action_createdAt_idx" ON "BusinessProfileTeamAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessProfileInvitation" ADD CONSTRAINT "BusinessProfileInvitation_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessProfileInvitation" ADD CONSTRAINT "BusinessProfileInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessProfileInvitation" ADD CONSTRAINT "BusinessProfileInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessProfileTeamAuditLog" ADD CONSTRAINT "BusinessProfileTeamAuditLog_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessProfileTeamAuditLog" ADD CONSTRAINT "BusinessProfileTeamAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessProfileTeamAuditLog" ADD CONSTRAINT "BusinessProfileTeamAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
