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
    accent: "from-white/80 to-zinc-400/40",
    description: "Generated morning readings built around one useful idea.",
  },
  {
    name: "Dashboard",
    href: "/",
    status: "Core",
    metric: "Signals",
    accent: "from-zinc-100/75 to-zinc-500/40",
    description: "The command center that will collect signals from every mini app.",
  },
  {
    name: "Next app",
    href: "/",
    status: "Queued",
    metric: "TBD",
    accent: "from-white/65 to-zinc-600/35",
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
    <main className="app-shell min-h-screen text-zinc-50">
      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[96px_1fr]">
        <SideNav />

        <section className="soft-grid px-4 py-4 md:px-8 md:py-6">
          <TopBar />

          <div className="mx-auto max-w-7xl space-y-5">
            <section className="panel overflow-hidden rounded-[28px]">
              <div className="grid gap-6 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-8">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Chip label="personal-os" tone="bright" />
                    <Chip label="daily intelligence" tone="soft" />
                    <Chip label="local-first" tone="dim" />
                  </div>

                  <h1 className="liquid-text mt-8 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-normal md:text-7xl">
                    Personal systems, rendered as a command dashboard.
                  </h1>
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
                    A liquid glass operating surface for daily reading, personal
                    signals, automations, and the mini apps that will power your day.
                  </p>
                </div>

                <TodayPanel latestArticle={latestArticle} />
              </div>
              <div className="glow-line h-1" />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Apps online" value={apps.length.toString()} delta="+ core ready" tone="bright" />
              <MetricCard label="Published reads" value={articles.length.toString()} delta="daily cadence" tone="soft" />
              <MetricCard label="Automation" value="Ready" delta="script enabled" tone="dim" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="panel rounded-[28px] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                      System Activity
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-zinc-50">
                      Content and app signals
                    </h2>
                  </div>
                  <span className="rounded-[28px] border border-white/18 bg-white/[0.02] px-3 py-1 text-xs font-medium text-zinc-100">
                    Healthy
                  </span>
                </div>

                <div className="bar-grid mt-7 flex h-56 items-end gap-3 rounded-[28px] border border-white/10 bg-white/[0.012] px-5 pb-5">
                  {activityBars.map((height, index) => (
                    <div
                      key={index}
                      className="flex flex-1 flex-col justify-end gap-1"
                      aria-hidden="true"
                    >
                      <div
                        className="rounded-t bg-gradient-to-t from-white/70 to-zinc-500/35 shadow-[0_0_20px_rgba(255,255,255,0.12)]"
                        style={{ height: `${height}%` }}
                      />
                      <div className="h-1 rounded bg-white/50" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                {apps.map((app) => (
                  <Link
                    key={app.name}
                    href={app.href}
                    className="panel group rounded-[28px] p-5 transition hover:-translate-y-0.5 hover:border-white/45"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                        {app.status}
                      </p>
                      <span className={`h-2 w-10 rounded-full bg-gradient-to-r ${app.accent}`} />
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-4">
                      <h2 className="text-2xl font-semibold text-zinc-50">{app.name}</h2>
                      <p className="font-mono text-sm text-zinc-300">{app.metric}</p>
                    </div>
                    <p className="mt-4 leading-7 text-zinc-300">{app.description}</p>
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
      <div className="flex items-center gap-2 text-sm text-zinc-300">
        <span className="text-zinc-500">Dashboard</span>
        <span>/</span>
        <span className="glass-button rounded-[28px] px-3 py-1 text-zinc-50">
          Personal OS
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="glass-button h-9 rounded-[28px] px-3 text-sm text-zinc-300">
          Last 24 hours
        </button>
        <button className="glass-button h-9 rounded-[28px] px-3 text-sm text-zinc-300">
          UTC -03
        </button>
        <Link
          href="/blog"
          className="h-9 rounded-[28px] bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[0_0_28px_rgba(255,255,255,0.16)] transition hover:bg-zinc-100"
        >
          Open Blog
        </Link>
      </div>
    </div>
  );
}

function SideNav() {
  return (
    <aside className="hidden lg:flex lg:items-start lg:justify-center lg:py-5">
      <div className="panel sticky top-5 flex w-16 flex-col items-center gap-3 rounded-[28px] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[28px] bg-white text-sm font-black text-zinc-900 shadow-[0_0_26px_rgba(255,255,255,0.16)]">
        OS
      </div>
      {["D", "B", "A", "S"].map((item) => (
        <div
          key={item}
          className="glass-button flex h-10 w-10 items-center justify-center rounded-[28px] text-xs font-semibold text-zinc-300"
        >
          {item}
        </div>
      ))}
      <div className="mt-24 h-10 w-10 rounded-[28px] border border-white/10 bg-white/[0.015]" />
      </div>
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
      <aside className="panel-muted rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-50">
          Today&apos;s reading
        </p>
        <h2 className="mt-5 text-3xl font-semibold text-zinc-50">
          No published articles yet.
        </h2>
        <p className="mt-4 leading-7 text-zinc-300">
          Run `npm run db:migrate` and then `npm run article:generate` to create
          the first reading.
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel-muted rounded-[28px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-50">
        Today&apos;s reading
      </p>
      <h2 className="mt-5 text-3xl font-semibold leading-tight text-zinc-50">
        {latestArticle.title}
      </h2>
      <p className="mt-4 leading-7 text-zinc-300">{latestArticle.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {parseTags(latestArticle.tags).map((tag) => (
          <span
            key={tag}
            className="rounded border border-white/10 bg-white/[0.025] px-3 py-1 text-xs text-zinc-300"
          >
            {tag}
          </span>
        ))}
      </div>
      <Link
        href={`/blog/${latestArticle.slug}`}
        className="mt-6 inline-flex h-10 items-center rounded-[28px] bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
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
  tone: "bright" | "soft" | "dim";
}) {
  const tones = {
    bright: "from-white/50 to-zinc-500/5 text-zinc-200",
    soft: "from-white/42 to-zinc-500/5 text-zinc-200",
    dim: "from-white/36 to-zinc-500/5 text-zinc-200",
  };

  return (
    <div className="panel rounded-[28px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
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

function Chip({ label, tone }: { label: string; tone: "bright" | "soft" | "dim" }) {
  const tones = {
    bright: "border-white/18 bg-white/[0.025] text-zinc-200",
    soft: "border-white/16 bg-white/[0.02] text-zinc-200",
    dim: "border-white/14 bg-white/[0.018] text-zinc-200",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {label}
    </span>
  );
}
