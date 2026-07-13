-- AlterTable
ALTER TABLE "PortfolioLiability" ADD COLUMN "payoffMonths" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PortfolioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "kind" TEXT NOT NULL,
    "marketType" TEXT,
    "manualType" TEXT,
    "currency" TEXT NOT NULL,
    "manualValue" DECIMAL,
    "quantityHeld" DECIMAL DEFAULT 0,
    "averageCost" DECIMAL,
    "costBasis" DECIMAL,
    "currentUnitPrice" DECIMAL,
    "currentTotalValue" DECIMAL NOT NULL DEFAULT 0,
    "expectedAnnualGrowthPercent" DECIMAL,
    "isIncomeProducing" BOOLEAN NOT NULL DEFAULT false,
    "expectedMonthlyIncome" DECIMAL,
    "priceProvider" TEXT NOT NULL DEFAULT 'MANUAL',
    "autoPriceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastPriceUpdatedAt" DATETIME,
    "accountNote" TEXT,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PortfolioAsset" ("accountNote", "archivedAt", "autoPriceEnabled", "averageCost", "costBasis", "createdAt", "currency", "currentTotalValue", "currentUnitPrice", "id", "kind", "lastPriceUpdatedAt", "manualType", "manualValue", "marketType", "name", "notes", "priceProvider", "quantityHeld", "symbol", "updatedAt") SELECT "accountNote", "archivedAt", "autoPriceEnabled", "averageCost", "costBasis", "createdAt", "currency", "currentTotalValue", "currentUnitPrice", "id", "kind", "lastPriceUpdatedAt", "manualType", "manualValue", "marketType", "name", "notes", "priceProvider", "quantityHeld", "symbol", "updatedAt" FROM "PortfolioAsset";
DROP TABLE "PortfolioAsset";
ALTER TABLE "new_PortfolioAsset" RENAME TO "PortfolioAsset";
CREATE INDEX "PortfolioAsset_kind_idx" ON "PortfolioAsset"("kind");
CREATE INDEX "PortfolioAsset_marketType_idx" ON "PortfolioAsset"("marketType");
CREATE INDEX "PortfolioAsset_manualType_idx" ON "PortfolioAsset"("manualType");
CREATE INDEX "PortfolioAsset_symbol_idx" ON "PortfolioAsset"("symbol");
CREATE INDEX "PortfolioAsset_archivedAt_idx" ON "PortfolioAsset"("archivedAt");
CREATE INDEX "PortfolioAsset_lastPriceUpdatedAt_idx" ON "PortfolioAsset"("lastPriceUpdatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
