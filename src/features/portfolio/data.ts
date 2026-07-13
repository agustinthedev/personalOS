import { prisma } from "@/lib/db";
import type {
  CurrencyCode,
  PortfolioAllocation,
  PortfolioAssetView,
  PortfolioLiabilityView,
  PortfolioMetric,
  PortfolioPageData,
  PortfolioProjectionPoint,
  PortfolioSnapshotView,
  PortfolioTransactionView,
  PriceStatus,
} from "./types";
import {
  calculatePortfolioTotals,
  convertAmount,
  ensureFreshPortfolioSnapshot,
  getLatestUsdUyuRate,
  recalculateAllActiveAssets,
  refreshStaleExchangeRates,
  refreshStalePrices,
  toNumber,
} from "./services";

export async function ensurePortfolioSettings() {
  const existing = await prisma.portfolioSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.portfolioSettings.create({
    data: {
      displayCurrency: "USD",
      priceRefreshHours: 1,
      snapshotIntervalHours: 24,
    },
  });
}

export async function getPortfolioPageData(): Promise<PortfolioPageData> {
  const settings = await ensurePortfolioSettings();
  const displayCurrency = settings.displayCurrency as CurrencyCode;
  const warnings = [
    ...(await refreshStaleExchangeRates(settings)),
    ...(await refreshStalePrices(settings)),
  ].map((warning) => warning.message);

  await recalculateAllActiveAssets();
  await ensureFreshPortfolioSnapshot({
    displayCurrency,
    snapshotIntervalHours: settings.snapshotIntervalHours,
  });

  const [assets, liabilities, snapshots, fx] = await Promise.all([
    prisma.portfolioAsset.findMany({
      where: { archivedAt: null },
      include: {
        transactions: {
          where: { archivedAt: null },
          orderBy: [{ executedAt: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.portfolioLiability.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.portfolioSnapshot.findMany({
      where: { currency: displayCurrency },
      orderBy: { capturedAt: "asc" },
      take: 90,
    }),
    getLatestUsdUyuRate(),
  ]);

  const marketAssets: PortfolioAssetView[] = [];
  const manualAssets: PortfolioAssetView[] = [];

  for (const asset of assets) {
    const view = await toAssetView(asset, displayCurrency);
    if (asset.kind === "MARKET_ASSET") {
      marketAssets.push(view);
    } else {
      manualAssets.push(view);
    }
  }

  const liabilityViews = await Promise.all(
    liabilities.map((liability) => toLiabilityView(liability, displayCurrency)),
  );
  const totals = await calculatePortfolioTotals(displayCurrency);
  const snapshotViews = snapshots.map(toSnapshotView);
  const lastSnapshot = snapshotViews.at(-1) ?? null;
  const latestPriceRefresh = marketAssets
    .map((asset) => asset.lastPriceUpdatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    settings: {
      id: settings.id,
      displayCurrency,
      priceRefreshHours: settings.priceRefreshHours,
      snapshotIntervalHours: settings.snapshotIntervalHours,
    },
    marketAssets,
    manualAssets,
    liabilities: liabilityViews,
    snapshots: snapshotViews,
    metrics: {
      totalAssets: toMetric("Total Assets", totals.totalAssets, displayCurrency, snapshotViews, "totalAssets"),
      totalLiabilities: toMetric(
        "Total Liabilities",
        totals.totalLiabilities,
        displayCurrency,
        snapshotViews,
        "totalLiabilities",
      ),
      netWorth: toMetric("Net Worth", totals.netWorth, displayCurrency, snapshotViews, "netWorth"),
      liquidAssets: {
        label: "Liquid Assets",
        value: totals.liquidAssets,
        currency: displayCurrency,
        sevenDayChange: null,
        sevenDayChangePercent: null,
        thirtyDayChange: null,
        thirtyDayChangePercent: null,
      },
    },
    allocationByCategory: buildAllocationByCategory([...marketAssets, ...manualAssets]),
    allocationByCurrency: buildAllocationByCurrency([...marketAssets, ...manualAssets]),
    projections: buildPortfolioProjections({
      assets: [...marketAssets, ...manualAssets],
      liabilities: liabilityViews,
      totalAssets: totals.totalAssets,
      totalLiabilities: totals.totalLiabilities,
    }),
    warnings: [...new Set(warnings)],
    freshness: {
      lastPriceRefresh: latestPriceRefresh,
      lastSnapshot: lastSnapshot?.capturedAt ?? null,
      fxRate: fx?.rate ?? null,
      fxCapturedAt: fx?.capturedAt.toISOString() ?? null,
    },
  };
}

type AssetRecord = Awaited<
  ReturnType<typeof prisma.portfolioAsset.findMany>
>[number] & {
  transactions: Awaited<ReturnType<typeof prisma.portfolioTransaction.findMany>>;
};

async function toAssetView(
  asset: AssetRecord,
  displayCurrency: CurrencyCode,
): Promise<PortfolioAssetView> {
  const nativeValue =
    asset.kind === "MANUAL_ASSET" ? toNumber(asset.manualValue) : toNumber(asset.currentTotalValue);
  const displayValue = await convertAmount(
    nativeValue,
    asset.currency as CurrencyCode,
    displayCurrency,
  );
  const costBasis = asset.costBasis === null ? null : toNumber(asset.costBasis);
  const unrealizedGain =
    asset.kind === "MARKET_ASSET" && costBasis !== null
      ? nativeValue - costBasis
      : null;
  const displayUnrealizedGain =
    unrealizedGain === null
      ? null
      : await convertAmount(unrealizedGain, asset.currency as CurrencyCode, displayCurrency);
  const displayMonthlyIncome =
    asset.expectedMonthlyIncome === null
      ? null
      : await convertAmount(
          toNumber(asset.expectedMonthlyIncome),
          asset.currency as CurrencyCode,
          displayCurrency,
        );

  return {
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol ?? "",
    kind: asset.kind as PortfolioAssetView["kind"],
    visualCategory: getAssetVisualCategory(asset),
    marketType: asset.marketType as PortfolioAssetView["marketType"],
    manualType: asset.manualType as PortfolioAssetView["manualType"],
    currency: asset.currency as CurrencyCode,
    manualValue: asset.manualValue === null ? null : toNumber(asset.manualValue),
    quantityHeld: toNumber(asset.quantityHeld),
    averageCost: asset.averageCost === null ? null : toNumber(asset.averageCost),
    costBasis,
    currentUnitPrice: asset.currentUnitPrice === null ? null : toNumber(asset.currentUnitPrice),
    currentTotalValue: nativeValue,
    expectedAnnualGrowthPercent:
      asset.expectedAnnualGrowthPercent === null
        ? null
        : toNumber(asset.expectedAnnualGrowthPercent),
    isIncomeProducing: asset.isIncomeProducing,
    expectedMonthlyIncome:
      asset.expectedMonthlyIncome === null
        ? null
        : toNumber(asset.expectedMonthlyIncome),
    displayMonthlyIncome,
    maturityDate: asset.maturityDate?.toISOString().slice(0, 10) ?? null,
    displayValue,
    displayCurrency,
    unrealizedGain: displayUnrealizedGain,
    unrealizedGainPercent:
      unrealizedGain !== null && costBasis && costBasis > 0 ? unrealizedGain / costBasis : null,
    priceStatus: getPriceStatus(asset),
    autoPriceEnabled: asset.autoPriceEnabled,
    lastPriceUpdatedAt: asset.lastPriceUpdatedAt?.toISOString() ?? null,
    accountNote: asset.accountNote ?? "",
    notes: asset.notes ?? "",
    transactions: asset.transactions.map(toTransactionView),
  };
}

async function toLiabilityView(
  liability: Awaited<ReturnType<typeof prisma.portfolioLiability.findMany>>[number],
  displayCurrency: CurrencyCode,
): Promise<PortfolioLiabilityView> {
  return {
    id: liability.id,
    name: liability.name,
    type: liability.type as PortfolioLiabilityView["type"],
    visualCategory: "Liabilities",
    currency: liability.currency as CurrencyCode,
    currentBalance: toNumber(liability.currentBalance),
    displayBalance: await convertAmount(
      toNumber(liability.currentBalance),
      liability.currency as CurrencyCode,
      displayCurrency,
    ),
    displayCurrency,
    payoffMonths: liability.payoffMonths,
    accountNote: liability.accountNote ?? "",
    notes: liability.notes ?? "",
  };
}

function toTransactionView(
  transaction: Awaited<ReturnType<typeof prisma.portfolioTransaction.findMany>>[number],
): PortfolioTransactionView {
  return {
    id: transaction.id,
    assetId: transaction.assetId,
    type: transaction.type as PortfolioTransactionView["type"],
    quantity: toNumber(transaction.quantity),
    unitPrice: transaction.unitPrice === null ? null : toNumber(transaction.unitPrice),
    grossAmount: transaction.grossAmount === null ? null : toNumber(transaction.grossAmount),
    fees: toNumber(transaction.fees),
    currency: transaction.currency as CurrencyCode,
    executedAt: transaction.executedAt.toISOString().slice(0, 10),
    accountNote: transaction.accountNote ?? "",
    notes: transaction.notes ?? "",
  };
}

function toSnapshotView(
  snapshot: Awaited<ReturnType<typeof prisma.portfolioSnapshot.findMany>>[number],
): PortfolioSnapshotView {
  return {
    id: snapshot.id,
    totalAssets: toNumber(snapshot.totalAssets),
    totalLiabilities: toNumber(snapshot.totalLiabilities),
    netWorth: toNumber(snapshot.netWorth),
    currency: snapshot.currency as CurrencyCode,
    source: snapshot.source as PortfolioSnapshotView["source"],
    note: snapshot.note ?? "",
    capturedAt: snapshot.capturedAt.toISOString(),
  };
}

function getAssetVisualCategory(asset: {
  kind: string;
  marketType: string | null;
  manualType: string | null;
}) {
  if (asset.kind === "MARKET_ASSET") {
    const labels: Record<string, string> = {
      CRYPTO: "Crypto",
      STOCK: "Stocks",
      ETF: "ETFs & Funds",
      FUND: "ETFs & Funds",
      BOND: "Fixed Income",
      COMMODITY: "Commodities",
    };
    return labels[asset.marketType ?? ""] ?? "Market Assets";
  }

  const labels: Record<string, string> = {
    CASH: "Cash",
    CASH_EQUIVALENT: "Cash & Equivalents",
    REAL_ESTATE: "Real Estate",
    VEHICLE: "Vehicles",
    COLLECTIBLE: "Collectibles",
    OTHER: "Other Assets",
  };

  return labels[asset.manualType ?? ""] ?? "Other Assets";
}

function getPriceStatus(asset: {
  kind: string;
  autoPriceEnabled: boolean;
  currentUnitPrice: unknown;
  lastPriceUpdatedAt: Date | null;
}): PriceStatus {
  if (asset.kind === "MANUAL_ASSET" || !asset.autoPriceEnabled) {
    return "manual";
  }

  if (!asset.currentUnitPrice) {
    return "error";
  }

  if (!asset.lastPriceUpdatedAt) {
    return "stale";
  }

  const ageHours = (Date.now() - asset.lastPriceUpdatedAt.getTime()) / 36e5;
  return ageHours > 1 ? "stale" : "auto";
}

function toMetric(
  label: string,
  value: number,
  currency: CurrencyCode,
  snapshots: PortfolioSnapshotView[],
  field: "totalAssets" | "totalLiabilities" | "netWorth",
): PortfolioMetric {
  const baseline = findSnapshotBeforeDays(snapshots, 7);
  const baselineValue = baseline?.[field] ?? null;
  const sevenDayChange = baselineValue === null ? null : value - baselineValue;
  const thirtyDayBaseline = findSnapshotBeforeDays(snapshots, 30);
  const thirtyDayBaselineValue = thirtyDayBaseline?.[field] ?? null;
  const thirtyDayChange = thirtyDayBaselineValue === null ? null : value - thirtyDayBaselineValue;

  return {
    label,
    value,
    currency,
    sevenDayChange,
    sevenDayChangePercent:
      sevenDayChange === null || !baselineValue ? null : sevenDayChange / Math.abs(baselineValue),
    thirtyDayChange,
    thirtyDayChangePercent:
      thirtyDayChange === null || !thirtyDayBaselineValue
        ? null
        : thirtyDayChange / Math.abs(thirtyDayBaselineValue),
  };
}

function findSnapshotBeforeDays(snapshots: PortfolioSnapshotView[], days: number) {
  const target = Date.now() - days * 24 * 60 * 60 * 1000;
  const older = snapshots.filter((snapshot) => new Date(snapshot.capturedAt).getTime() <= target);

  return older.at(-1) ?? null;
}

function buildAllocationByCategory(assets: PortfolioAssetView[]): PortfolioAllocation[] {
  const totals = new Map<string, number>();
  const total = assets.reduce((sum, asset) => sum + asset.displayValue, 0);

  for (const asset of assets) {
    totals.set(asset.visualCategory, (totals.get(asset.visualCategory) ?? 0) + asset.displayValue);
  }

  return [...totals.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildAllocationByCurrency(assets: PortfolioAssetView[]): PortfolioAllocation[] {
  const totals = new Map<string, number>();
  const total = assets.reduce((sum, asset) => sum + asset.displayValue, 0);

  for (const asset of assets) {
    totals.set(asset.currency, (totals.get(asset.currency) ?? 0) + asset.displayValue);
  }

  return [...totals.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildPortfolioProjections({
  assets,
  liabilities,
  totalAssets,
  totalLiabilities,
}: {
  assets: PortfolioAssetView[];
  liabilities: PortfolioLiabilityView[];
  totalAssets: number;
  totalLiabilities: number;
}) {
  const projectionMonths = [0, 12, 24, 36, 60];
  const points: PortfolioProjectionPoint[] = projectionMonths.map((month) => {
    const projectedAssets = assets.reduce((sum, asset) => {
      const annualGrowth = (asset.expectedAnnualGrowthPercent ?? 0) / 100;
      const monthlyGrowth = annualGrowth === 0 ? 0 : Math.pow(1 + annualGrowth, 1 / 12) - 1;
      const activeMonths = getProjectionActiveMonths(asset.maturityDate, month);
      return sum + asset.displayValue * Math.pow(1 + monthlyGrowth, activeMonths);
    }, 0);
    const projectedIncome = assets.reduce((sum, asset) => {
      if (!asset.isIncomeProducing || !asset.displayMonthlyIncome) {
        return sum;
      }

      return sum + asset.displayMonthlyIncome * getProjectionActiveMonths(asset.maturityDate, month);
    }, 0);
    const projectedLiabilities = liabilities.reduce((sum, liability) => {
      if (!liability.payoffMonths || liability.payoffMonths <= 0) {
        return sum + liability.displayBalance;
      }

      const remainingRatio = Math.max(0, 1 - month / liability.payoffMonths);
      return sum + liability.displayBalance * remainingRatio;
    }, 0);

    return {
      month,
      label: month === 0 ? "Today" : `${month}m`,
      assets: projectedAssets + projectedIncome,
      liabilities: projectedLiabilities,
      projectedIncome,
      netWorth: projectedAssets + projectedIncome - projectedLiabilities,
    };
  });
  const finalPoint = points.at(-1) ?? points[0];
  const currentNetWorth = totalAssets - totalLiabilities;

  return {
    points,
    summary: {
      horizonMonths: finalPoint.month,
      projectedNetWorth: finalPoint.netWorth,
      projectedGain: finalPoint.netWorth - currentNetWorth,
      projectedIncome: finalPoint.projectedIncome,
    },
  };
}

function getProjectionActiveMonths(maturityDate: string | null, projectedMonth: number) {
  if (!maturityDate) {
    return projectedMonth;
  }

  const now = new Date();
  const maturity = new Date(`${maturityDate}T00:00:00`);
  if (Number.isNaN(maturity.getTime()) || maturity <= now) {
    return 0;
  }

  const monthsUntilMaturity =
    (maturity.getFullYear() - now.getFullYear()) * 12 +
    (maturity.getMonth() - now.getMonth()) +
    (maturity.getDate() >= now.getDate() ? 0 : -1);

  return Math.max(0, Math.min(projectedMonth, monthsUntilMaturity));
}
