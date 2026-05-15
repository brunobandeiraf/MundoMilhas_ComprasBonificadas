-- CreateTable
CREATE TABLE "StoreAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryStoreId" TEXT NOT NULL,
    "aliasStoreId" TEXT NOT NULL,
    CONSTRAINT "StoreAlias_primaryStoreId_fkey" FOREIGN KEY ("primaryStoreId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoreAlias_aliasStoreId_fkey" FOREIGN KEY ("aliasStoreId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreAlias_primaryStoreId_aliasStoreId_key" ON "StoreAlias"("primaryStoreId", "aliasStoreId");
