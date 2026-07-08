# Personal OS

Personal OS is a foundation for building personal mini apps and a dashboard that can read signals from all of them.

The first mini app is `Daily Blog`: a short-form article generator for morning reading. The current flow creates an article, stores it in SQLite, and displays it at `/blog`.

## Stack

- Next.js with the App Router for frontend and server-side routes.
- Prisma + SQLite for local persistence.
- TypeScript scripts with `tsx` for schedulable jobs.
- Optional OpenAI integration for real article generation.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run db:migrate
npm run article:generate
```

## Blog Flow

1. `npm run article:generate` picks a topic from the calendar rotation.
2. If `OPENAI_API_KEY` exists, it generates the article with AI.
3. If it does not exist, it creates a local fallback article.
4. It stores the published article in SQLite.
5. The dashboard `/` and the index `/blog` read it from the database.

## Daily Automation

Locally, the simplest scheduled command is:

```bash
npm run article:generate
```

Once the project is deployed, this job should move to the hosting provider cron, GitHub Actions, a dedicated worker, or an external scheduler.
