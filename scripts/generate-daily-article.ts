import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";

const prisma = new PrismaClient();

const topics = [
  "Sistemas personales de productividad",
  "Pensamiento estrategico",
  "Aprendizaje acelerado",
  "IA aplicada al trabajo diario",
  "Filosofia practica",
  "Toma de decisiones",
  "Creatividad y escritura",
  "Salud mental para trabajo profundo",
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

  console.log(`Articulo creado: ${created.title}`);
  console.log(`URL local: http://localhost:3000/blog/${created.slug}`);
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
          "Sos un editor de un blog personal de aprendizaje. Escribis en espanol rioplatense claro, sobrio y practico.",
      },
      {
        role: "user",
        content: [
          "Genera un articulo para una lectura matinal de 10 a 15 minutos.",
          `Tema: ${topic}.`,
          "Debe tener ideas accionables, ejemplos concretos y una estructura en Markdown con secciones ##.",
          "No uses relleno, tono motivacional vacio ni listas superficiales.",
          "Devolve JSON valido con: title, subtitle, summary, body, topic, tags.",
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
    title: `Una practica simple para pensar mejor sobre ${topic.toLowerCase()}`,
    subtitle:
      "Un marco breve para convertir una lectura matinal en decisiones mas claras durante el dia.",
    summary:
      "Una propuesta inicial para usar el blog diario como ritual de pensamiento: leer, extraer una idea, conectarla con el dia y cerrar con una accion concreta.",
    topic,
    tags: ["aprendizaje", "foco", "sistemas personales", "rutina"],
    body: [
      "## La lectura como arranque del sistema",
      "Un blog automatizado no tiene que ser una fabrica de texto. Puede funcionar como una pequena ceremonia de entrada: una pieza diaria que te pone frente a una idea util antes de que el ruido del dia empiece a marcar prioridades. La clave no es leer mas, sino leer con una pregunta activa.",
      "Esa pregunta puede ser simple: que cambia en mi forma de trabajar si tomo esta idea en serio durante las proximas ocho horas. Con eso, el articulo deja de ser contenido y pasa a ser combustible para una decision.",
      "## Un metodo de tres movimientos",
      "- Detectar una idea que valga la pena probar hoy.\n- Traducirla a un comportamiento observable.\n- Revisar al final del dia si produjo claridad, energia o mejor criterio.",
      "Este metodo evita que la lectura quede separada de la vida real. Si el tema es productividad, la accion podria ser bloquear noventa minutos para una tarea importante. Si el tema es pensamiento estrategico, podria ser escribir tres opciones antes de elegir una. Si el tema es salud mental, podria ser proteger una pausa sin pantallas.",
      "## Como usar Personal OS para cerrar el loop",
      "La arquitectura del sistema deberia permitir que cada mini app produzca senales para el dashboard. En el caso del blog, esas senales podrian ser articulos leidos, temas repetidos, ideas guardadas, acciones derivadas y una pequena nota de impacto. Al principio alcanza con publicar y leer. Despues conviene medir que ideas vuelven, cuales te mueven y cuales se pierden.",
      "## La accion de hoy",
      "Elegir una frase de esta lectura y convertirla en una regla para el dia. No una regla perfecta, solo una lo bastante concreta como para poder cumplirla o romperla. Ahi empieza a aparecer el valor de un sistema operativo personal: no en acumular informacion, sino en transformar informacion en comportamiento.",
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
