"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "./types";
import { ensurePortfolioSettings } from "./data";
import {
  createManualPortfolioSnapshot,
  recalculateAllActiveAssets,
  recalculateAssetFromTransactions,
  refreshStaleExchangeRates,
  refreshStalePrices,
  toNumber,
} from "./services";

const portfolioPath = "/portfolio";

const currencySchema = z.enum(["USD", "UYU"]);
const marketAssetTypeSchema = z.enum(["STOCK", "ETF", "FUND", "BOND", "CRYPTO", "COMMODITY"]);
const manualAssetTypeSchema = z.enum([
  "CASH",
  "CASH_EQUIVALENT",
  "REAL_ESTATE",
  "VEHICLE",
  "COLLECTIBLE",
  "OTHER",
]);
const liabilityTypeSchema = z.enum(["LOAN", "CREDIT_CARD", "MORTGAGE", "PERSONAL_DEBT", "OTHER"]);
const transactionTypeSchema = z.enum([
  "BUY",
  "SELL",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ADJUSTMENT",
]);
const inputModeSchema = z.enum(["AMOUNT", "QUANTITY"]);

const nullableText = z
  .string()
  .trim()
  .max(1200)
  .optional()
  .nullable()
  .transform((value) => value?.trim() || null);

const optionalPositiveNumber = z
  .union([z.coerce.number().positive(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "number" ? value : null));
const optionalPercent = z
  .union([z.coerce.number().min(-100).max(100), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "number" ? value : null));
const optionalNonNegativeNumber = z
  .union([z.coerce.number().min(0), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "number" ? value : null));
const optionalPositiveInt = z
  .union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "number" ? value : null));

const nonNegativeNumber = z.coerce.number().min(0);
const marketAssetSchema = z.object({
  assetId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  symbol: z.string().trim().min(1).max(24),
  marketType: marketAssetTypeSchema,
  currency: currencySchema,
  autoPriceEnabled: z.boolean().default(false),
  initialUnitPrice: optionalPositiveNumber,
  expectedAnnualGrowthPercent: optionalPercent,
  isIncomeProducing: z.boolean().default(false),
  expectedMonthlyIncome: optionalNonNegativeNumber,
  accountNote: nullableText,
  notes: nullableText,
  createInitialBuy: z.boolean().default(false),
  initialInputMode: inputModeSchema.default("AMOUNT"),
  initialQuantity: optionalPositiveNumber,
  initialGrossAmount: optionalPositiveNumber,
  initialFees: z.coerce.number().min(0).default(0),
  initialExecutedAt: z.string().optional().nullable(),
});

const manualAssetSchema = z.object({
  assetId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  manualType: manualAssetTypeSchema,
  currency: currencySchema,
  manualValue: nonNegativeNumber,
  expectedAnnualGrowthPercent: optionalPercent,
  isIncomeProducing: z.boolean().default(false),
  expectedMonthlyIncome: optionalNonNegativeNumber,
  accountNote: nullableText,
  notes: nullableText,
});

const liabilitySchema = z.object({
  liabilityId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  type: liabilityTypeSchema,
  currency: currencySchema,
  currentBalance: nonNegativeNumber,
  payoffMonths: optionalPositiveInt,
  accountNote: nullableText,
  notes: nullableText,
});

const transactionSchema = z.object({
  transactionId: z.string().optional(),
  assetId: z.string().min(1),
  type: transactionTypeSchema,
  inputMode: inputModeSchema.default("QUANTITY"),
  quantity: z.coerce.number(),
  unitPrice: optionalPositiveNumber,
  grossAmount: optionalPositiveNumber,
  fees: z.coerce.number().min(0).default(0),
  currency: currencySchema,
  executedAt: z.string().min(1),
  accountNote: nullableText,
  notes: nullableText,
});

const settingsSchema = z.object({
  displayCurrency: currencySchema,
  priceRefreshHours: z.coerce.number().int().min(1).max(168),
  snapshotIntervalHours: z.coerce.number().int().min(1).max(720),
});

