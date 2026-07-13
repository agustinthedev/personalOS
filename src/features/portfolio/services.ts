import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "./types";

type ServiceWarning = {
  message: string;
};

type PriceResult = {
  price: number | null;
  currency: CurrencyCode;
  source: string;
  warning?: string;
};

type RateResult = {
  rate: number;
  source: string;
  warning?: string;
};

const fallbackUsdUyuRate = 40;
const defaultCryptoPriceApiBaseUrl = "https://api.coingecko.com/api/v3/simple/price";
const coinGeckoIdsBySymbol: Record<string, string> = {
  ADA: "cardano",
  AVAX: "avalanche-2",
  BCH: "bitcoin-cash",
  BNB: "binancecoin",
  BTC: "bitcoin",
  DOGE: "dogecoin",
  DOT: "polkadot",
  ETH: "ethereum",
  LINK: "chainlink",
  LTC: "litecoin",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  RAY: "raydium",
  SOL: "solana",
  TON: "the-open-network",
  TRX: "tron",
  UNI: "uniswap",
  USDC: "usd-coin",
  USDT: "tether",
  XRP: "ripple",
};

export function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  return Number(value);
}

function toDecimal(value: number | string | Prisma.Decimal | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function hoursSince(date: Date | null) {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  return (Date.now() - date.getTime()) / 36e5;
}

function normalizeSymbol(symbol: string | null | undefined) {
  return symbol?.trim().toUpperCase() ?? "";
}

function isValidCurrency(value: string): value is CurrencyCode {
  return value === "USD" || value === "UYU";
}

async function fetchJsonPrice(url: string): Promise<number | null> {
  const response = await fetch(url, { next: { revalidate: 0 } });

  if (!response.ok) {
    throw new Error(providerStatusMessage(response.status));
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const candidates = [
    payload.price,
    payload.rate,
    payload.value,
    payload.last,
    payload.close,
    (payload.data as Record<string, unknown> | undefined)?.price,
  ];

  for (const candidate of candidates) {
    const price = Number(candidate);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }

  return null;
}

function buildProviderUrl(baseUrl: string, symbol: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  const coinGeckoId = coinGeckoIdsBySymbol[symbol] ?? symbol.toLowerCase();

  if (trimmed.includes("{symbol}") || trimmed.includes("{id}")) {
    return trimmed
      .replaceAll("{symbol}", encodeURIComponent(symbol))
      .replaceAll("{id}", encodeURIComponent(coinGeckoId));
  }

  return `${trimmed}?symbol=${encodeURIComponent(symbol)}`;
}

function isCoinGeckoSimplePriceUrl(baseUrl: string) {
  return baseUrl.includes("api.coingecko.com") && baseUrl.includes("/simple/price");
}

function providerStatusMessage(status: number) {
  if (status === 429) {
    return "Provider rate limit reached. Using cached prices for now.";
  }

  return `Provider returned ${status}`;
}

function readCoinGeckoUsdPrice(value: Record<string, unknown> | Record<string, unknown>[] | undefined) {
  if (Array.isArray(value)) {
    const pricedToken = value.find((item) => {
      const price = Number(item.usd);
      return Number.isFinite(price) && price > 0;
    });

    return Number(pricedToken?.usd ?? null);
  }

  return Number(value?.usd ?? null);
}

async function fetchCoinGeckoSimplePrice(baseUrl: string, symbol: string): Promise<PriceResult> {
  const coinGeckoId = coinGeckoIdsBySymbol[symbol];
  const url = new URL(baseUrl);
  url.searchParams.set("vs_currencies", "usd");

  if (coinGeckoId) {
    url.searchParams.set("ids", coinGeckoId);
  } else {
    url.searchParams.set("symbols", symbol.toLowerCase());
    url.searchParams.set("include_tokens", "top");
  }

  const response = await fetch(url, { next: { revalidate: 0 } });

  if (!response.ok) {
    throw new Error(providerStatusMessage(response.status));
  }

  const payload = (await response.json()) as Record<string, Record<string, unknown> | Record<string, unknown>[] | undefined>;
  const payloadKey = coinGeckoId ?? symbol.toLowerCase();
  const price = readCoinGeckoUsdPrice(payload[payloadKey]);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Provider response did not include a usable USD price");
  }

  return { price, currency: "USD", source: "COINGECKO" };
}

async function fetchCoinGeckoSimplePayload(url: URL) {
  const response = await fetch(url, { next: { revalidate: 0 } });

  if (!response.ok) {
    throw new Error(providerStatusMessage(response.status));
  }

  return (await response.json()) as Record<
    string,
    Record<string, unknown> | Record<string, unknown>[] | undefined
  >;
}

async function getCoinGeckoPricesBySymbol(symbols: string[]): Promise<Map<string, PriceResult>> {
  const prices = new Map<string, PriceResult>();
  const uniqueSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  const mappedSymbols = uniqueSymbols.filter((symbol) => coinGeckoIdsBySymbol[symbol]);
  const lookupSymbols = uniqueSymbols.filter((symbol) => !coinGeckoIdsBySymbol[symbol]);
  const baseUrl = process.env.CRYPTO_PRICE_API_BASE_URL || defaultCryptoPriceApiBaseUrl;

  if (!isCoinGeckoSimplePriceUrl(baseUrl)) {
    return prices;
  }

  if (mappedSymbols.length > 0) {
    const mappedUrl = new URL(baseUrl);
    mappedUrl.searchParams.set(
      "ids",
      mappedSymbols.map((symbol) => coinGeckoIdsBySymbol[symbol]).join(","),
    );
    mappedUrl.searchParams.set("vs_currencies", "usd");

    const payload = await fetchCoinGeckoSimplePayload(mappedUrl);
    for (const symbol of mappedSymbols) {
      const coinGeckoId = coinGeckoIdsBySymbol[symbol];
      const price = readCoinGeckoUsdPrice(payload[coinGeckoId]);
      if (Number.isFinite(price) && price > 0) {
        prices.set(symbol, { price, currency: "USD", source: "COINGECKO" });
      }
    }
  }

  if (lookupSymbols.length > 0) {
    const lookupUrl = new URL(baseUrl);
    lookupUrl.searchParams.set("symbols", lookupSymbols.map((symbol) => symbol.toLowerCase()).join(","));
    lookupUrl.searchParams.set("vs_currencies", "usd");
    lookupUrl.searchParams.set("include_tokens", "top");

    const payload = await fetchCoinGeckoSimplePayload(lookupUrl);
    for (const symbol of lookupSymbols) {
      const price = readCoinGeckoUsdPrice(payload[symbol.toLowerCase()]);
      if (Number.isFinite(price) && price > 0) {
        prices.set(symbol, { price, currency: "USD", source: "COINGECKO" });
      }
    }
  }

  return prices;
}

export async function getCryptoPrice(symbol: string): Promise<PriceResult> {
  const baseUrl = process.env.CRYPTO_PRICE_API_BASE_URL || defaultCryptoPriceApiBaseUrl;
  const normalized = normalizeSymbol(symbol);

  try {
    if (isCoinGeckoSimplePriceUrl(baseUrl)) {
      return fetchCoinGeckoSimplePrice(baseUrl, normalized);
    }

    const url = buildProviderUrl(baseUrl, normalized);
    return { price: await fetchJsonPrice(url), currency: "USD", source: "CRYPTO_PRICE_API" };
  } catch (error) {
    return {
      price: null,
      currency: "USD",
      source: "cache",
      warning: `Could not refresh ${normalized}: ${error instanceof Error ? error.message : "unknown error"}.`,
    };
  }
}

export async function getStockOrFundPrice(symbol: string): Promise<PriceResult> {
  const baseUrl = process.env.MARKET_PRICE_API_BASE_URL;
  const normalized = normalizeSymbol(symbol);

  if (!baseUrl) {
    return {
      price: null,
      currency: "USD",
      source: "cache",
      warning: `No market price provider configured for ${normalized}.`,
    };
  }

  try {
    const url = `${baseUrl.replace(/\/$/, "")}?symbol=${encodeURIComponent(normalized)}`;
    return { price: await fetchJsonPrice(url), currency: "USD", source: "MARKET_PRICE_API" };
  } catch (error) {
    return {
      price: null,
      currency: "USD",
      source: "cache",
      warning: `Could not refresh ${normalized}: ${error instanceof Error ? error.message : "unknown error"}.`,
    };
  }
}

export async function getCommoditySpotPrice(symbol: string): Promise<PriceResult> {
  const baseUrl = process.env.COMMODITY_PRICE_API_BASE_URL;
  const normalized = normalizeSymbol(symbol);

  if (!baseUrl) {
    return {
      price: null,
      currency: "USD",
      source: "cache",
      warning: `No commodity price provider configured for ${normalized}.`,
    };
  }

  try {
    const url = `${baseUrl.replace(/\/$/, "")}?symbol=${encodeURIComponent(normalized)}`;
    return { price: await fetchJsonPrice(url), currency: "USD", source: "COMMODITY_PRICE_API" };
  } catch (error) {
    return {
      price: null,
      currency: "USD",
      source: "cache",
      warning: `Could not refresh ${normalized}: ${error instanceof Error ? error.message : "unknown error"}.`,
    };
  }
}

export async function getMarketPrice(asset: {
  symbol: string | null;
  marketType: string | null;
}): Promise<PriceResult> {
  const symbol = normalizeSymbol(asset.symbol);

  if (!symbol) {
    return {
      price: null,
      currency: "USD",
      source: "manual",
      warning: "Market asset is missing a symbol.",
    };
  }

  if (asset.marketType === "CRYPTO") {
    return getCryptoPrice(symbol);
  }

  if (asset.marketType === "COMMODITY") {
    return getCommoditySpotPrice(symbol);
  }

  return getStockOrFundPrice(symbol);
}

export async function getExchangeRate(
  base: CurrencyCode,
  quote: CurrencyCode,
): Promise<RateResult> {
  if (base === quote) {
    return { rate: 1, source: "identity" };
  }

  const apiBaseUrl = process.env.FX_RATE_API_BASE_URL;

  if (apiBaseUrl) {
    try {
      const url = buildExchangeRateUrl(apiBaseUrl, base, quote);
      const response = await fetch(url, { next: { revalidate: 0 } });

      if (!response.ok) {
        throw new Error(providerStatusMessage(response.status));
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const candidates = [
        payload.rate,
        payload.value,
        (payload.rates as Record<string, unknown> | undefined)?.[quote],
        (payload.conversion_rates as Record<string, unknown> | undefined)?.[quote],
      ];

      for (const candidate of candidates) {
        const rate = Number(candidate);
        if (Number.isFinite(rate) && rate > 0) {
          return { rate, source: "FX_RATE_API" };
        }
      }

      throw new Error("Provider response did not include a usable rate");
    } catch (error) {
      const cached = await getLatestUsdUyuRate();
      if (cached) {
        return {
          rate: convertUsdUyuRate(cached.rate, base, quote),
          source: cached.source,
          warning: `Could not refresh FX: ${error instanceof Error ? error.message : "unknown error"}.`,
        };
      }
    }
  }

  return {
    rate: convertUsdUyuRate(fallbackUsdUyuRate, base, quote),
    source: "fallback",
    warning: `Using local USD/UYU fallback rate (${fallbackUsdUyuRate.toFixed(2)}). Configure FX_RATE_API_BASE_URL for live rates.`,
  };
}

function buildExchangeRateUrl(baseUrl: string, base: CurrencyCode, quote: CurrencyCode) {
  const trimmed = baseUrl.replace(/\/$/, "");

  if (trimmed.includes("{base}") || trimmed.includes("{quote}")) {
    return trimmed
      .replaceAll("{base}", encodeURIComponent(base))
      .replaceAll("{quote}", encodeURIComponent(quote));
  }

  if (trimmed.includes("open.er-api.com/v6/latest")) {
    return `${trimmed}/${encodeURIComponent(base)}`;
  }

  return `${trimmed}?base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}`;
}

export async function refreshStaleExchangeRates(settings: {
  priceRefreshHours: number;
}): Promise<ServiceWarning[]> {
  const warnings: ServiceWarning[] = [];
  const latest = await prisma.exchangeRateSnapshot.findFirst({
    where: { base: "USD", quote: "UYU" },
    orderBy: { capturedAt: "desc" },
  });

  if (latest && hoursSince(latest.capturedAt) <= settings.priceRefreshHours) {
    return warnings;
  }

  const result = await getExchangeRate("USD", "UYU");

  await prisma.exchangeRateSnapshot.create({
    data: {
      base: "USD",
      quote: "UYU",
      rate: result.rate,
      source: result.source,
    },
  });

  if (result.warning) {
    warnings.push({ message: result.warning });
  }

  return warnings;
}

export async function refreshStalePrices(settings: {
  priceRefreshHours: number;
}): Promise<ServiceWarning[]> {
  const warnings: ServiceWarning[] = [];
  const assets = await prisma.portfolioAsset.findMany({
    where: {
      kind: "MARKET_ASSET",
      archivedAt: null,
      autoPriceEnabled: true,
    },
  });
  const staleAssets = assets.filter((asset) => hoursSince(asset.lastPriceUpdatedAt) > settings.priceRefreshHours);
  const cryptoAssets = staleAssets.filter((asset) => asset.marketType === "CRYPTO");
  const cryptoProviderBaseUrl = process.env.CRYPTO_PRICE_API_BASE_URL || defaultCryptoPriceApiBaseUrl;
  const shouldBatchCrypto = isCoinGeckoSimplePriceUrl(cryptoProviderBaseUrl);
  let batchedCryptoPrices = new Map<string, PriceResult>();
  let batchedCryptoWarning: string | null = null;

  if (shouldBatchCrypto && cryptoAssets.length > 0) {
    try {
      batchedCryptoPrices = await getCoinGeckoPricesBySymbol(
        cryptoAssets.map((asset) => asset.symbol ?? ""),
      );
    } catch (error) {
      batchedCryptoWarning = error instanceof Error ? error.message : "Could not refresh crypto prices.";
      warnings.push({ message: batchedCryptoWarning });
    }
  }

  for (const asset of staleAssets) {
    const symbol = normalizeSymbol(asset.symbol);
    const result =
      shouldBatchCrypto && asset.marketType === "CRYPTO"
        ? batchedCryptoPrices.get(symbol) ?? {
            price: null,
            currency: "USD" as CurrencyCode,
            source: "cache",
            warning: batchedCryptoWarning ? undefined : `Could not refresh ${symbol}: cached price kept.`,
          }
        : await getMarketPrice(asset);

    if (result.price && result.price > 0) {
      await prisma.$transaction([
        prisma.portfolioAsset.update({
          where: { id: asset.id },
          data: {
            currentUnitPrice: result.price,
            priceProvider: result.source === "cache" ? "MANUAL" : "MARKET_API",
            lastPriceUpdatedAt: new Date(),
          },
        }),
        prisma.assetPriceSnapshot.create({
          data: {
            assetId: asset.id,
            unitPrice: result.price,
            currency: result.currency,
            source: result.source,
          },
        }),
      ]);
    } else if (result.warning) {
      warnings.push({ message: result.warning });
    }
  }

  return warnings;
}

export async function recalculateAssetFromTransactions(assetId: string) {
  const asset = await prisma.portfolioAsset.findUniqueOrThrow({
    where: { id: assetId },
    include: {
      transactions: {
        where: { archivedAt: null },
        orderBy: [{ executedAt: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (asset.kind === "MANUAL_ASSET") {
    const total = toNumber(asset.manualValue);
    await prisma.portfolioAsset.update({
      where: { id: asset.id },
      data: {
        quantityHeld: 0,
        averageCost: null,
        costBasis: null,
        currentTotalValue: total,
      },
    });
    return;
  }

  let quantityHeld = 0;
  let costBasis = 0;

  for (const transaction of asset.transactions) {
    const quantity = toNumber(transaction.quantity);
    const unitPrice = toNumber(transaction.unitPrice);
    const grossAmount =
      transaction.grossAmount !== null
        ? toNumber(transaction.grossAmount)
        : quantity * unitPrice;
    const fees = toNumber(transaction.fees);
    const grossInAssetCurrency = await convertAmount(
      grossAmount,
      transaction.currency as CurrencyCode,
      asset.currency as CurrencyCode,
    );
    const feesInAssetCurrency = await convertAmount(
      fees,
      transaction.currency as CurrencyCode,
      asset.currency as CurrencyCode,
    );

    if (transaction.type === "BUY") {
      quantityHeld += quantity;
      costBasis += grossInAssetCurrency + feesInAssetCurrency;
    }

    if (transaction.type === "TRANSFER_IN") {
      quantityHeld += quantity;
      if (grossInAssetCurrency > 0) {
        costBasis += grossInAssetCurrency + feesInAssetCurrency;
      }
    }

    if (transaction.type === "SELL" || transaction.type === "TRANSFER_OUT") {
      const removedQuantity = Math.min(quantity, Math.max(quantityHeld, 0));
      const averageCost = quantityHeld > 0 ? costBasis / quantityHeld : 0;
      quantityHeld -= removedQuantity;
      costBasis -= averageCost * removedQuantity;
      if (quantityHeld < 0.0000000001) {
        quantityHeld = 0;
      }
      if (costBasis < 0.0000000001) {
        costBasis = 0;
      }
    }

    if (transaction.type === "ADJUSTMENT") {
      quantityHeld += quantity;
      if (quantity > 0) {
        costBasis += grossInAssetCurrency > 0 ? grossInAssetCurrency + feesInAssetCurrency : 0;
      } else if (quantity < 0) {
        const removedQuantity = Math.min(Math.abs(quantity), Math.max(quantityHeld - quantity, 0));
        const previousQuantity = quantityHeld - quantity;
        const averageCost = previousQuantity > 0 ? costBasis / previousQuantity : 0;
        costBasis -= averageCost * removedQuantity;
      }
      if (quantityHeld < 0.0000000001) {
        quantityHeld = 0;
      }
      if (costBasis < 0.0000000001) {
        costBasis = 0;
      }
    }
  }

  const averageCost = quantityHeld > 0 ? costBasis / quantityHeld : null;
  const currentTotalValue = quantityHeld * toNumber(asset.currentUnitPrice);

  await prisma.portfolioAsset.update({
    where: { id: asset.id },
    data: {
      quantityHeld,
      averageCost,
      costBasis,
      currentTotalValue,
    },
  });
}

export async function recalculateAllActiveAssets() {
  const assets = await prisma.portfolioAsset.findMany({
    where: { archivedAt: null },
    select: { id: true },
  });

  for (const asset of assets) {
    await recalculateAssetFromTransactions(asset.id);
  }
}

export async function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
) {
  if (from === to) {
    return amount;
  }

  const latest = await getLatestUsdUyuRate();
  const rate = latest?.rate ?? fallbackUsdUyuRate;

  return amount * convertUsdUyuRate(rate, from, to);
}

export async function calculatePortfolioTotals(displayCurrency: CurrencyCode) {
  const [assets, liabilities] = await Promise.all([
    prisma.portfolioAsset.findMany({ where: { archivedAt: null } }),
    prisma.portfolioLiability.findMany({ where: { archivedAt: null } }),
  ]);

  let totalAssets = 0;
  let liquidAssets = 0;
  let totalLiabilities = 0;

  for (const asset of assets) {
    const nativeValue =
      asset.kind === "MANUAL_ASSET" ? toNumber(asset.manualValue) : toNumber(asset.currentTotalValue);
    const converted = await convertAmount(
      nativeValue,
      asset.currency as CurrencyCode,
      displayCurrency,
    );
    totalAssets += converted;

    if (asset.manualType === "CASH" || asset.manualType === "CASH_EQUIVALENT") {
      liquidAssets += converted;
    }
  }

  for (const liability of liabilities) {
    totalLiabilities += await convertAmount(
      toNumber(liability.currentBalance),
      liability.currency as CurrencyCode,
      displayCurrency,
    );
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    liquidAssets,
  };
}

export async function ensureFreshPortfolioSnapshot(settings: {
  displayCurrency: CurrencyCode;
  snapshotIntervalHours: number;
}) {
  const latest = await prisma.portfolioSnapshot.findFirst({
    where: { source: "AUTO", currency: settings.displayCurrency },
    orderBy: { capturedAt: "desc" },
  });

  if (latest && hoursSince(latest.capturedAt) <= settings.snapshotIntervalHours) {
    return;
  }

  const totals = await calculatePortfolioTotals(settings.displayCurrency);

  await prisma.portfolioSnapshot.create({
    data: {
      totalAssets: totals.totalAssets,
      totalLiabilities: totals.totalLiabilities,
      netWorth: totals.netWorth,
      currency: settings.displayCurrency,
      source: "AUTO",
    },
  });
}

export async function createManualPortfolioSnapshot(
  displayCurrency: CurrencyCode,
  note?: string,
) {
  const totals = await calculatePortfolioTotals(displayCurrency);

  await prisma.portfolioSnapshot.create({
    data: {
      totalAssets: totals.totalAssets,
      totalLiabilities: totals.totalLiabilities,
      netWorth: totals.netWorth,
      currency: displayCurrency,
      source: "MANUAL",
      note: note?.trim() || null,
    },
  });
}

export async function getLatestUsdUyuRate() {
  const latest = await prisma.exchangeRateSnapshot.findFirst({
    where: { base: "USD", quote: "UYU" },
    orderBy: { capturedAt: "desc" },
  });

  if (!latest) {
    return null;
  }

  return {
    rate: toNumber(latest.rate),
    source: latest.source,
    capturedAt: latest.capturedAt,
  };
}

export function convertUsdUyuRate(rate: number, from: CurrencyCode, to: CurrencyCode) {
  if (from === to) {
    return 1;
  }

  if (from === "USD" && to === "UYU") {
    return rate;
  }

  return 1 / rate;
}

export function decimalInput(value: string | number | null | undefined) {
  return toDecimal(value);
}

export function currencyFromString(value: string): CurrencyCode {
  return isValidCurrency(value) ? value : "USD";
}
