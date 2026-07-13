"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveAsset,
  archiveLiability,
  archivePortfolioTransaction,
  createLiability,
  createManualAsset,
  createMarketAsset,
  createPortfolioSnapshotNow,
  createPortfolioTransaction,
  refreshPortfolioPrices,
  updateLiability,
  updateManualAsset,
  updateMarketAsset,
  updatePortfolioSettings,
  type PortfolioActionResult,
} from "@/features/portfolio/actions";
import {
  currencyOptions,
  liabilityTypeOptions,
  manualAssetTypeOptions,
  marketAssetTypeOptions,
  transactionTypeOptions,
  type CurrencyCode,
  type PortfolioAssetView,
  type PortfolioLiabilityView,
  type PortfolioMetric,
  type PortfolioPageData,
} from "@/features/portfolio/types";

type ModalState =
  | { type: "market"; asset?: PortfolioAssetView }
  | { type: "manual"; asset?: PortfolioAssetView }
  | { type: "liability"; liability?: PortfolioLiabilityView }
  | { type: "transaction"; asset?: PortfolioAssetView }
  | { type: "settings" }
  | { type: "checkpoint" }
  | null;

const primaryButton =
  "cursor-pointer rounded-[28px] bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5 hover:bg-zinc-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";
const subtleButton =
  "glass-button cursor-pointer rounded-[28px] px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-white/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45";
const ghostButton =
  "cursor-pointer rounded-[28px] border border-white/12 bg-white/[0.012] px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:-translate-y-0.5 hover:border-white/40 hover:text-zinc-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass =
  "h-10 w-full rounded-[18px] border border-white/12 bg-black/20 px-3 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-white/45";
const selectClass =
  "h-10 w-full cursor-pointer appearance-none rounded-[18px] border border-white/12 bg-[#05070c] px-3 text-sm text-zinc-50 outline-none transition focus:border-white/45";
const textAreaClass =
  "min-h-20 w-full rounded-[18px] border border-white/12 bg-black/20 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-white/45";
const labelClass = "text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400";

