import Link from "next/link";
import { PortfolioClient } from "@/features/portfolio/components/PortfolioClient";
import { getPortfolioPageData } from "@/features/portfolio/data";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const data = await getPortfolioPageData();

  return (
    <main className="app-shell min-h-screen text-zinc-50">
      <section className="soft-grid min-h-screen px-4 py-5 md:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Link href="/" className="text-sm font-medium text-zinc-50">
                Personal OS
              </Link>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-50">
                Portfolio
              </p>
              <h1 className="liquid-text mt-3 text-5xl font-semibold md:text-7xl">
                Net Worth
              </h1>
            </div>

            <div className="panel-muted grid gap-3 rounded-[28px] p-4 text-sm text-zinc-300 sm:grid-cols-3">
              <PortfolioStat label="Currency" value={data.settings.displayCurrency} />
              <PortfolioStat label="Price Refresh" value={`${data.settings.priceRefreshHours}h`} />
              <PortfolioStat label="Snapshot" value={`${data.settings.snapshotIntervalHours}h`} />
            </div>
          </header>

          <PortfolioClient initialData={data} />
        </div>
      </section>
    </main>
  );
}

function PortfolioStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 text-center">
      <p className="font-mono text-2xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </p>
    </div>
  );
}
