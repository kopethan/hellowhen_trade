-- SAVE1: private Saved Library foundation for saving public content and profiles.
CREATE TYPE "SavedItemType" AS ENUM ('trade', 'need', 'offer', 'user');

CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "itemType" "SavedItemType" NOT NULL,
    "tradeId" TEXT,
    "needId" TEXT,
    "offerId" TEXT,
    "targetUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedCollection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "savedItemId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedItem_ownerId_itemType_tradeId_key" ON "SavedItem"("ownerId", "itemType", "tradeId");
CREATE UNIQUE INDEX "SavedItem_ownerId_itemType_needId_key" ON "SavedItem"("ownerId", "itemType", "needId");
CREATE UNIQUE INDEX "SavedItem_ownerId_itemType_offerId_key" ON "SavedItem"("ownerId", "itemType", "offerId");
CREATE UNIQUE INDEX "SavedItem_ownerId_itemType_targetUserId_key" ON "SavedItem"("ownerId", "itemType", "targetUserId");
CREATE INDEX "SavedItem_ownerId_itemType_createdAt_idx" ON "SavedItem"("ownerId", "itemType", "createdAt");
CREATE INDEX "SavedItem_ownerId_createdAt_idx" ON "SavedItem"("ownerId", "createdAt");
CREATE INDEX "SavedItem_tradeId_idx" ON "SavedItem"("tradeId");
CREATE INDEX "SavedItem_needId_idx" ON "SavedItem"("needId");
CREATE INDEX "SavedItem_offerId_idx" ON "SavedItem"("offerId");
CREATE INDEX "SavedItem_targetUserId_idx" ON "SavedItem"("targetUserId");
CREATE INDEX "SavedItem_createdAt_idx" ON "SavedItem"("createdAt");

CREATE UNIQUE INDEX "SavedCollection_ownerId_title_key" ON "SavedCollection"("ownerId", "title");
CREATE INDEX "SavedCollection_ownerId_sortOrder_createdAt_idx" ON "SavedCollection"("ownerId", "sortOrder", "createdAt");
CREATE INDEX "SavedCollection_createdAt_idx" ON "SavedCollection"("createdAt");

CREATE UNIQUE INDEX "SavedCollectionItem_collectionId_savedItemId_key" ON "SavedCollectionItem"("collectionId", "savedItemId");
CREATE INDEX "SavedCollectionItem_ownerId_createdAt_idx" ON "SavedCollectionItem"("ownerId", "createdAt");
CREATE INDEX "SavedCollectionItem_collectionId_sortOrder_createdAt_idx" ON "SavedCollectionItem"("collectionId", "sortOrder", "createdAt");
CREATE INDEX "SavedCollectionItem_savedItemId_idx" ON "SavedCollectionItem"("savedItemId");

ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_needId_fkey" FOREIGN KEY ("needId") REFERENCES "Need"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedCollection" ADD CONSTRAINT "SavedCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedCollectionItem" ADD CONSTRAINT "SavedCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "SavedCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedCollectionItem" ADD CONSTRAINT "SavedCollectionItem_savedItemId_fkey" FOREIGN KEY ("savedItemId") REFERENCES "SavedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedCollectionItem" ADD CONSTRAINT "SavedCollectionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_exactly_one_target_check" CHECK (
    ("itemType" = 'trade' AND "tradeId" IS NOT NULL AND "needId" IS NULL AND "offerId" IS NULL AND "targetUserId" IS NULL)
    OR
    ("itemType" = 'need' AND "needId" IS NOT NULL AND "tradeId" IS NULL AND "offerId" IS NULL AND "targetUserId" IS NULL)
    OR
    ("itemType" = 'offer' AND "offerId" IS NOT NULL AND "tradeId" IS NULL AND "needId" IS NULL AND "targetUserId" IS NULL)
    OR
    ("itemType" = 'user' AND "targetUserId" IS NOT NULL AND "tradeId" IS NULL AND "needId" IS NULL AND "offerId" IS NULL)
);

ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_cannot_save_self_check" CHECK (
    "targetUserId" IS NULL OR "targetUserId" <> "ownerId"
);
