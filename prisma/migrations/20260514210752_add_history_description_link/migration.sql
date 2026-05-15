-- AlterTable
ALTER TABLE "Store" ADD COLUMN "description" TEXT;
ALTER TABLE "Store" ADD COLUMN "link" TEXT;

-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "score" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    CONSTRAINT "ScoreHistory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScoreHistory_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreHistory_storeId_programId_date_key" ON "ScoreHistory"("storeId", "programId", "date");
