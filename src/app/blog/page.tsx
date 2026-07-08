import Link from "next/link";
import { getPublishedArticles, parseTags } from "@/features/blog/data";

export default async function BlogPage() {
  const articles = await getPublishedArticles();

  return (
    <main className="app-shell min-h-screen text-white">
      <section className="soft-grid px-4 py-5 md:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href="/" className="text-sm font-medium text-white">
                Personal OS
              </Link>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-white">
                Daily Blog
              </p>
              <h1 className="liquid-text mt-3 text-5xl font-semibold md:text-7xl">
                Morning readings
              </h1>
            </div>
            <div className="panel-muted rounded-[28px] p-4 text-sm text-white/72">
              <p className="font-mono text-white/58">report.blog.status</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {articles.length} published
              </p>
            </div>
          </header>

          {articles.length > 0 ? (
            <div className="grid gap-4">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="panel group overflow-hidden rounded-[28px] transition hover:-translate-y-0.5 hover:border-cyan-100/35"
                >
                  <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-[28px] border border-cyan-100/20 bg-cyan-100/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                          Published
                        </span>
                        <span className="font-mono text-xs text-white/58">
                          {formatPublishedDate(article.publishedAt)} - {article.topic} -{" "}
                          {article.readingMinutes} min
                        </span>
                      </div>
                      <h2 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white">
                        {article.title}
                      </h2>
                      <p className="mt-4 max-w-3xl leading-7 text-white/72">
                        {article.summary}
                      </p>
                    </div>

                    <div className="flex flex-col justify-between gap-5 border-t border-white/10 pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {parseTags(article.tags).map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/82"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="sparkline h-20 rounded-[28px] bg-gradient-to-t from-cyan-200/55 to-violet-200/5" />
                    </div>
                  </div>
                  <div className="glow-line h-1 opacity-60 transition group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel rounded-[28px] p-6">
              <h2 className="text-2xl font-semibold text-white">No articles yet.</h2>
              <p className="mt-3 leading-7 text-white/72">
                The initial flow is ready. Run the migration and generate the first
                article to populate this view.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function formatPublishedDate(date: Date | null) {
  if (!date) {
    return "Draft date";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
