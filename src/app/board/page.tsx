import Link from "next/link";
import { BoardClient } from "@/features/board/components/BoardClient";
import { getBoardPageData } from "@/features/board/data";

export default async function BoardPage() {
  const data = await getBoardPageData();
  const boardStateKey = JSON.stringify(data);

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
                Kanban
              </p>
              <h1 className="liquid-text mt-3 text-5xl font-semibold md:text-7xl">
                Board
              </h1>
            </div>

            <div className="panel-muted grid grid-cols-3 gap-3 rounded-[28px] p-4 text-center">
              <BoardStat label="Active" value={data.summary.active.toString()} />
              <BoardStat label="Done" value={data.summary.completed.toString()} />
              <BoardStat label="Archive" value={data.summary.archived.toString()} />
            </div>
          </header>

          <BoardClient key={boardStateKey} initialData={data} />
        </div>
      </section>
    </main>
  );
}

function BoardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20">
      <p className="font-mono text-2xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </p>
    </div>
  );
}
