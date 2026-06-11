-- ORG1: private folders for users to organize their own Needs and Offers.
CREATE TYPE "InventoryFolderItemType" AS ENUM ('need', 'offer');

CREATE TABLE "InventoryFolder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryFolderItem" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "itemType" "InventoryFolderItemType" NOT NULL,
    "needId" TEXT,
    "offerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryFolderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryFolder_ownerId_title_key" ON "InventoryFolder"("ownerId", "title");
CREATE INDEX "InventoryFolder_ownerId_sortOrder_createdAt_idx" ON "InventoryFolder"("ownerId", "sortOrder", "createdAt");
CREATE INDEX "InventoryFolder_createdAt_idx" ON "InventoryFolder"("createdAt");

CREATE UNIQUE INDEX "InventoryFolderItem_folderId_itemType_needId_key" ON "InventoryFolderItem"("folderId", "itemType", "needId");
CREATE UNIQUE INDEX "InventoryFolderItem_folderId_itemType_offerId_key" ON "InventoryFolderItem"("folderId", "itemType", "offerId");
CREATE INDEX "InventoryFolderItem_ownerId_itemType_createdAt_idx" ON "InventoryFolderItem"("ownerId", "itemType", "createdAt");
CREATE INDEX "InventoryFolderItem_folderId_sortOrder_createdAt_idx" ON "InventoryFolderItem"("folderId", "sortOrder", "createdAt");
CREATE INDEX "InventoryFolderItem_needId_idx" ON "InventoryFolderItem"("needId");
CREATE INDEX "InventoryFolderItem_offerId_idx" ON "InventoryFolderItem"("offerId");

ALTER TABLE "InventoryFolder" ADD CONSTRAINT "InventoryFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryFolderItem" ADD CONSTRAINT "InventoryFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "InventoryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryFolderItem" ADD CONSTRAINT "InventoryFolderItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryFolderItem" ADD CONSTRAINT "InventoryFolderItem_needId_fkey" FOREIGN KEY ("needId") REFERENCES "Need"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryFolderItem" ADD CONSTRAINT "InventoryFolderItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryFolderItem" ADD CONSTRAINT "InventoryFolderItem_exactly_one_inventory_item_check" CHECK (
    ("itemType" = 'need' AND "needId" IS NOT NULL AND "offerId" IS NULL)
    OR
    ("itemType" = 'offer' AND "offerId" IS NOT NULL AND "needId" IS NULL)
);