export function PortfolioClient({ initialData }: { initialData: PortfolioPageData }) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!modal) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModal(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal]);

  function runAction(action: () => Promise<PortfolioActionResult>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setModal(null);
      router.refresh();
    });
  }

  const data = initialData;
  const allAssets = [...data.marketAssets, ...data.manualAssets];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButton} onClick={() => setModal({ type: "market" })}>
            Add market asset
          </button>
          <button type="button" className={subtleButton} onClick={() => setModal({ type: "manual" })}>
            Add manual asset
          </button>
          <button type="button" className={subtleButton} onClick={() => setModal({ type: "liability" })}>
            Add liability
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={ghostButton}
            disabled={isPending}
            onClick={() => runAction(refreshPortfolioPrices)}
          >
            Refresh prices
          </button>
          <button type="button" className={ghostButton} onClick={() => setModal({ type: "checkpoint" })}>
            Create checkpoint
          </button>
          <button type="button" className={ghostButton} onClick={() => setModal({ type: "settings" })}>
            Settings
          </button>
        </div>
      </div>

      {error ? (
        <div className="panel-muted mb-4 rounded-[24px] border-red-300/30 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {data.warnings.length > 0 ? (
        <div className="panel-muted mb-4 rounded-[24px] p-4 text-sm text-amber-100">
          {data.warnings.slice(0, 3).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <MetricCard metric={data.metrics.totalAssets} />
        <MetricCard metric={data.metrics.totalLiabilities} />
        <MetricCard metric={data.metrics.netWorth} emphasis />
        <MetricCard metric={data.metrics.liquidAssets} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <HistoryPanel data={data} />
        <AllocationPanel data={data} />
      </section>

      <ProjectionPanel data={data} />

      {allAssets.length === 0 && data.liabilities.length === 0 ? (
        <section className="panel mb-5 rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Portfolio is empty
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-zinc-50">Start with one asset or liability.</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={primaryButton} onClick={() => setModal({ type: "market" })}>
              Add market asset
            </button>
            <button type="button" className={subtleButton} onClick={() => setModal({ type: "manual" })}>
              Add manual asset
            </button>
            <button type="button" className={subtleButton} onClick={() => setModal({ type: "liability" })}>
              Add liability
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          <AssetSection
            title="Market Assets"
            assets={data.marketAssets}
            emptyLabel="No market assets yet."
            onEdit={(asset) => setModal({ type: "market", asset })}
            onTransaction={(asset) => setModal({ type: "transaction", asset })}
            onArchive={(asset) => runAction(() => archiveAsset(asset.id))}
            onArchiveTransaction={(transactionId) => runAction(() => archivePortfolioTransaction(transactionId))}
          />
          <AssetSection
            title="Other Assets"
            assets={data.manualAssets}
            emptyLabel="No manual assets yet."
            onEdit={(asset) => setModal({ type: "manual", asset })}
            onTransaction={null}
            onArchive={(asset) => runAction(() => archiveAsset(asset.id))}
            onArchiveTransaction={(transactionId) => runAction(() => archivePortfolioTransaction(transactionId))}
          />
        </div>
        <LiabilitySection
          liabilities={data.liabilities}
          onEdit={(liability) => setModal({ type: "liability", liability })}
          onArchive={(liability) => runAction(() => archiveLiability(liability.id))}
        />
      </section>

      <SimulationLab data={data} />

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="panel w-full max-w-3xl rounded-[28px] p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-zinc-50">{modalTitle(modal)}</h2>
              <button type="button" className={ghostButton} onClick={() => setModal(null)}>
                Close
              </button>
            </div>

            {modal.type === "market" ? (
              <MarketAssetForm
                asset={modal.asset}
                isPending={isPending}
                onSubmit={(payload) =>
                  runAction(() =>
                    modal.asset
                      ? updateMarketAsset(payload as Parameters<typeof updateMarketAsset>[0])
                      : createMarketAsset(payload as Parameters<typeof createMarketAsset>[0]),
                  )
                }
              />
            ) : null}

            {modal.type === "manual" ? (
              <ManualAssetForm
                asset={modal.asset}
                isPending={isPending}
                onSubmit={(payload) =>
                  runAction(() =>
                    modal.asset
                      ? updateManualAsset(payload as Parameters<typeof updateManualAsset>[0])
                      : createManualAsset(payload as Parameters<typeof createManualAsset>[0]),
                  )
                }
              />
            ) : null}

            {modal.type === "liability" ? (
              <LiabilityForm
                liability={modal.liability}
                isPending={isPending}
                onSubmit={(payload) =>
                  runAction(() =>
                    modal.liability
                      ? updateLiability(payload as Parameters<typeof updateLiability>[0])
                      : createLiability(payload as Parameters<typeof createLiability>[0]),
                  )
                }
              />
            ) : null}

            {modal.type === "transaction" ? (
              <TransactionForm
                assets={data.marketAssets}
                initialAsset={modal.asset}
                isPending={isPending}
                onSubmit={(payload) =>
                  runAction(() =>
                    createPortfolioTransaction(payload as Parameters<typeof createPortfolioTransaction>[0]),
                  )
                }
              />
            ) : null}

            {modal.type === "settings" ? (
              <SettingsForm
                data={data}
                isPending={isPending}
                onSubmit={(payload) =>
                  runAction(() =>
                    updatePortfolioSettings(payload as Parameters<typeof updatePortfolioSettings>[0]),
                  )
                }
              />
            ) : null}

            {modal.type === "checkpoint" ? (
              <CheckpointForm
                isPending={isPending}
                onSubmit={(note) => runAction(() => createPortfolioSnapshotNow(note))}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function MetricCard({ metric, emphasis = false }: { metric: PortfolioMetric; emphasis?: boolean }) {
  return (
    <div className={`panel rounded-[28px] p-5 ${emphasis ? "border-white/40" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{metric.label}</p>
      <p className="mt-4 font-mono text-3xl font-semibold text-zinc-50">
        {formatMoney(metric.value, metric.currency)}
      </p>
      <p className={`mt-3 text-sm font-medium ${changeTone(metric.sevenDayChange)}`}>
        {formatChange(metric.sevenDayChange, metric.sevenDayChangePercent, metric.currency)}
      </p>
      <p className={`mt-1 text-xs font-medium ${changeTone(metric.thirtyDayChange)}`}>
        {formatPeriodChange(metric.thirtyDayChange, metric.thirtyDayChangePercent, metric.currency, "30d")}
      </p>
    </div>
  );
}

function HistoryPanel({ data }: { data: PortfolioPageData }) {
  const points = buildHistoryPoints(data);
  const values = points.map((point) => point.netWorth);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || Math.max(Math.abs(max), 1);
  const xStep = points.length > 1 ? 100 / (points.length - 1) : 0;
  const svgPoints = points.map((point, index) => {
    const x = points.length > 1 ? index * xStep : 50;
    const y = 88 - ((point.netWorth - min) / range) * 68;

    return { ...point, x, y };
  });
  const linePath = svgPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    svgPoints.length > 0
      ? `${linePath} L ${svgPoints.at(-1)?.x.toFixed(2)} 92 L ${svgPoints[0].x.toFixed(2)} 92 Z`
      : "";

  return (
    <div className="panel rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">History</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Net worth over time</h2>
        </div>
        <div className="text-right text-xs text-zinc-400">
          <p>Snapshot {formatDate(data.freshness.lastSnapshot)}</p>
          <p>FX {data.freshness.fxRate ? data.freshness.fxRate.toFixed(2) : "n/a"}</p>
        </div>
      </div>
      <div className="bar-grid relative mt-7 h-64 rounded-[24px] border border-white/10 bg-white/[0.012] p-4">
        {points.length > 0 ? (
          <>
            <svg className="h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
              <path d={areaPath} fill="rgba(255,255,255,0.08)" />
              <path
                d={linePath}
                fill="none"
                stroke="rgba(248,250,252,0.82)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="pointer-events-none absolute inset-4">
              {svgPoints.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  aria-label={`${point.label} ${formatMoney(point.netWorth, point.currency)}`}
                  className="group pointer-events-auto absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  <span
                    className={`absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/45 transition group-hover:scale-125 group-focus-visible:scale-125 ${
                      point.isCurrent ? "h-3.5 w-3.5 bg-sky-200" : "h-3 w-3 bg-zinc-50"
                    }`}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-xl border border-white/14 bg-zinc-950/95 px-3 py-2 text-left text-xs text-zinc-100 opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.42)] backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="block whitespace-nowrap font-semibold">{formatMoney(point.netWorth, point.currency)}</span>
                    <span className="mt-1 block whitespace-nowrap text-zinc-500">{point.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
            No snapshots yet.
          </div>
        )}
      </div>
    </div>
  );
}

function buildHistoryPoints(data: PortfolioPageData) {
  const current = {
    id: "current",
    netWorth: data.metrics.netWorth.value,
    currency: data.metrics.netWorth.currency,
    capturedAt: new Date().toISOString(),
    label: "Current",
    isCurrent: true,
  };
  const snapshots = data.snapshots.slice(-23).map((snapshot) => ({
    id: snapshot.id,
    netWorth: snapshot.netWorth,
    currency: snapshot.currency,
    capturedAt: snapshot.capturedAt,
    label: formatDate(snapshot.capturedAt),
    isCurrent: false,
  }));
  const lastSnapshot = snapshots.at(-1);

  if (!lastSnapshot) {
    return [current];
  }

  if (Math.abs(lastSnapshot.netWorth - current.netWorth) < 0.01) {
    return snapshots;
  }

  return [...snapshots, current];
}

function AllocationPanel({ data }: { data: PortfolioPageData }) {
  const assets = [...data.marketAssets, ...data.manualAssets].sort(
    (a, b) => b.displayValue - a.displayValue,
  );
  const unrealizedGain = data.marketAssets.reduce(
    (total, asset) => total + (asset.unrealizedGain ?? 0),
    0,
  );

  return (
    <div className="panel rounded-[28px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Allocation</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-50">Category mix</h2>
      <div className="mt-6 space-y-4">
        {data.allocationByCategory.length > 0 ? (
          data.allocationByCategory.map((item) => (
            <AllocationRow key={item.label} label={item.label} value={item.value} percent={item.percent} currency={data.settings.displayCurrency} />
          ))
        ) : (
          <p className="text-sm text-zinc-500">No allocation yet.</p>
        )}
      </div>
      <div className="mt-7 border-t border-white/10 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Currency mix</p>
        <div className="mt-4 space-y-3">
          {data.allocationByCurrency.map((item) => (
            <AllocationRow key={item.label} label={item.label} value={item.value} percent={item.percent} currency={data.settings.displayCurrency} compact />
          ))}
        </div>
      </div>
      <div className="mt-7 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Unrealized gain/loss
          </p>
          <p className={`font-mono text-sm ${changeTone(unrealizedGain)}`}>
            {formatMoney(unrealizedGain, data.settings.displayCurrency)}
          </p>
        </div>
        <div className="mt-5 space-y-3">
          {assets.slice(0, 4).map((asset) => (
            <div key={asset.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-zinc-300">{asset.name}</span>
              <span className="font-mono text-zinc-500">
                {formatMoney(asset.displayValue, asset.displayCurrency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AllocationRow({
  label,
  value,
  percent,
  currency,
  compact = false,
}: {
  label: string;
  value: number;
  percent: number;
  currency: CurrencyCode;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-zinc-200">{label}</span>
        <span className="font-mono text-zinc-400">{formatMoney(value, currency)}</span>
      </div>
      <div className={`rounded-full bg-white/10 ${compact ? "h-1.5" : "h-2"}`}>
        <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.max(2, percent * 100)}%` }} />
      </div>
    </div>
  );
}

function ProjectionPanel({ data }: { data: PortfolioPageData }) {
  const points = data.projections.points.filter((point) => point.month > 0);
  const maxNetWorth = Math.max(...data.projections.points.map((point) => point.netWorth), 1);
  const minNetWorth = Math.min(...data.projections.points.map((point) => point.netWorth), 0);
  const range = maxNetWorth - minNetWorth || Math.max(Math.abs(maxNetWorth), 1);

  return (
    <section className="panel mb-5 rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Projections
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Expected net worth path</h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold text-zinc-50">
            {formatMoney(data.projections.summary.projectedNetWorth, data.settings.displayCurrency)}
          </p>
          <p className={`mt-1 text-sm ${changeTone(data.projections.summary.projectedGain)}`}>
            {formatMoney(data.projections.summary.projectedGain, data.settings.displayCurrency)} in{" "}
            {data.projections.summary.horizonMonths}m
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="grid gap-3 md:grid-cols-4">
          {points.map((point) => {
            const height = ((point.netWorth - minNetWorth) / range) * 100;

            return (
              <article key={point.month} className="rounded-[22px] border border-white/10 bg-white/[0.014] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {point.label}
                    </p>
                    <p className="mt-3 font-mono text-xl font-semibold text-zinc-50">
                      {formatMoney(point.netWorth, data.settings.displayCurrency)}
                    </p>
                  </div>
                  <div className="flex h-16 w-3 items-end rounded-full bg-white/10">
                    <div
                      className="w-full rounded-full bg-sky-200/80"
                      style={{ height: `${Math.max(8, height)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-xs text-zinc-500">
                  <p>Assets {formatMoney(point.assets, data.settings.displayCurrency)}</p>
                  <p>Liabilities {formatMoney(point.liabilities, data.settings.displayCurrency)}</p>
                  <p>Income {formatMoney(point.projectedIncome, data.settings.displayCurrency)}</p>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="rounded-[22px] border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Inputs used
          </p>
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <ProjectionInputRow
              label="Assets with growth"
              value={[...data.marketAssets, ...data.manualAssets].filter(
                (asset) => asset.expectedAnnualGrowthPercent !== null,
              ).length.toString()}
            />
            <ProjectionInputRow
              label="Income assets"
              value={[...data.marketAssets, ...data.manualAssets].filter((asset) => asset.isIncomeProducing).length.toString()}
            />
            <ProjectionInputRow
              label="Liabilities with payoff"
              value={data.liabilities.filter((liability) => liability.payoffMonths !== null).length.toString()}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function ProjectionInputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-100">{value}</span>
    </div>
  );
}

function SimulationLab({ data }: { data: PortfolioPageData }) {
  const allAssets = useMemo(
    () => [...data.marketAssets, ...data.manualAssets],
    [data.marketAssets, data.manualAssets],
  );
  const categoryOptions = useMemo(
    () => ["All", ...Array.from(new Set(allAssets.map((asset) => asset.visualCategory))).sort()],
    [allAssets],
  );
  const [horizonMonths, setHorizonMonths] = useState(60);
  const [category, setCategory] = useState("All");
  const [includeGrowth, setIncludeGrowth] = useState(true);
  const [includeIncome, setIncludeIncome] = useState(true);
  const [includePayoff, setIncludePayoff] = useState(true);
  const [growthAdjustment, setGrowthAdjustment] = useState(0);
  const simulation = useMemo(
    () =>
      buildSimulation({
        data,
        category,
        horizonMonths,
        includeGrowth,
        includeIncome,
        includePayoff,
        growthAdjustment,
      }),
    [category, data, growthAdjustment, horizonMonths, includeGrowth, includeIncome, includePayoff],
  );
  const finalPoint = simulation.points.at(-1) ?? simulation.points[0];

  return (
    <section className="panel mt-5 rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Projection Lab
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Scenario simulator</h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold text-zinc-50">
            {formatMoney(finalPoint.netWorth, data.settings.displayCurrency)}
          </p>
          <p className={`mt-1 text-sm ${changeTone(finalPoint.netWorth - simulation.currentNetWorth)}`}>
            {formatMoney(finalPoint.netWorth - simulation.currentNetWorth, data.settings.displayCurrency)} delta
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-[24px] border border-white/10 bg-black/10 p-4">
          <div className="grid gap-4">
            <Field label="Horizon">
              <select
                className={selectClass}
                value={horizonMonths}
                onChange={(event) => setHorizonMonths(Number(event.target.value))}
              >
                {[12, 24, 36, 60, 120].map((months) => (
                  <option key={months} value={months}>
                    {months} months
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Asset category">
              <select
                className={selectClass}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Growth shock">
              <input
                className={fieldClass}
                type="number"
                step="0.25"
                value={growthAdjustment}
                onChange={(event) => setGrowthAdjustment(Number(event.target.value))}
              />
            </Field>
            <div className="grid gap-2">
              <ToggleRow checked={includeGrowth} label="Use asset growth" onChange={setIncludeGrowth} />
              <ToggleRow checked={includeIncome} label="Use asset income" onChange={setIncludeIncome} />
              <ToggleRow checked={includePayoff} label="Use liability payoff" onChange={setIncludePayoff} />
            </div>
          </div>
        </aside>

        <div className="grid gap-4">
          <ScenarioLineChart
            currency={data.settings.displayCurrency}
            points={simulation.points}
            series={[
              { key: "netWorth", label: "Net worth", color: "rgba(186,230,253,0.95)" },
            ]}
            title="Projected net worth"
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <ScenarioLineChart
              currency={data.settings.displayCurrency}
              points={simulation.points}
              series={[
                { key: "assets", label: "Assets", color: "rgba(167,243,208,0.9)" },
                { key: "liabilities", label: "Liabilities", color: "rgba(252,165,165,0.85)" },
              ]}
              title="Assets vs liabilities"
            />
            <ScenarioBarChart
              currency={data.settings.displayCurrency}
              points={simulation.points}
              title="Cumulative projected income"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.012] px-3 py-2 text-sm text-zinc-300">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

type SimulationPoint = {
  month: number;
  label: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  projectedIncome: number;
};

type ScenarioSeries = {
  key: "assets" | "liabilities" | "netWorth";
  label: string;
  color: string;
};

function ScenarioLineChart({
  currency,
  points,
  series,
  title,
}: {
  currency: CurrencyCode;
  points: SimulationPoint[];
  series: ScenarioSeries[];
  title: string;
}) {
  const values = series.flatMap((item) => points.map((point) => point[item.key]));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || Math.max(Math.abs(max), 1);
  const xStep = points.length > 1 ? 100 / (points.length - 1) : 0;

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.014] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">{title}</h3>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="bar-grid relative h-60 rounded-[20px] border border-white/10 bg-black/10 p-4">
        <svg className="h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {series.map((item) => {
            const path = points
              .map((point, index) => {
                const x = points.length > 1 ? index * xStep : 50;
                const y = 88 - ((point[item.key] - min) / range) * 68;
                return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              })
              .join(" ");

            return (
              <path
                key={item.key}
                d={path}
                fill="none"
                stroke={item.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-4">
          {points.map((point, index) => {
            const x = points.length > 1 ? index * xStep : 50;
            const y = 88 - ((point.netWorth - min) / range) * 68;

            return (
              <div
                key={point.month}
                className="group pointer-events-auto absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span className="absolute left-1/2 top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-black/45 transition group-hover:scale-125" />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-xl border border-white/14 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.42)] backdrop-blur transition group-hover:opacity-100">
                  <span className="block whitespace-nowrap font-semibold">{point.label}</span>
                  <span className="mt-1 block whitespace-nowrap">Net {formatMoney(point.netWorth, currency)}</span>
                  <span className="mt-1 block whitespace-nowrap text-zinc-500">Assets {formatMoney(point.assets, currency)}</span>
                  <span className="block whitespace-nowrap text-zinc-500">Liabilities {formatMoney(point.liabilities, currency)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function ScenarioBarChart({
  currency,
  points,
  title,
}: {
  currency: CurrencyCode;
  points: SimulationPoint[];
  title: string;
}) {
  const maxIncome = Math.max(...points.map((point) => point.projectedIncome), 1);

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.014] p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">{title}</h3>
      <div className="bar-grid flex h-60 items-end gap-2 rounded-[20px] border border-white/10 bg-black/10 p-4">
        {points.filter((point) => point.month > 0).map((point) => (
          <div key={point.month} className="group relative flex flex-1 flex-col items-center justify-end gap-2">
            <div
              className="w-full rounded-t bg-emerald-200/75 transition group-hover:bg-emerald-100"
              style={{ height: `${Math.max(4, (point.projectedIncome / maxIncome) * 100)}%` }}
            />
            <span className="font-mono text-[10px] text-zinc-500">{point.label}</span>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-xl border border-white/14 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.42)] backdrop-blur transition group-hover:opacity-100">
              {formatMoney(point.projectedIncome, currency)}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildSimulation({
  data,
  category,
  horizonMonths,
  includeGrowth,
  includeIncome,
  includePayoff,
  growthAdjustment,
}: {
  data: PortfolioPageData;
  category: string;
  horizonMonths: number;
  includeGrowth: boolean;
  includeIncome: boolean;
  includePayoff: boolean;
  growthAdjustment: number;
}) {
  const allAssets = [...data.marketAssets, ...data.manualAssets];
  const selectedAssets =
    category === "All" ? allAssets : allAssets.filter((asset) => asset.visualCategory === category);
  const baseAssets = allAssets.reduce((sum, asset) => sum + asset.displayValue, 0);
  const simulatedBaseAssets = selectedAssets.reduce((sum, asset) => sum + asset.displayValue, 0);
  const untouchedAssets = baseAssets - simulatedBaseAssets;
  const currentLiabilities = data.liabilities.reduce((sum, liability) => sum + liability.displayBalance, 0);
  const months = Array.from({ length: Math.floor(horizonMonths / 6) + 1 }, (_, index) => index * 6)
    .filter((month) => month <= horizonMonths);
  if (!months.includes(horizonMonths)) {
    months.push(horizonMonths);
  }
  const points = months.map((month) => {
    const simulatedAssets = selectedAssets.reduce((sum, asset) => {
      const annualGrowth = includeGrowth
        ? ((asset.expectedAnnualGrowthPercent ?? 0) + growthAdjustment) / 100
        : 0;
      const monthlyGrowth = annualGrowth === 0 ? 0 : Math.pow(1 + annualGrowth, 1 / 12) - 1;
      const activeMonths = getSimulationActiveMonths(asset.maturityDate, month);
      return sum + asset.displayValue * Math.pow(1 + monthlyGrowth, activeMonths);
    }, 0);
    const projectedIncome = includeIncome
      ? selectedAssets.reduce((sum, asset) => {
          if (!asset.isIncomeProducing || !asset.displayMonthlyIncome) {
            return sum;
          }
          return sum + asset.displayMonthlyIncome * getSimulationActiveMonths(asset.maturityDate, month);
        }, 0)
      : 0;
    const liabilities = data.liabilities.reduce((sum, liability) => {
      if (!includePayoff || !liability.payoffMonths || liability.payoffMonths <= 0) {
        return sum + liability.displayBalance;
      }

      const remainingRatio = Math.max(0, 1 - month / liability.payoffMonths);
      return sum + liability.displayBalance * remainingRatio;
    }, 0);
    const assets = untouchedAssets + simulatedAssets + projectedIncome;

    return {
      month,
      label: month === 0 ? "Now" : `${month}m`,
      assets,
      liabilities,
      projectedIncome,
      netWorth: assets - liabilities,
    };
  });

  return {
    currentNetWorth: baseAssets - currentLiabilities,
    points,
  };
}

function getSimulationActiveMonths(maturityDate: string | null, projectedMonth: number) {
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

function AssetSection({
  title,
  assets,
  emptyLabel,
  onEdit,
  onTransaction,
  onArchive,
  onArchiveTransaction,
}: {
  title: string;
  assets: PortfolioAssetView[];
  emptyLabel: string;
  onEdit: (asset: PortfolioAssetView) => void;
  onTransaction: ((asset: PortfolioAssetView) => void) | null;
  onArchive: (asset: PortfolioAssetView) => void;
  onArchiveTransaction: (transactionId: string) => void;
}) {
  return (
    <section className="panel rounded-[28px] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{title}</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">{assets.length} positions</h2>
        </div>
      </div>
      <div className="space-y-3">
        {assets.length > 0 ? (
          assets.map((asset) => (
            <article key={asset.id} className="rounded-[24px] border border-white/10 bg-white/[0.014] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-zinc-50">{asset.name}</h3>
                    {asset.symbol ? <span className="font-mono text-xs text-zinc-400">{asset.symbol}</span> : null}
                    <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-300">
                      {asset.visualCategory}
                    </span>
                    <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(asset.priceStatus)}`}>
                      {asset.priceStatus}
                    </span>
                    {asset.isIncomeProducing ? (
                      <span className="rounded-full border border-emerald-300/20 px-2 py-1 text-xs text-emerald-100">
                        income
                      </span>
                    ) : null}
                    {asset.maturityDate ? (
                      <span className="rounded-full border border-sky-300/20 px-2 py-1 text-xs text-sky-100">
                        matures {formatDateOnly(asset.maturityDate)}
                      </span>
                    ) : null}
                  </div>
                  {asset.accountNote ? <p className="mt-2 text-sm text-zinc-500">{asset.accountNote}</p> : null}
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl font-semibold text-zinc-50">
                    {formatMoney(asset.displayValue, asset.displayCurrency)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatMoney(asset.currentTotalValue, asset.currency)}
                  </p>
                </div>
              </div>

              {asset.kind === "MARKET_ASSET" ? (
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <AssetStat label="Quantity" value={formatQuantity(asset.quantityHeld)} />
                  <AssetStat label="Unit price" value={asset.currentUnitPrice ? formatMoney(asset.currentUnitPrice, asset.currency) : "-"} />
                  <AssetStat label="Avg cost" value={asset.averageCost ? formatMoney(asset.averageCost, asset.currency) : "-"} />
                  <AssetStat
                    label="Unrealized P/L"
                    value={asset.unrealizedGain === null ? "-" : formatChange(asset.unrealizedGain, asset.unrealizedGainPercent, asset.displayCurrency)}
                    tone={changeTone(asset.unrealizedGain)}
                  />
                </div>
              ) : null}

              {asset.kind === "MARKET_ASSET" && asset.quantityHeld === 0 ? (
                <div className="mt-4 rounded-[20px] border border-amber-300/20 bg-amber-300/[0.035] p-3 text-sm text-amber-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>No position is recorded yet, so this asset is valued at zero.</span>
                    {onTransaction ? (
                      <button type="button" className={ghostButton} onClick={() => onTransaction(asset)}>
                        Add BUY
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {(asset.expectedAnnualGrowthPercent !== null || asset.isIncomeProducing || asset.maturityDate) ? (
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <AssetStat
                    label="Expected growth"
                    value={
                      asset.expectedAnnualGrowthPercent === null
                        ? "-"
                        : `${asset.expectedAnnualGrowthPercent.toFixed(2)}% / year`
                    }
                  />
                  <AssetStat
                    label="Expected income"
                    value={
                      asset.isIncomeProducing && asset.displayMonthlyIncome
                        ? `${formatMoney(asset.displayMonthlyIncome, asset.displayCurrency)} / month`
                        : "-"
                    }
                  />
                  <AssetStat
                    label="Maturity"
                    value={asset.maturityDate ? formatDateOnly(asset.maturityDate) : "-"}
                  />
                </div>
              ) : null}

              {asset.transactions.length > 0 ? (
                <div className="mt-4 rounded-[20px] border border-white/10 bg-black/10 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Recent transactions
                  </p>
                  <div className="space-y-2">
                    {asset.transactions.slice(0, 4).map((transaction) => (
                      <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
                        <span>
                          {transaction.type.replace("_", " ")} · {formatQuantity(transaction.quantity)} ·{" "}
                          {transaction.grossAmount ? formatMoney(transaction.grossAmount, transaction.currency) : "no amount"}
                        </span>
                        <button type="button" className="text-xs font-semibold text-zinc-500 hover:text-zinc-50" onClick={() => onArchiveTransaction(transaction.id)}>
                          Archive
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {onTransaction ? (
                  <button type="button" className={subtleButton} onClick={() => onTransaction(asset)}>
                    Add transaction
                  </button>
                ) : null}
                <button type="button" className={ghostButton} onClick={() => onEdit(asset)}>
                  Edit
                </button>
                <button type="button" className={ghostButton} onClick={() => onArchive(asset)}>
                  Archive
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-[24px] border border-white/10 bg-white/[0.014] p-4 text-sm text-zinc-500">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

function LiabilitySection({
  liabilities,
  onEdit,
  onArchive,
}: {
  liabilities: PortfolioLiabilityView[];
  onEdit: (liability: PortfolioLiabilityView) => void;
  onArchive: (liability: PortfolioLiabilityView) => void;
}) {
  return (
    <section className="panel rounded-[28px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Liabilities</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-50">{liabilities.length} open balances</h2>
      <div className="mt-5 space-y-3">
        {liabilities.length > 0 ? (
          liabilities.map((liability) => (
            <article key={liability.id} className="rounded-[24px] border border-white/10 bg-white/[0.014] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-50">{liability.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {liability.type.replace("_", " ")}
                    {liability.accountNote ? ` · ${liability.accountNote}` : ""}
                    {liability.payoffMonths ? ` · paid in ${liability.payoffMonths}m` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl font-semibold text-zinc-50">
                    {formatMoney(liability.displayBalance, liability.displayCurrency)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatMoney(liability.currentBalance, liability.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={ghostButton} onClick={() => onEdit(liability)}>
                  Edit
                </button>
                <button type="button" className={ghostButton} onClick={() => onArchive(liability)}>
                  Archive
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-[24px] border border-white/10 bg-white/[0.014] p-4 text-sm text-zinc-500">
            No liabilities yet.
          </p>
        )}
      </div>
    </section>
  );
}

function AssetStat({ label, value, tone = "text-zinc-300" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono ${tone}`}>{value}</p>
    </div>
  );
}

function MarketAssetForm({
  asset,
  isPending,
  onSubmit,
}: {
  asset?: PortfolioAssetView;
  isPending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [createInitialBuy, setCreateInitialBuy] = useState(!asset);
  const [inputMode, setInputMode] = useState<"AMOUNT" | "QUANTITY">("AMOUNT");
  const [quantity, setQuantity] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [unitPrice, setUnitPrice] = useState(asset?.currentUnitPrice?.toString() ?? "");
  const [isIncomeProducing, setIsIncomeProducing] = useState(asset?.isIncomeProducing ?? false);

  const computed = useMemo(() => computeTrade(inputMode, quantity, grossAmount, unitPrice), [inputMode, quantity, grossAmount, unitPrice]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      assetId: asset?.id,
      name: String(form.get("name") ?? ""),
      symbol: String(form.get("symbol") ?? ""),
      marketType: String(form.get("marketType") ?? "CRYPTO"),
      currency: String(form.get("currency") ?? "USD"),
      autoPriceEnabled: form.get("autoPriceEnabled") === "on",
      initialUnitPrice: String(form.get("initialUnitPrice") ?? ""),
      expectedAnnualGrowthPercent: String(form.get("expectedAnnualGrowthPercent") ?? ""),
      isIncomeProducing,
      expectedMonthlyIncome: String(form.get("expectedMonthlyIncome") ?? ""),
      maturityDate: String(form.get("maturityDate") ?? ""),
      accountNote: String(form.get("accountNote") ?? ""),
      notes: String(form.get("notes") ?? ""),
      createInitialBuy,
      initialInputMode: inputMode,
      initialQuantity: quantity,
      initialGrossAmount: grossAmount,
      initialFees: String(form.get("initialFees") ?? "0"),
      initialExecutedAt: String(form.get("initialExecutedAt") ?? ""),
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><input name="name" className={fieldClass} defaultValue={asset?.name ?? ""} required /></Field>
        <Field label="Symbol"><input name="symbol" className={fieldClass} defaultValue={asset?.symbol ?? ""} required /></Field>
        <Field label="Type"><Select name="marketType" options={marketAssetTypeOptions} defaultValue={asset?.marketType ?? "CRYPTO"} /></Field>
        <Field label="Currency"><Select name="currency" options={currencyOptions} defaultValue={asset?.currency ?? "USD"} /></Field>
        <Field label="Unit price"><input name="initialUnitPrice" className={fieldClass} value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="Latest or manual price" /></Field>
        <Field label="Annual growth %"><input name="expectedAnnualGrowthPercent" type="number" step="0.01" className={fieldClass} defaultValue={asset?.expectedAnnualGrowthPercent ?? ""} placeholder="0.00" /></Field>
        <Field label="Maturity date"><input name="maturityDate" type="date" className={fieldClass} defaultValue={asset?.maturityDate ?? ""} /></Field>
        <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-300">
          <input name="autoPriceEnabled" type="checkbox" defaultChecked={asset?.autoPriceEnabled ?? true} />
          Auto refresh price
        </label>
        <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-300">
          <input
            name="isIncomeProducing"
            type="checkbox"
            checked={isIncomeProducing}
            onChange={(event) => setIsIncomeProducing(event.target.checked)}
          />
          Income producing
        </label>
        <Field label="Monthly income">
          <input
            name="expectedMonthlyIncome"
            type="number"
            step="0.01"
            min="0"
            className={fieldClass}
            defaultValue={asset?.expectedMonthlyIncome ?? ""}
            disabled={!isIncomeProducing}
            placeholder="0.00"
          />
        </Field>
      </div>

      {!asset ? (
        <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-300">
          <input type="checkbox" checked={createInitialBuy} onChange={(event) => setCreateInitialBuy(event.target.checked)} />
          Add initial position
        </label>
      ) : null}

      {createInitialBuy ? (
        <TradeInputs
          inputMode={inputMode}
          setInputMode={setInputMode}
          quantity={quantity}
          setQuantity={setQuantity}
          grossAmount={grossAmount}
          setGrossAmount={setGrossAmount}
          unitPrice={unitPrice}
          computed={computed}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Account note"><input name="accountNote" className={fieldClass} defaultValue={asset?.accountNote ?? ""} /></Field>
        <Field label="Executed at"><input name="initialExecutedAt" type="date" className={fieldClass} defaultValue={today()} /></Field>
      </div>
      <Field label="Notes"><textarea name="notes" className={textAreaClass} defaultValue={asset?.notes ?? ""} /></Field>
      <input name="initialFees" type="hidden" value="0" />
      <button type="submit" className={primaryButton} disabled={isPending}>{asset ? "Save asset" : "Create asset"}</button>
    </form>
  );
}

function ManualAssetForm({
  asset,
  isPending,
  onSubmit,
}: {
  asset?: PortfolioAssetView;
  isPending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [isIncomeProducing, setIsIncomeProducing] = useState(asset?.isIncomeProducing ?? false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      assetId: asset?.id,
      name: String(form.get("name") ?? ""),
      manualType: String(form.get("manualType") ?? "CASH"),
      currency: String(form.get("currency") ?? "USD"),
      manualValue: String(form.get("manualValue") ?? "0"),
      expectedAnnualGrowthPercent: String(form.get("expectedAnnualGrowthPercent") ?? ""),
      isIncomeProducing,
      expectedMonthlyIncome: String(form.get("expectedMonthlyIncome") ?? ""),
      maturityDate: String(form.get("maturityDate") ?? ""),
      accountNote: String(form.get("accountNote") ?? ""),
      notes: String(form.get("notes") ?? ""),
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><input name="name" className={fieldClass} defaultValue={asset?.name ?? ""} required /></Field>
        <Field label="Category"><Select name="manualType" options={manualAssetTypeOptions} defaultValue={asset?.manualType ?? "CASH"} /></Field>
        <Field label="Currency"><Select name="currency" options={currencyOptions} defaultValue={asset?.currency ?? "USD"} /></Field>
        <Field label="Value"><input name="manualValue" type="number" step="0.01" min="0" className={fieldClass} defaultValue={asset?.manualValue ?? ""} required /></Field>
        <Field label="Annual growth %"><input name="expectedAnnualGrowthPercent" type="number" step="0.01" className={fieldClass} defaultValue={asset?.expectedAnnualGrowthPercent ?? ""} placeholder="0.00" /></Field>
        <Field label="Maturity date"><input name="maturityDate" type="date" className={fieldClass} defaultValue={asset?.maturityDate ?? ""} /></Field>
        <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-300">
          <input
            name="isIncomeProducing"
            type="checkbox"
            checked={isIncomeProducing}
            onChange={(event) => setIsIncomeProducing(event.target.checked)}
          />
          Income producing
        </label>
        <Field label="Monthly income">
          <input
            name="expectedMonthlyIncome"
            type="number"
            step="0.01"
            min="0"
            className={fieldClass}
            defaultValue={asset?.expectedMonthlyIncome ?? ""}
            disabled={!isIncomeProducing}
            placeholder="0.00"
          />
        </Field>
        <Field label="Account note"><input name="accountNote" className={fieldClass} defaultValue={asset?.accountNote ?? ""} /></Field>
      </div>
      <Field label="Notes"><textarea name="notes" className={textAreaClass} defaultValue={asset?.notes ?? ""} /></Field>
      <button type="submit" className={primaryButton} disabled={isPending}>{asset ? "Save asset" : "Create asset"}</button>
    </form>
  );
}

function LiabilityForm({
  liability,
  isPending,
  onSubmit,
}: {
  liability?: PortfolioLiabilityView;
  isPending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      liabilityId: liability?.id,
      name: String(form.get("name") ?? ""),
      type: String(form.get("type") ?? "OTHER"),
      currency: String(form.get("currency") ?? "USD"),
      currentBalance: String(form.get("currentBalance") ?? "0"),
      payoffMonths: String(form.get("payoffMonths") ?? ""),
      accountNote: String(form.get("accountNote") ?? ""),
      notes: String(form.get("notes") ?? ""),
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><input name="name" className={fieldClass} defaultValue={liability?.name ?? ""} required /></Field>
        <Field label="Type"><Select name="type" options={liabilityTypeOptions} defaultValue={liability?.type ?? "OTHER"} /></Field>
        <Field label="Currency"><Select name="currency" options={currencyOptions} defaultValue={liability?.currency ?? "USD"} /></Field>
        <Field label="Balance"><input name="currentBalance" type="number" step="0.01" min="0" className={fieldClass} defaultValue={liability?.currentBalance ?? ""} required /></Field>
        <Field label="Payoff months"><input name="payoffMonths" type="number" min="1" step="1" className={fieldClass} defaultValue={liability?.payoffMonths ?? ""} placeholder="Optional" /></Field>
        <Field label="Account note"><input name="accountNote" className={fieldClass} defaultValue={liability?.accountNote ?? ""} /></Field>
      </div>
      <Field label="Notes"><textarea name="notes" className={textAreaClass} defaultValue={liability?.notes ?? ""} /></Field>
      <button type="submit" className={primaryButton} disabled={isPending}>{liability ? "Save liability" : "Create liability"}</button>
    </form>
  );
}

function TransactionForm({
  assets,
  initialAsset,
  isPending,
  onSubmit,
}: {
  assets: PortfolioAssetView[];
  initialAsset?: PortfolioAssetView;
  isPending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [assetId, setAssetId] = useState(initialAsset?.id ?? assets[0]?.id ?? "");
  const selectedAsset = assets.find((asset) => asset.id === assetId) ?? assets[0];
  const [type, setType] = useState("BUY");
  const [inputMode, setInputMode] = useState<"AMOUNT" | "QUANTITY">("AMOUNT");
  const [quantity, setQuantity] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [unitPrice, setUnitPrice] = useState(selectedAsset?.currentUnitPrice?.toString() ?? "");

  const computed = useMemo(() => computeTrade(inputMode, quantity, grossAmount, unitPrice), [inputMode, quantity, grossAmount, unitPrice]);
  const overdrawn = (type === "SELL" || type === "TRANSFER_OUT") && computed.quantity > (selectedAsset?.quantityHeld ?? 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      assetId,
      type,
      inputMode,
      quantity,
      unitPrice,
      grossAmount,
      fees: String(form.get("fees") ?? "0"),
      currency: String(form.get("currency") ?? selectedAsset?.currency ?? "USD"),
      executedAt: String(form.get("executedAt") ?? ""),
      accountNote: String(form.get("accountNote") ?? ""),
      notes: String(form.get("notes") ?? ""),
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Asset">
          <select
            className={selectClass}
            value={assetId}
            onChange={(event) => {
              const nextAssetId = event.target.value;
              const nextAsset = assets.find((asset) => asset.id === nextAssetId);
              setAssetId(nextAssetId);
              setUnitPrice(nextAsset?.currentUnitPrice?.toString() ?? "");
            }}
            required
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name} {asset.symbol ? `(${asset.symbol})` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select className={selectClass} value={type} onChange={(event) => setType(event.target.value)}>
            {transactionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency"><Select name="currency" options={currencyOptions} defaultValue={selectedAsset?.currency ?? "USD"} /></Field>
        <Field label="Executed at"><input name="executedAt" type="date" className={fieldClass} defaultValue={today()} required /></Field>
      </div>

      <TradeInputs
        inputMode={inputMode}
        setInputMode={setInputMode}
        quantity={quantity}
        setQuantity={setQuantity}
        grossAmount={grossAmount}
        setGrossAmount={setGrossAmount}
        unitPrice={unitPrice}
        setUnitPrice={setUnitPrice}
        computed={computed}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fees"><input name="fees" type="number" min="0" step="0.01" className={fieldClass} defaultValue="0" /></Field>
        <Field label="Account note"><input name="accountNote" className={fieldClass} /></Field>
      </div>
      <Field label="Notes"><textarea name="notes" className={textAreaClass} required={type === "ADJUSTMENT"} /></Field>

      <div className="rounded-[20px] border border-white/10 bg-black/10 p-4 text-sm text-zinc-300">
        <p>Quantity impact: {formatQuantity(computed.quantity)}</p>
        <p>Estimated amount: {formatMoney(computed.grossAmount, selectedAsset?.currency ?? "USD")}</p>
        <p>New holding: {formatQuantity((selectedAsset?.quantityHeld ?? 0) + quantityImpact(type, computed.quantity))}</p>
        {overdrawn ? <p className="mt-2 font-semibold text-red-200">This exceeds the current holding.</p> : null}
      </div>

      <button type="submit" className={primaryButton} disabled={isPending || overdrawn || !assetId}>
        Add transaction
      </button>
    </form>
  );
}

function TradeInputs({
  inputMode,
  setInputMode,
  quantity,
  setQuantity,
  grossAmount,
  setGrossAmount,
  unitPrice,
  setUnitPrice,
  computed,
}: {
  inputMode: "AMOUNT" | "QUANTITY";
  setInputMode: (value: "AMOUNT" | "QUANTITY") => void;
  quantity: string;
  setQuantity: (value: string) => void;
  grossAmount: string;
  setGrossAmount: (value: string) => void;
  unitPrice: string;
  setUnitPrice?: (value: string) => void;
  computed: { quantity: number; grossAmount: number };
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.012] p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={inputMode === "AMOUNT" ? primaryButton : ghostButton} onClick={() => setInputMode("AMOUNT")}>
          By total amount
        </button>
        <button type="button" className={inputMode === "QUANTITY" ? primaryButton : ghostButton} onClick={() => setInputMode("QUANTITY")}>
          By asset quantity
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Unit price">
          <input className={fieldClass} value={unitPrice} onChange={(event) => setUnitPrice?.(event.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Quantity">
          <input className={fieldClass} value={inputMode === "AMOUNT" ? formatInputNumber(computed.quantity) : quantity} onChange={(event) => setQuantity(event.target.value)} disabled={inputMode === "AMOUNT"} placeholder="0.00000000" />
        </Field>
        <Field label="Gross amount">
          <input className={fieldClass} value={inputMode === "QUANTITY" ? formatInputNumber(computed.grossAmount) : grossAmount} onChange={(event) => setGrossAmount(event.target.value)} disabled={inputMode === "QUANTITY"} placeholder="0.00" />
        </Field>
      </div>
    </div>
  );
}

function SettingsForm({
  data,
  isPending,
  onSubmit,
}: {
  data: PortfolioPageData;
  isPending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      displayCurrency: String(form.get("displayCurrency") ?? "USD"),
      priceRefreshHours: String(form.get("priceRefreshHours") ?? "1"),
      snapshotIntervalHours: String(form.get("snapshotIntervalHours") ?? "24"),
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Display currency"><Select name="displayCurrency" options={currencyOptions} defaultValue={data.settings.displayCurrency} /></Field>
        <Field label="Price refresh hours"><input name="priceRefreshHours" type="number" min="1" className={fieldClass} defaultValue={data.settings.priceRefreshHours} /></Field>
        <Field label="Snapshot hours"><input name="snapshotIntervalHours" type="number" min="1" className={fieldClass} defaultValue={data.settings.snapshotIntervalHours} /></Field>
      </div>
      <button type="submit" className={primaryButton} disabled={isPending}>Save settings</button>
    </form>
  );
}

function CheckpointForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (note: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(String(form.get("note") ?? ""));
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <Field label="Note"><textarea name="note" className={textAreaClass} placeholder="Optional checkpoint note" /></Field>
      <button type="submit" className={primaryButton} disabled={isPending}>Create checkpoint</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Select({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <select name={name} className={selectClass} defaultValue={defaultValue}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function modalTitle(modal: NonNullable<ModalState>) {
  if (modal.type === "market") return modal.asset ? "Edit market asset" : "Add market asset";
  if (modal.type === "manual") return modal.asset ? "Edit manual asset" : "Add manual asset";
  if (modal.type === "liability") return modal.liability ? "Edit liability" : "Add liability";
  if (modal.type === "transaction") return "Add transaction";
  if (modal.type === "settings") return "Portfolio settings";
  return "Create checkpoint";
}

function computeTrade(inputMode: "AMOUNT" | "QUANTITY", quantity: string, grossAmount: string, unitPrice: string) {
  const price = Number(unitPrice);
  const qty = Number(quantity);
  const amount = Number(grossAmount);

  if (!Number.isFinite(price) || price <= 0) {
    return { quantity: 0, grossAmount: 0 };
  }

  if (inputMode === "AMOUNT") {
    return {
      quantity: Number.isFinite(amount) && amount > 0 ? amount / price : 0,
      grossAmount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    };
  }

  return {
    quantity: Number.isFinite(qty) && qty > 0 ? qty : 0,
    grossAmount: Number.isFinite(qty) && qty > 0 ? qty * price : 0,
  };
}

function quantityImpact(type: string, quantity: number) {
  if (type === "SELL" || type === "TRANSFER_OUT") {
    return -quantity;
  }
  return quantity;
}

function statusClass(status: string) {
  if (status === "auto") return "border-emerald-300/25 text-emerald-100";
  if (status === "stale") return "border-amber-300/25 text-amber-100";
  if (status === "error") return "border-red-300/25 text-red-100";
  return "border-white/10 text-zinc-300";
}

function changeTone(value: number | null) {
  if (value === null) return "text-zinc-500";
  if (value > 0) return "text-emerald-200";
  if (value < 0) return "text-red-200";
  return "text-zinc-400";
}

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

function formatChange(value: number | null, percent: number | null, currency: CurrencyCode) {
  return formatPeriodChange(value, percent, currency, "7d");
}

function formatPeriodChange(
  value: number | null,
  percent: number | null,
  currency: CurrencyCode,
  period: string,
) {
  if (value === null) return `No ${period} baseline`;
  const sign = value > 0 ? "+" : "";
  const pct = percent === null ? "" : ` / ${sign}${(percent * 100).toFixed(2)}%`;
  return `${sign}${formatMoney(value, currency)}${pct} last ${period}`;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1 ? 4 : 8,
  }).format(value);
}

function formatInputNumber(value: number) {
  if (!value) return "";
  return Number(value.toFixed(8)).toString();
}

function formatDate(value: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