export type PortfolioActionResult = {
  ok: boolean;
  error?: string;
};

export async function createMarketAsset(
  input: z.input<typeof marketAssetSchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = marketAssetSchema.parse(input);
    const symbol = data.symbol.trim().toUpperCase();
    const currentUnitPrice = data.initialUnitPrice;

    const asset = await prisma.portfolioAsset.create({
      data: {
        name: data.name,
        symbol,
        kind: "MARKET_ASSET",
        marketType: data.marketType,
        currency: data.currency,
        currentUnitPrice,
        currentTotalValue: 0,
        expectedAnnualGrowthPercent: data.expectedAnnualGrowthPercent,
        isIncomeProducing: data.isIncomeProducing,
        expectedMonthlyIncome: data.isIncomeProducing ? data.expectedMonthlyIncome : null,
        priceProvider: currentUnitPrice ? "MANUAL" : "MANUAL",
        autoPriceEnabled: data.autoPriceEnabled,
        lastPriceUpdatedAt: currentUnitPrice ? new Date() : null,
        accountNote: data.accountNote,
        notes: data.notes,
        priceSnapshots: currentUnitPrice
          ? {
              create: {
                unitPrice: currentUnitPrice,
                currency: data.currency,
                source: "manual",
              },
            }
          : undefined,
      },
    });

    if (data.createInitialBuy) {
      const transaction = normalizeTransactionAmounts({
        type: "BUY",
        inputMode: data.initialInputMode,
        quantity: data.initialQuantity,
        unitPrice: currentUnitPrice,
        grossAmount: data.initialGrossAmount,
        fees: data.initialFees,
        notes: data.notes,
      });

      await prisma.portfolioTransaction.create({
        data: {
          assetId: asset.id,
          type: "BUY",
          quantity: transaction.quantity,
          unitPrice: transaction.unitPrice,
          grossAmount: transaction.grossAmount,
          fees: transaction.fees,
          currency: data.currency,
          executedAt: parseInputDate(data.initialExecutedAt),
          accountNote: data.accountNote,
          notes: data.notes,
        },
      });
    }

    await recalculateAssetFromTransactions(asset.id);
    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateMarketAsset(
  input: z.input<typeof marketAssetSchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = marketAssetSchema.extend({ assetId: z.string().min(1) }).parse(input);
    const symbol = data.symbol.trim().toUpperCase();

    await prisma.portfolioAsset.update({
      where: { id: data.assetId },
      data: {
        name: data.name,
        symbol,
        marketType: data.marketType,
        currency: data.currency,
        currentUnitPrice: data.initialUnitPrice,
        expectedAnnualGrowthPercent: data.expectedAnnualGrowthPercent,
        isIncomeProducing: data.isIncomeProducing,
        expectedMonthlyIncome: data.isIncomeProducing ? data.expectedMonthlyIncome : null,
        autoPriceEnabled: data.autoPriceEnabled,
        lastPriceUpdatedAt: data.initialUnitPrice ? new Date() : undefined,
        accountNote: data.accountNote,
        notes: data.notes,
      },
    });

    if (data.initialUnitPrice) {
      await prisma.assetPriceSnapshot.create({
        data: {
          assetId: data.assetId,
          unitPrice: data.initialUnitPrice,
          currency: data.currency,
          source: "manual",
        },
      });
    }

    await recalculateAssetFromTransactions(data.assetId);
    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createManualAsset(
  input: z.input<typeof manualAssetSchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = manualAssetSchema.parse(input);

    await prisma.portfolioAsset.create({
      data: {
        name: data.name,
        kind: "MANUAL_ASSET",
        manualType: data.manualType,
        currency: data.currency,
        manualValue: data.manualValue,
        currentTotalValue: data.manualValue,
        expectedAnnualGrowthPercent: data.expectedAnnualGrowthPercent,
        isIncomeProducing: data.isIncomeProducing,
        expectedMonthlyIncome: data.isIncomeProducing ? data.expectedMonthlyIncome : null,
        accountNote: data.accountNote,
        notes: data.notes,
      },
    });

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateManualAsset(
  input: z.input<typeof manualAssetSchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = manualAssetSchema.extend({ assetId: z.string().min(1) }).parse(input);

    await prisma.portfolioAsset.update({
      where: { id: data.assetId },
      data: {
        name: data.name,
        manualType: data.manualType,
        currency: data.currency,
        manualValue: data.manualValue,
        currentTotalValue: data.manualValue,
        expectedAnnualGrowthPercent: data.expectedAnnualGrowthPercent,
        isIncomeProducing: data.isIncomeProducing,
        expectedMonthlyIncome: data.isIncomeProducing ? data.expectedMonthlyIncome : null,
        accountNote: data.accountNote,
        notes: data.notes,
      },
    });

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function archiveAsset(assetId: string): Promise<PortfolioActionResult> {
  try {
    await prisma.portfolioAsset.update({
      where: { id: assetId },
      data: { archivedAt: new Date() },
    });

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createPortfolioTransaction(
  input: z.input<typeof transactionSchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = transactionSchema.parse(input);
    const asset = await prisma.portfolioAsset.findUniqueOrThrow({
      where: { id: data.assetId },
    });

    if (asset.kind !== "MARKET_ASSET") {
      throw new Error("Transactions can only be added to market assets.");
    }

    const transaction = normalizeTransactionAmounts(data);
    await ensureTransactionDoesNotOverdraw(data.assetId, transaction.quantity, data.type);

    await prisma.portfolioTransaction.create({
      data: {
        assetId: data.assetId,
        type: data.type,
        quantity: transaction.quantity,
        unitPrice: transaction.unitPrice,
        grossAmount: transaction.grossAmount,
        fees: transaction.fees,
        currency: data.currency,
        executedAt: parseInputDate(data.executedAt),
        accountNote: data.accountNote,
        notes: data.notes,
      },
    });

    await recalculateAssetFromTransactions(data.assetId);
    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePortfolioTransaction(
  input: z.input<typeof transactionSchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = transactionSchema.extend({ transactionId: z.string().min(1) }).parse(input);
    const current = await prisma.portfolioTransaction.findUniqueOrThrow({
      where: { id: data.transactionId },
    });
    const transaction = normalizeTransactionAmounts(data);
    await ensureTransactionDoesNotOverdraw(
      data.assetId,
      transaction.quantity,
      data.type,
      data.transactionId,
    );

    await prisma.portfolioTransaction.update({
      where: { id: data.transactionId },
      data: {
        assetId: data.assetId,
        type: data.type,
        quantity: transaction.quantity,
        unitPrice: transaction.unitPrice,
        grossAmount: transaction.grossAmount,
        fees: transaction.fees,
        currency: data.currency,
        executedAt: parseInputDate(data.executedAt),
        accountNote: data.accountNote,
        notes: data.notes,
      },
    });

    await recalculateAssetFromTransactions(current.assetId);
    if (current.assetId !== data.assetId) {
      await recalculateAssetFromTransactions(data.assetId);
    }

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function archivePortfolioTransaction(
  transactionId: string,
): Promise<PortfolioActionResult> {
  try {
    const transaction = await prisma.portfolioTransaction.update({
      where: { id: transactionId },
      data: { archivedAt: new Date() },
    });

    await recalculateAssetFromTransactions(transaction.assetId);
    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createLiability(
  input: z.input<typeof liabilitySchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = liabilitySchema.parse(input);

    await prisma.portfolioLiability.create({
      data: {
        name: data.name,
        type: data.type,
        currency: data.currency,
        currentBalance: data.currentBalance,
        payoffMonths: data.payoffMonths,
        accountNote: data.accountNote,
        notes: data.notes,
      },
    });

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateLiability(
  input: z.input<typeof liabilitySchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = liabilitySchema.extend({ liabilityId: z.string().min(1) }).parse(input);

    await prisma.portfolioLiability.update({
      where: { id: data.liabilityId },
      data: {
        name: data.name,
        type: data.type,
        currency: data.currency,
        currentBalance: data.currentBalance,
        payoffMonths: data.payoffMonths,
        accountNote: data.accountNote,
        notes: data.notes,
      },
    });

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function archiveLiability(liabilityId: string): Promise<PortfolioActionResult> {
  try {
    await prisma.portfolioLiability.update({
      where: { id: liabilityId },
      data: { archivedAt: new Date() },
    });

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePortfolioSettings(
  input: z.input<typeof settingsSchema>,
): Promise<PortfolioActionResult> {
  try {
    const data = settingsSchema.parse(input);
    const settings = await ensurePortfolioSettings();

    await prisma.portfolioSettings.update({
      where: { id: settings.id },
      data,
    });

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function refreshPortfolioPrices(): Promise<PortfolioActionResult> {
  try {
    const settings = await ensurePortfolioSettings();
    await refreshStaleExchangeRates({ priceRefreshHours: 0 });
    await refreshStalePrices({ priceRefreshHours: 0 });
    await recalculateAllActiveAssets();
    await createManualPortfolioSnapshot(settings.displayCurrency as CurrencyCode, "Manual refresh");

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createPortfolioSnapshotNow(note?: string): Promise<PortfolioActionResult> {
  try {
    const settings = await ensurePortfolioSettings();
    await recalculateAllActiveAssets();
    await createManualPortfolioSnapshot(settings.displayCurrency as CurrencyCode, note);

    revalidatePath(portfolioPath);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

async function ensureTransactionDoesNotOverdraw(
  assetId: string,
  quantity: number,
  type: z.infer<typeof transactionTypeSchema>,
  excludedTransactionId?: string,
) {
  if (type !== "SELL" && type !== "TRANSFER_OUT") {
    return;
  }

  const transactions = await prisma.portfolioTransaction.findMany({
    where: {
      assetId,
      archivedAt: null,
      id: excludedTransactionId ? { not: excludedTransactionId } : undefined,
    },
  });

  const held = transactions.reduce((total, transaction) => {
    const value = toNumber(transaction.quantity);

    if (transaction.type === "BUY" || transaction.type === "TRANSFER_IN") {
      return total + value;
    }

    if (transaction.type === "SELL" || transaction.type === "TRANSFER_OUT") {
      return total - value;
    }

    return total + value;
  }, 0);

  if (quantity > held + 0.0000000001) {
    throw new Error("This transaction exceeds the current holding.");
  }
}

function normalizeTransactionAmounts(data: {
  type: z.infer<typeof transactionTypeSchema>;
  inputMode: z.infer<typeof inputModeSchema>;
  quantity: number | null;
  unitPrice: number | null;
  grossAmount: number | null;
  fees: number;
  notes?: string | null;
}) {
  const fees = data.fees ?? 0;
  const unitPrice = data.unitPrice;
  let quantity = data.quantity ?? 0;
  let grossAmount = data.grossAmount ?? null;

  if (data.type === "ADJUSTMENT") {
    if (!data.notes) {
      throw new Error("Adjustments require a note.");
    }
    if (quantity === 0) {
      throw new Error("Adjustment quantity cannot be zero.");
    }
    if (grossAmount === null && unitPrice && quantity > 0) {
      grossAmount = quantity * unitPrice;
    }
    return { quantity, unitPrice, grossAmount, fees };
  }

  if (!unitPrice || unitPrice <= 0) {
    throw new Error("Unit price is required.");
  }

  if (data.inputMode === "AMOUNT") {
    if (!grossAmount || grossAmount <= 0) {
      throw new Error("Gross amount is required.");
    }
    quantity = grossAmount / unitPrice;
  } else {
    if (!quantity || quantity <= 0) {
      throw new Error("Quantity is required.");
    }
    grossAmount = quantity * unitPrice;
  }

  return {
    quantity,
    unitPrice,
    grossAmount,
    fees,
  };
}

function parseInputDate(value?: string | null) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function toActionError(error: unknown): PortfolioActionResult {
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Something went wrong." };
}
