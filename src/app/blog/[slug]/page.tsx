import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/features/blog/components/ArticleBody";
import { getArticleBySlug, parseTags } from "@/features/blog/data";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article || article.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <main className="app-shell min-h-screen text-slate-900">
      <section className="soft-grid px-4 py-5 md:px-8">
        <article className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="panel overflow-hidden rounded-[28px]">
            <header className="border-b border-white/8 p-5 md:p-8">
              <Link href="/blog" className="text-sm font-medium text-slate-900">
                Back to blog
              </Link>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <span className="rounded-[28px] border border-cyan-100/20 bg-cyan-100/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-900">
                  Published
                </span>
                <span className="font-mono text-xs text-slate-600">
                  {article.topic} - {article.readingMinutes} min read
                </span>
              </div>
              <h1 className="liquid-text mt-5 max-w-5xl text-4xl font-semibold leading-tight md:text-7xl">
                {article.title}
              </h1>
              <p className="mt-5 max-w-3xl text-xl leading-8 text-slate-700">
                {article.subtitle}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {parseTags(article.tags).map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            <div className="px-5 py-8 md:px-10">
              <ArticleBody body={article.body} title={article.title} />
            </div>
          </div>

          <aside>
            <div className="panel rounded-[28px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                Reading Metrics
              </p>
              <div className="mt-5 grid gap-3">
                <Stat label="Minutes" value={article.readingMinutes.toString()} />
                <Stat label="Topic" value={article.topic} />
                <Stat label="Generator" value={article.generatedBy} />
              </div>
            </div>
          </aside>
        </article>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-muted rounded-[28px] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
