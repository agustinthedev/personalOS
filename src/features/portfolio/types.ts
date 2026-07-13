export const currencyOptions = [
  { value: "USD", label: "USD" },
  { value: "UYU", label: "UYU" },
] as const;

export const marketAssetTypeOptions = [
  { value: "CRYPTO", label: "Crypto" },
  { value: "STOCK", label: "Stocks" },
  { value: "ETF", label: "ETFs" },
  { value: "FUND", label: "Funds" },
  { value: "BOND", label: "Fixed Income / Bond" },
  { value: "COMMODITY", label: "Commodities" },
] as const;

export const manualAssetTypeOptions = [
  { value: "CASH", label: "Cash" },
  { value: "CASH_EQUIVALENT", label: "Cash & Equivalents" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "VEHICLE", label: "Vehicles" },
  { value: "COLLECTIBLE", label: "Collectibles" },
  { value: "OTHER", label: "Other Assets" },
] as const;

export const liabilityTypeOptions = [
  { value: "LOAN", label: "Loan" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "MORTGAGE", label: "Mortgage" },
  { value: "PERSONAL_DEBT", label: "Personal Debt" },
  { value: "OTHER", label: "Other" },
] as const;

export const transactionTypeOptions = [
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
  { value: "ADJUSTMENT", label: "Adjustment" },
] as const;

export type CurrencyCode = (typeof currencyOptions)[number]["value"];
export type MarketAssetTypeCode = (typeof marketAssetTypeOptions)[number]["value"];
export type ManualAssetTypeCode = (typeof manualAssetTypeOptions)[number]["value"];
export type LiabilityTypeCode = (typeof liabilityTypeOptions)[number]["value"];
export type TransactionTypeCode = (typeof transactionTypeOptions)[number]["value"];
export type PortfolioAssetKind = "MARKET_ASSET" | "MANUAL_ASSET";
export type PriceStatus = "auto" | "manual" | "stale" | "error";

export type PortfolioSettingsView = {
  id: string;
  displayCurrency: CurrencyCode;
  priceRefreshHours: number;
  snapshotIntervalHours: number;
};

export type PortfolioTransactionView = {
  id: string;
  assetId: string;
  type: TransactionTypeCode;
  quantity: number;
  unitPrice: number | null;
  grossAmount: number | null;
  fees: number;
  currency: CurrencyCode;
  executedAt: string;
  accountNote: string;
  notes: string;
};

export type PortfolioAssetView = {
  id: string;
  name: string;
  symbol: string;
  kind: PortfolioAssetKind;
  visualCategory: string;
  marketType: MarketAssetTypeCode | null;
  manualType: ManualAssetTypeCode | null;
  currency: CurrencyCode;
  manualValue: number | null;
  quantityHeld: number;
  averageCost: number | null;
  costBasis: number | null;
  currentUnitPrice: number | null;
  currentTotalValue: number;
  expectedAnnualGrowthPercent: number | null;
  isIncomeProducing: boolean;
  expectedMonthlyIncome: number | null;
  displayMonthlyIncome: number | null;
  displayValue: number;
  displayCurrency: CurrencyCode;
  unrealizedGain: number | null;
  unrealizedGainPercent: number | null;
  priceStatus: PriceStatus;
  autoPriceEnabled: boolean;
  lastPriceUpdatedAt: string | null;
  accountNote: string;
  notes: string;
  transactions: PortfolioTransactionView[];
};

export type PortfolioLiabilityView = {
  id: string;
  name: string;
  type: LiabilityTypeCode;
  visualCategory: "Liabilities";
  currency: CurrencyCode;
  currentBalance: number;
  displayBalance: number;
  displayCurrency: CurrencyCode;
  payoffMonths: number | null;
  accountNote: string;
  notes: string;
};

export type PortfolioSnapshotView = {
  id: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  currency: CurrencyCode;
  source: "AUTO" | "MANUAL";
  note: string;
  capturedAt: string;
};

export type PortfolioMetric = {
  label: string;
  value: number;
  currency: CurrencyCode;
  sevenDayChange: number | null;
  sevenDayChangePercent: number | null;
  thirtyDayChange: number | null;
  thirtyDayChangePercent: number | null;
};

export type PortfolioAllocation = {
  label: string;
  value: number;
  percent: number;
};

export type PortfolioProjectionPoint = {
  month: number;
  label: string;
  assets: number;
  liabilities: number;
  projectedIncome: number;
  netWorth: number;
};

export type PortfolioProjectionSummary = {
  horizonMonths: number;
  projectedNetWorth: number;
  projectedGain: number;
  projectedIncome: number;
};

export type PortfolioPageData = {
  settings: PortfolioSettingsView;
  marketAssets: PortfolioAssetView[];
  manualAssets: PortfolioAssetView[];
  liabilities: PortfolioLiabilityView[];
  snapshots: PortfolioSnapshotView[];
  metrics: {
    totalAssets: PortfolioMetric;
    totalLiabilities: PortfolioMetric;
    netWorth: PortfolioMetric;
    liquidAssets: PortfolioMetric;
  };
  allocationByCategory: PortfolioAllocation[];
  allocationByCurrency: PortfolioAllocation[];
  projections: {
    points: PortfolioProjectionPoint[];
    summary: PortfolioProjectionSummary;
  };
  warnings: string[];
  freshness: {
    lastPriceRefresh: string | null;
    lastSnapshot: string | null;
    fxRate: number | null;
    fxCapturedAt: string | null;
  };
};
