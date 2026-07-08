import Link from "next/link";
import { getPublishedArticles, parseTags } from "@/lib/articles";

export default async function BlogPage() {
  const articles = await getPublishedArticles();

  return (
    <main className="min-h-screen bg-[#f7f5f0]">
      <header className="border-b border-stone-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
          <Link href="/" className="text-sm font-medium text-teal-800">
            Personal OS
          </Link>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
              Blog diario
            </p>
            <h1 className="mt-3 text-5xl font-semibold text-stone-950">
              Lecturas para la mañana
            </h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        {articles.length > 0 ? (
          <div className="grid gap-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                className="border border-stone-300 bg-white p-5 transition hover:border-teal-800"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-stone-500">
                      {article.topic} · {article.readingMinutes} min
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                      {article.title}
                    </h2>
                    <p className="mt-3 max-w-3xl leading-7 text-stone-700">
                      {article.summary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:max-w-xs md:justify-end">
                    {parseTags(article.tags).map((tag) => (
                      <span
                        key={tag}
                        className="border border-stone-300 px-3 py-1 text-sm text-stone-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-stone-300 bg-white p-6">
            <h2 className="text-2xl font-semibold text-stone-950">
              Todavia no hay articulos.
            </h2>
            <p className="mt-3 leading-7 text-stone-700">
              El flujo inicial esta listo. Ejecuta la migracion y genera el primer
              articulo para poblar esta vista.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
