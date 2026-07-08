import Link from "next/link";
import {
  getLatestArticle,
  getPublishedArticles,
  parseTags,
} from "@/features/blog/data";

const apps = [
  {
    name: "Daily Blog",
    href: "/blog",
    status: "Live",
    metric: "1/day",
    accent: "from-rose-500 to-orange-400",
    description: "Generated morning readings built around one useful idea.",
  },
  {
    name: "Dashboard",
    href: "/",
    status: "Core",
    metric: "Signals",
    accent: "from-cyan-400 to-teal-300",
    description: "The command center that will collect signals from every mini app.",
  },
  {
    name: "Next app",
    href: "/",
    status: "Queued",
    metric: "TBD",
    accent: "from-violet-500 to-fuchsia-400",
    description: "Habits, finances, notes, health, or any module you want to add.",
  },
];

const activityBars = [42, 68, 52, 76, 58, 86, 74, 92, 63, 80, 72, 88];

export default async function Home() {
  const [latestArticle, articles] = await Promise.all([
    getLatestArticle(),
    getPublishedArticles(),
  ]);

  return (
    <main className="app-shell min-h-screen text-zinc-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[72px_1fr]">
        <SideNav />

        <section className="soft-grid px-4 py-4 md:px-8 md:py-6">
          <TopBar />

          <div className="mx-auto max-w-7xl space-y-5">
            <section className="panel overflow-hidden rounded-[8px]">
              <div className="grid gap-6 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-8">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Chip label="personal-os" tone="cyan" />
                    <Chip label="daily intelligence" tone="orange" />
                    <Chip label="local-first" tone="violet" />
                  </div>

                  <h1 className="mt-8 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-normal text-zinc-50 md:text-7xl">
                    Personal systems, rendered as a command dashboard.
                  </h1>
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
                    A dark operating surface for daily reading, personal signals,
                    automations, and the mini apps that will power your day.
                  </p>
                </div>

                <TodayPanel latestArticle={latestArticle} />
              </div>
              <div className="glow-line h-1" />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Apps online" value={apps.length.toString()} delta="+ core ready" tone="cyan" />
              <MetricCard label="Published reads" value={articles.length.toString()} delta="daily cadence" tone="orange" />
              <MetricCard label="Automation" value="Ready" delta="script enabled" tone="violet" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="panel rounded-[8px] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      System Activity
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-zinc-100">
                      Content and app signals
                    </h2>
                  </div>
                  <span className="rounded border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    Healthy
                  </span>
                </div>

                <div className="bar-grid mt-7 flex h-56 items-end gap-3 rounded-[6px] border border-white/5 bg-black/20 px-5 pb-5">
                  {activityBars.map((height, index) => (
                    <div
                      key={index}
                      className="flex flex-1 flex-col justify-end gap-1"
                      aria-hidden="true"
                    >
                      <div
                        className="rounded-t bg-gradient-to-t from-orange-500 to-rose-400 shadow-[0_0_20px_rgba(244,114,182,0.25)]"
                        style={{ height: `${height}%` }}
                      />
                      <div className="h-1 rounded bg-cyan-300/70" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                {apps.map((app) => (
                  <Link
                    key={app.name}
                    href={app.href}
                    className="panel group rounded-[8px] p-5 transition hover:-translate-y-0.5 hover:border-orange-300/40"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        {app.status}
                      </p>
                      <span className={`h-2 w-10 rounded-full bg-gradient-to-r ${app.accent}`} />
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-4">
                      <h2 className="text-2xl font-semibold text-zinc-50">{app.name}</h2>
                      <p className="font-mono text-sm text-zinc-400">{app.metric}</p>
                    </div>
                    <p className="mt-4 leading-7 text-zinc-400">{app.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function TopBar() {
  return (
    <div className="mx-auto mb-5 flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className="text-zinc-600">Dashboard</span>
        <span>/</span>
        <span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-cyan-200">
          Personal OS
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="h-9 rounded border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300">
          Last 24 hours
        </button>
        <button className="h-9 rounded border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300">
          UTC -03
        </button>
        <Link
          href="/blog"
          className="h-9 rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Open Blog
        </Link>
      </div>
    </div>
  );
}

function SideNav() {
  return (
    <aside className="hidden border-r border-white/8 bg-[#090a0d] lg:flex lg:flex-col lg:items-center lg:gap-4 lg:py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded bg-orange-500 text-sm font-black text-white">
        OS
      </div>
      {["D", "B", "A", "S"].map((item) => (
        <div
          key={item}
          className="flex h-9 w-9 items-center justify-center rounded border border-white/8 bg-white/[0.03] text-xs font-semibold text-zinc-500"
        >
          {item}
        </div>
      ))}
      <div className="mt-auto h-9 w-9 rounded border border-white/8 bg-white/[0.03]" />
    </aside>
  );
}

function TodayPanel({
  latestArticle,
}: {
  latestArticle: Awaited<ReturnType<typeof getLatestArticle>>;
}) {
  if (!latestArticle) {
    return (
      <aside className="panel-muted rounded-[8px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
          Today&apos;s reading
        </p>
        <h2 className="mt-5 text-3xl font-semibold text-zinc-50">
          No published articles yet.
        </h2>
        <p className="mt-4 leading-7 text-zinc-400">
          Run `npm run db:migrate` and then `npm run article:generate` to create
          the first reading.
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel-muted rounded-[8px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
        Today&apos;s reading
      </p>
      <h2 className="mt-5 text-3xl font-semibold leading-tight text-zinc-50">
        {latestArticle.title}
      </h2>
      <p className="mt-4 leading-7 text-zinc-400">{latestArticle.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {parseTags(latestArticle.tags).map((tag) => (
          <span
            key={tag}
            className="rounded border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300"
          >
            {tag}
          </span>
        ))}
      </div>
      <Link
        href={`/blog/${latestArticle.slug}`}
        className="mt-6 inline-flex h-10 items-center rounded bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-orange-200"
      >
        Read article
      </Link>
    </aside>
  );
}

function MetricCard({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "cyan" | "orange" | "violet";
}) {
  const tones = {
    cyan: "from-cyan-300/80 to-cyan-300/5 text-cyan-300",
    orange: "from-orange-400/80 to-orange-400/5 text-orange-300",
    violet: "from-violet-400/80 to-violet-400/5 text-violet-300",
  };

  return (
    <div className="panel rounded-[8px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </p>
      <p className="mt-5 text-4xl font-semibold text-zinc-50">{value}</p>
      <p className={`mt-3 text-sm font-medium ${tones[tone].split(" ").at(-1)}`}>
        {delta}
      </p>
      <div className={`sparkline mt-5 h-14 rounded bg-gradient-to-t ${tones[tone]}`} />
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "cyan" | "orange" | "violet" }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    orange: "border-orange-300/20 bg-orange-300/10 text-orange-200",
    violet: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {label}
    </span>
  );
}
