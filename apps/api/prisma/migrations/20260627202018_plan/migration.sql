-- CreateTable
CREATE TABLE "PlanSearchEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "queryRaw" TEXT NOT NULL,
    "queryNormalized" TEXT NOT NULL,
    "filtersJson" JSONB,
    "resultCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSearchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSearchTermAggregate" (
    "id" TEXT NOT NULL,
    "queryNormalized" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "zeroResultCount" INTEGER NOT NULL DEFAULT 0,
    "resultCountSum" INTEGER NOT NULL DEFAULT 0,
    "lastResultCount" INTEGER NOT NULL DEFAULT 0,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSearchTermAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanSearchEvent_queryNormalized_createdAt_idx" ON "PlanSearchEvent"("queryNormalized", "createdAt");

-- CreateIndex
CREATE INDEX "PlanSearchEvent_userId_createdAt_idx" ON "PlanSearchEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanSearchEvent_createdAt_idx" ON "PlanSearchEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PlanSearchTermAggregate_day_searchCount_idx" ON "PlanSearchTermAggregate"("day", "searchCount");

-- CreateIndex
CREATE INDEX "PlanSearchTermAggregate_lastSearchedAt_idx" ON "PlanSearchTermAggregate"("lastSearchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSearchTermAggregate_queryNormalized_day_key" ON "PlanSearchTermAggregate"("queryNormalized", "day");
