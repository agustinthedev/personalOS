import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sanitizeArticleBody } from "../src/lib/markdown";

const prisma = new PrismaClient();
const DEFAULT_MODEL = "gpt-5.4-mini";

const articleSchema = z.object({
  title: z.string().min(8),
  subtitle: z.string().min(12),
  summary: z.string().min(40),
  body: z.string().min(800),
  topic: z.string().min(3),
  tags: z.array(z.string().min(2)).min(3).max(6),
});

type GeneratedArticle = z.infer<typeof articleSchema>;

async function main() {
  const context = await getGenerationContext();
  const article = process.env.OPENAI_API_KEY
    ? await generateWithOpenAI(context)
    : generateFallbackArticle(context.forcedTopic || "personal systems");
  const body = sanitizeArticleBody(article.body, article.title);

  const readingMinutes = estimateReadingMinutes(body);
  const slug = await uniqueSlug(slugify(article.title));

  const created = await prisma.article.create({
    data: {
      slug,
      title: article.title,
      subtitle: article.subtitle,
      summary: article.summary,
      body,
      topic: article.topic,
      tags: article.tags.join(", "),
      readingMinutes,
      status: "PUBLISHED",
      generatedBy: process.env.OPENAI_API_KEY
        ? process.env.OPENAI_MODEL || DEFAULT_MODEL
        : "local-fallback",
      publishedAt: new Date(),
    },
  });

  console.log(`Article created: ${created.title}`);
  const articleUrl = buildArticleUrl(created.slug);
  console.log(`Local URL: ${articleUrl}`);

  await notifyTelegram({
    title: created.title,
    url: articleUrl,
  });
}

async function generateWithOpenAI(
  context: GenerationContext,
): Promise<GeneratedArticle> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const editorialPrompt = await renderPrompt(context);

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are the editor-in-chief and main writer of Pills of Understanding.",
      },
      {
        role: "user",
        content: [
          editorialPrompt,
          "",
          "For database storage, return valid JSON only with this shape:",
          "{",
          '  "title": "Article title without Markdown #",',
          '  "subtitle": "One concise subtitle",',
          '  "summary": "Two or three sentence editorial summary",',
          '  "body": "Markdown article body excluding the H1 title and reading time line",',
          '  "topic": "Specific concrete topic",',
          '  "tags": ["tag-one", "tag-two", "tag-three"]',
          "}",
          "The body must not include a top-level # title or a reading-time line. The body must still include clear Markdown subheadings and must end with ## The Mental Model of the Day.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_object",
      },
    },
  });

  const raw = response.output_text;
  return articleSchema.parse(JSON.parse(raw));
}

type GenerationContext = {
  currentDate: string;
  recentArticles: string;
  avoidTopics: string;
  forcedTopic: string;
  sourceMaterial: string;
};

async function getGenerationContext(): Promise<GenerationContext> {
  const recent = await prisma.article.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      title: true,
      topic: true,
      tags: true,
      publishedAt: true,
    },
  });

  const lastTwoTopics = recent.slice(0, 2).map((article) => article.topic);

  return {
    currentDate: new Date().toISOString().slice(0, 10),
    recentArticles:
      recent
        .map((article, index) => {
          const date = article.publishedAt?.toISOString().slice(0, 10) ?? "draft";
          return `${index + 1}. ${article.title} (${article.topic}, ${date})`;
        })
        .join("\n") || "No recent articles yet.",
    avoidTopics: lastTwoTopics.length > 0 ? lastTwoTopics.join(", ") : "None.",
    forcedTopic: process.env.FORCED_TOPIC?.trim() ?? "",
    sourceMaterial: process.env.SOURCE_MATERIAL?.trim() ?? "",
  };
}

async function renderPrompt(context: GenerationContext) {
  const promptPath = path.join(process.cwd(), "prompts", "daily-article.md");
  const template = await readFile(promptPath, "utf8");

  return template
    .replaceAll("{{current_date}}", context.currentDate)
    .replaceAll("{{recent_articles}}", context.recentArticles)
    .replaceAll("{{avoid_topics}}", context.avoidTopics)
    .replaceAll("{{forced_topic}}", context.forcedTopic)
    .replaceAll("{{source_material}}", context.sourceMaterial);
}

function generateFallbackArticle(topic: string): GeneratedArticle {
  return {
    title: `A simple practice for thinking better about ${topic.toLowerCase()}`,
    subtitle:
      "A short framework for turning a morning reading into clearer decisions during the day.",
    summary:
      "An initial proposal for using the daily blog as a thinking ritual: read, extract one idea, connect it to the day, and close with a concrete action.",
    topic,
    tags: ["learning", "focus", "personal systems", "routine"],
    body: [
      "## Reading as system boot",
      "An automated blog does not need to be a text factory. It can work as a small entry ritual: one daily piece that puts a useful idea in front of you before the noise of the day starts setting priorities. The key is not to read more, but to read with an active question.",
      "That question can be simple: what changes in the way I work if I take this idea seriously for the next eight hours. With that, the article stops being content and becomes fuel for a decision.",
      "## A three-move method",
      "- Detect one idea worth testing today.\n- Translate it into an observable behavior.\n- Review at the end of the day whether it produced clarity, energy, or better judgment.",
      "This method keeps reading connected to real life. If the topic is productivity, the action might be blocking ninety minutes for an important task. If the topic is strategic thinking, it might be writing three options before choosing one. If the topic is mental health, it might be protecting a screen-free pause.",
      "## Using Personal OS to close the loop",
      "The system architecture should allow each mini app to produce signals for the dashboard. For the blog, those signals could include articles read, repeated topics, saved ideas, derived actions, and a small impact note. At first, publishing and reading is enough. Later, it becomes useful to measure which ideas return, which ones move you, and which ones disappear.",
      "## Today's action",
      "Choose one sentence from this reading and turn it into a rule for the day. Not a perfect rule, just one concrete enough to either follow or break. That is where the value of a personal operating system begins to show up: not in accumulating information, but in turning information into behavior.",
    ].join("\n\n"),
  };
}

function estimateReadingMinutes(body: string) {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function buildArticleUrl(slug: string) {
  const baseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/blog/${slug}`;
}

async function notifyTelegram({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    console.log("Telegram notification skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.");
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      disable_web_page_preview: false,
      parse_mode: "HTML",
      text: [
        "📰 <b>New blog article available</b>",
        "",
        `<b>${escapeHtml(title)}</b>`,
        "",
        `<a href="${escapeHtmlAttribute(url)}">Open article</a>`,
        "",
        escapeHtml(url),
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error(`Telegram notification failed: ${response.status} ${details}`);
    return;
  }

  console.log("Telegram notification sent.");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
