-- Privacy-safe operational presence for the first launch admin usage dashboard.
-- Stores route patterns/app areas only; private message/proposal content is not stored.

CREATE TABLE "UsageHeartbeat" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "sessionId" TEXT,
  "clientId" TEXT,
  "appArea" TEXT NOT NULL,
  "routePattern" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UsageHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageHeartbeat_clientId_key" ON "UsageHeartbeat"("clientId");
CREATE INDEX "UsageHeartbeat_lastSeenAt_idx" ON "UsageHeartbeat"("lastSeenAt");
CREATE INDEX "UsageHeartbeat_appArea_lastSeenAt_idx" ON "UsageHeartbeat"("appArea", "lastSeenAt");
CREATE INDEX "UsageHeartbeat_userId_lastSeenAt_idx" ON "UsageHeartbeat"("userId", "lastSeenAt");
CREATE INDEX "UsageHeartbeat_sessionId_lastSeenAt_idx" ON "UsageHeartbeat"("sessionId", "lastSeenAt");

ALTER TABLE "UsageHeartbeat"
  ADD CONSTRAINT "UsageHeartbeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
