import { prisma } from "@/lib/db";

export async function getPublishedArticles() {
  try {
    return await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
  } catch {
    return [];
  }
}

export async function getLatestArticle() {
  const articles = await getPublishedArticles();
  return articles[0] ?? null;
}

export async function getArticleBySlug(slug: string) {
  try {
    return await prisma.article.findUnique({
      where: { slug },
    });
  } catch {
    return null;
  }
}

export function parseTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
