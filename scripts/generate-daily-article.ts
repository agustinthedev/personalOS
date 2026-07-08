import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";

const prisma = new PrismaClient();

const topics = [
  "Personal productivity systems",
  "Strategic thinking",
  "Accelerated learning",
  "AI applied to daily work",
  "Practical philosophy",
  "Decision-making",
  "Creativity and writing",
  "Mental health for deep work",
];

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
  const topic = pickTopic();
  const article = process.env.OPENAI_API_KEY
    ? await generateWithOpenAI(topic)
    : generateFallbackArticle(topic);

  const readingMinutes = estimateReadingMinutes(article.body);
  const slug = await uniqueSlug(slugify(article.title));

  const created = await prisma.article.create({
    data: {
      slug,
      title: article.title,
      subtitle: article.subtitle,
      summary: article.summary,
      body: article.body,
      topic: article.topic,
      tags: article.tags.join(", "),
      readingMinutes,
      status: "PUBLISHED",
      generatedBy: process.env.OPENAI_API_KEY ? "openai" : "local-fallback",
      publishedAt: new Date(),
    },
  });

  console.log(`Article created: ${created.title}`);
  console.log(`Local URL: http://localhost:3000/blog/${created.slug}`);
}

function pickTopic() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return topics[dayIndex % topics.length];
}

async function generateWithOpenAI(topic: string): Promise<GeneratedArticle> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You are the editor of a personal learning blog. Write in clear, practical English with a calm and thoughtful tone.",
      },
      {
        role: "user",
        content: [
          "Generate an article for a 10 to 15 minute morning reading.",
          `Tema: ${topic}.`,
          "It should include actionable ideas, concrete examples, and a Markdown structure with ## sections.",
          "Avoid filler, empty motivational language, and shallow lists.",
          "Return valid JSON with: title, subtitle, summary, body, topic, tags.",
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
