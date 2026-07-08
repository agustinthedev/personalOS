import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/ArticleBody";
import { getArticleBySlug, parseTags } from "@/lib/articles";

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
    <main className="min-h-screen bg-[#f7f5f0]">
      <article className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <Link href="/blog" className="text-sm font-medium text-teal-800">
          Volver al blog
        </Link>

        <header className="mt-8 border-b border-stone-300 pb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
            {article.topic} · {article.readingMinutes} min
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-stone-950 md:text-6xl">
            {article.title}
          </h1>
          <p className="mt-5 text-xl leading-8 text-stone-700">{article.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {parseTags(article.tags).map((tag) => (
              <span
                key={tag}
                className="border border-stone-300 px-3 py-1 text-sm text-stone-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div className="bg-white px-0 py-8 md:px-8">
          <ArticleBody body={article.body} />
        </div>
      </article>
    </main>
  );
}
