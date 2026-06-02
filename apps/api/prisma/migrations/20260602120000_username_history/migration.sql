-- Unique username handle anti-abuse support.
-- Profile.handle already existed; this adds change cooldown metadata and old-handle hold history.

ALTER TABLE "Profile"
  ADD COLUMN "handleChangedAt" TIMESTAMP(3),
  ADD COLUMN "handleChangeCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "UsernameHistory" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "oldHandle" TEXT,
  "newHandle" TEXT NOT NULL,
  "changedById" TEXT,
  "changedByRole" TEXT NOT NULL DEFAULT 'user',
  "reason" TEXT,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UsernameHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Profile_handleChangedAt_idx" ON "Profile"("handleChangedAt");
CREATE INDEX "UsernameHistory_profileId_createdAt_idx" ON "UsernameHistory"("profileId", "createdAt");
CREATE INDEX "UsernameHistory_userId_createdAt_idx" ON "UsernameHistory"("userId", "createdAt");
CREATE INDEX "UsernameHistory_oldHandle_releasedAt_idx" ON "UsernameHistory"("oldHandle", "releasedAt");
CREATE INDEX "UsernameHistory_newHandle_createdAt_idx" ON "UsernameHistory"("newHandle", "createdAt");
CREATE INDEX "UsernameHistory_changedById_createdAt_idx" ON "UsernameHistory"("changedById", "createdAt");

ALTER TABLE "UsernameHistory"
  ADD CONSTRAINT "UsernameHistory_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsernameHistory"
  ADD CONSTRAINT "UsernameHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsernameHistory"
  ADD CONSTRAINT "UsernameHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
