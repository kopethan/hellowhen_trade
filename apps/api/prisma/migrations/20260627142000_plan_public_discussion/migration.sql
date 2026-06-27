CREATE TABLE "PlanPublicMessage" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TradePublicMessageStatus" NOT NULL DEFAULT 'visible',
    "editedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPublicMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanPublicMessage_planId_status_createdAt_idx" ON "PlanPublicMessage"("planId", "status", "createdAt");
CREATE INDEX "PlanPublicMessage_authorId_createdAt_idx" ON "PlanPublicMessage"("authorId", "createdAt");
CREATE INDEX "PlanPublicMessage_hiddenById_hiddenAt_idx" ON "PlanPublicMessage"("hiddenById", "hiddenAt");

ALTER TABLE "PlanPublicMessage" ADD CONSTRAINT "PlanPublicMessage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanPublicMessage" ADD CONSTRAINT "PlanPublicMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanPublicMessage" ADD CONSTRAINT "PlanPublicMessage_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
