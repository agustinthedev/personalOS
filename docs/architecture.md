# Personal OS Architecture

## Core Idea

Personal OS is organized as a set of independent personal mini apps that share common infrastructure. Each app owns its screens, data, and jobs, while publishing simple signals that the dashboard can summarize.

## Initial Structure

- `src/app`: Next.js routes. The dashboard lives at `/`, and each mini app can own its own segment, such as `/blog`.
- `src/lib`: data access and UI-facing shared logic.
- `src/components`: reusable components that do not belong to a single route.
- `scripts`: jobs that run outside web requests, such as daily article generation.
- `prisma`: schema, migrations, and the local development database.

## Model For New Mini Apps

Each new app should define:

1. Main route, for example `/habits`, `/notes`, or `/finance`.
2. Its own Prisma models.
3. Read/write functions in `src/lib/<app>.ts`.
4. Optional jobs in `scripts/<app>-*.ts`.
5. Dashboard signals: counts, pending items, latest activity, or alerts.

## Daily Blog

The blog has three parts:

- Frontend: `/blog` lists articles and `/blog/[slug]` renders a reading view.
- Data: the `Article` table.
- Job: `scripts/generate-daily-article.ts`.

The job supports two modes:

- With `OPENAI_API_KEY`: it generates real content using the OpenAI SDK.
- Without `OPENAI_API_KEY`: it creates fallback content so the app can be tested locally.

## Next Decisions

- Define the final blog topic list.
- Choose a notification channel: Telegram, email, WhatsApp, or push.
- Decide where the daily scheduler will run.
- Add a `DashboardSignal` table once multiple apps start sharing metrics.
