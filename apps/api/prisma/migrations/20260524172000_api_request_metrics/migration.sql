-- Privacy-safe API performance metrics. Stores route patterns and timing only;
-- never request bodies, query strings, private message/proposal content, or raw URLs.
CREATE TABLE "ApiRequestMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "method" TEXT NOT NULL,
    "routePattern" TEXT NOT NULL,
    "appArea" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "statusGroup" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiRequestMetric_createdAt_idx" ON "ApiRequestMetric"("createdAt");
CREATE INDEX "ApiRequestMetric_appArea_createdAt_idx" ON "ApiRequestMetric"("appArea", "createdAt");
CREATE INDEX "ApiRequestMetric_routePattern_createdAt_idx" ON "ApiRequestMetric"("routePattern", "createdAt");
CREATE INDEX "ApiRequestMetric_statusGroup_createdAt_idx" ON "ApiRequestMetric"("statusGroup", "createdAt");
CREATE INDEX "ApiRequestMetric_userId_createdAt_idx" ON "ApiRequestMetric"("userId", "createdAt");
CREATE INDEX "ApiRequestMetric_sessionId_createdAt_idx" ON "ApiRequestMetric"("sessionId", "createdAt");

ALTER TABLE "ApiRequestMetric" ADD CONSTRAINT "ApiRequestMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
