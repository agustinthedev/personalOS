# Personal OS

Personal OS es una base para construir mini aplicaciones personales y un dashboard que pueda leer señales de todas ellas.

La primera mini app es `Blog diario`: un generador de artículos cortos para lectura matinal. El flujo actual crea un artículo, lo guarda en SQLite y lo muestra en `/blog`.

## Stack

- Next.js con App Router para frontend y rutas server-side.
- Prisma + SQLite para persistencia local.
- Scripts TypeScript con `tsx` para jobs automatizables.
- OpenAI opcional para generación real de artículos.

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run db:migrate
npm run article:generate
```

## Flujo del blog

1. `npm run article:generate` elige un tema del calendario.
2. Si existe `OPENAI_API_KEY`, genera el artículo con IA.
3. Si no existe, crea un artículo local de prueba.
4. Guarda el artículo publicado en SQLite.
5. El dashboard `/` y el índice `/blog` lo leen desde la DB.

## Automatización diaria

En local, la forma más simple es programar:

```bash
npm run article:generate
```

Cuando el proyecto se despliegue, conviene mover este job a un cron del proveedor, GitHub Actions, un worker propio o un scheduler externo.
