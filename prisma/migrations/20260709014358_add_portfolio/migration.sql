-- CreateTable
CREATE TABLE "PortfolioSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayCurrency" TEXT NOT NULL DEFAULT 'USD',
    "priceRefreshHours" INTEGER NOT NULL DEFAULT 1,
    "snapshotIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PortfolioAsset" (
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
    "priceProvider" TEXT NOT NULL DEFAULT 'MANUAL',
    "autoPriceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastPriceUpdatedAt" DATETIME,
    "accountNote" TEXT,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PortfolioTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitPrice" DECIMAL,
    "grossAmount" DECIMAL,
    "fees" DECIMAL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL,
    "accountNote" TEXT,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PortfolioAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioLiability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "currency" TEXT NOT NULL,
    "currentBalance" DECIMAL NOT NULL,
    "accountNote" TEXT,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetPriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "unitPrice" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetPriceSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PortfolioAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalAssets" DECIMAL NOT NULL,
    "totalLiabilities" DECIMAL NOT NULL,
    "netWorth" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "note" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExchangeRateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PortfolioAsset_kind_idx" ON "PortfolioAsset"("kind");

-- CreateIndex
CREATE INDEX "PortfolioAsset_marketType_idx" ON "PortfolioAsset"("marketType");

-- CreateIndex
CREATE INDEX "PortfolioAsset_manualType_idx" ON "PortfolioAsset"("manualType");

-- CreateIndex
CREATE INDEX "PortfolioAsset_symbol_idx" ON "PortfolioAsset"("symbol");

-- CreateIndex
CREATE INDEX "PortfolioAsset_archivedAt_idx" ON "PortfolioAsset"("archivedAt");

-- CreateIndex
CREATE INDEX "PortfolioAsset_lastPriceUpdatedAt_idx" ON "PortfolioAsset"("lastPriceUpdatedAt");

-- CreateIndex
CREATE INDEX "PortfolioTransaction_assetId_executedAt_idx" ON "PortfolioTransaction"("assetId", "executedAt");

-- CreateIndex
CREATE INDEX "PortfolioTransaction_type_idx" ON "PortfolioTransaction"("type");

-- CreateIndex
CREATE INDEX "PortfolioTransaction_archivedAt_idx" ON "PortfolioTransaction"("archivedAt");

-- CreateIndex
CREATE INDEX "PortfolioLiability_archivedAt_idx" ON "PortfolioLiability"("archivedAt");

-- CreateIndex
CREATE INDEX "AssetPriceSnapshot_assetId_capturedAt_idx" ON "AssetPriceSnapshot"("assetId", "capturedAt");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_currency_capturedAt_idx" ON "PortfolioSnapshot"("currency", "capturedAt");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_source_capturedAt_idx" ON "PortfolioSnapshot"("source", "capturedAt");

-- CreateIndex
CREATE INDEX "ExchangeRateSnapshot_base_quote_capturedAt_idx" ON "ExchangeRateSnapshot"("base", "quote", "capturedAt");
