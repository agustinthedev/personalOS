import Link from "next/link";
import { SportsPlannerClient } from "@/features/sports/components/SportsPlannerClient";
import { getSportsData } from "@/features/sports/data";

export const dynamic = "force-dynamic";

export default async function SportsPlannerPage() {
  const data = await getSportsData();

  return (
    <main className="app-shell min-h-screen text-zinc-50">
      <section className="soft-grid min-h-screen px-3 py-4 md:px-8 md:py-5">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6">
            <div>
              <Link href="/" className="text-sm font-medium text-zinc-50">
                Personal OS
              </Link>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                Sports Planner
              </p>
              <h1 className="liquid-text mt-2 text-4xl font-semibold md:text-5xl">
                Upcoming events
              </h1>
            </div>
          </header>
          <SportsPlannerClient initialData={data} />
        </div>
      </section>
    </main>
  );
}
