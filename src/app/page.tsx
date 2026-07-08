import Link from "next/link";
import { getLatestArticle, getPublishedArticles, parseTags } from "@/lib/articles";

const apps = [
  {
    name: "Blog diario",
    href: "/blog",
    status: "Activo",
    description: "Lecturas generadas para arrancar la mañana con una idea útil.",
  },
  {
    name: "Dashboard",
    href: "/",
    status: "Base",
    description: "El centro que va a reunir señales de todas las mini apps.",
  },
  {
    name: "Proxima app",
    href: "/",
    status: "Pendiente",
    description: "Habitos, finanzas, notas, salud o cualquier modulo que quieras sumar.",
  },
];

export default async function Home() {
  const [latestArticle, articles] = await Promise.all([
    getLatestArticle(),
    getPublishedArticles(),
  ]);

  return (
    <main className="min-h-screen">
      <section className="border-b border-stone-300 bg-[#f7f5f0]">
        <div className="mx-auto grid min-h-[74vh] max-w-6xl gap-10 px-6 py-10 md:grid-cols-[1.1fr_0.9fr] md:px-10 md:py-14">
          <div className="flex flex-col justify-between gap-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-800">
                Personal OS
              </p>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] text-stone-950 md:text-7xl">
                Tu centro operativo para aprender, decidir y volver a foco.
              </h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Apps" value={apps.length.toString()} />
              <Metric label="Articulos" value={articles.length.toString()} />
              <Metric label="Ritmo" value="Diario" />
            </div>
          </div>

          <aside className="self-end border-l border-stone-300 pl-6">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
              Lectura de hoy
            </p>
            {latestArticle ? (
              <div className="mt-5">
                <h2 className="text-3xl font-semibold text-stone-950">
                  {latestArticle.title}
                </h2>
                <p className="mt-4 text-lg leading-8 text-stone-700">
                  {latestArticle.summary}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {parseTags(latestArticle.tags).map((tag) => (
                    <span
                      key={tag}
                      className="border border-stone-300 px-3 py-1 text-sm text-stone-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/blog/${latestArticle.slug}`}
                  className="mt-7 inline-flex h-11 items-center bg-stone-950 px-5 text-sm font-medium text-white transition hover:bg-teal-900"
                >
                  Leer articulo
                </Link>
              </div>
            ) : (
              <div className="mt-5">
                <h2 className="text-3xl font-semibold text-stone-950">
                  Todavia no hay articulos publicados.
                </h2>
                <p className="mt-4 text-lg leading-8 text-stone-700">
                  Corre `npm run db:migrate` y despues `npm run article:generate`
                  para crear la primera lectura.
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          {apps.map((app) => (
            <Link
              key={app.name}
              href={app.href}
              className="min-h-48 border border-stone-300 bg-white p-5 transition hover:border-teal-800"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-stone-950">{app.name}</h2>
                <span className="text-sm text-teal-800">{app.status}</span>
              </div>
              <p className="mt-5 leading-7 text-stone-700">{app.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-stone-300 pt-4">
      <p className="text-3xl font-semibold text-stone-950">{value}</p>
      <p className="mt-1 text-sm uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
    </div>
  );
}
