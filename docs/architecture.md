# Personal OS Architecture

## Core Idea

Personal OS is organized as a set of independent personal mini apps that share common infrastructure. Each app owns its screens, data, and jobs, while publishing simple signals that the dashboard can summarize.

## Initial Structure

- `src/app`: Next.js routes only. The dashboard lives at `/`, and each mini app owns a route segment such as `/blog`, `/tasks`, or `/portfolio`.
- `src/features`: domain modules for each mini app. Feature code should live under `src/features/<feature-name>`.
- `src/lib`: shared infrastructure that is not owned by a single feature, such as the Prisma client in `src/lib/db.ts`.
- `scripts`: jobs that run outside web requests, such as daily article generation.
- `prisma`: schema, migrations, and the local development database.

## Feature Module Convention

Each mini app should keep its domain-specific code inside a feature folder:

```text
src/features/<feature-name>/
  components/
  data.ts
  types.ts
  services.ts
```

Use the files only when they are needed:

- `components`: UI components owned by that mini app.
- `data.ts`: database reads and writes for that domain.
- `types.ts`: domain-specific TypeScript types.
- `services.ts`: external integrations or domain workflows.

Routes in `src/app` should import from features and stay thin. For example, `src/app/blog/page.tsx` should render the route while `src/features/blog/data.ts` owns article queries.

## Model For New Mini Apps

Each new app should define:

1. Main route, for example `/habits`, `/notes`, or `/finance`.
2. Its own Prisma models.
3. Read/write functions in `src/features/<app>/data.ts`.
4. Optional jobs in `scripts/<app>-*.ts`.
5. Dashboard signals: counts, pending items, latest activity, or alerts.

## Daily Blog

The blog has three parts:

- Frontend: `/blog` lists articles and `/blog/[slug]` renders a reading view.
- Feature module: `src/features/blog`.
- Data: the `Article` table.
- Job: `scripts/generate-daily-article.ts`.
- Prompt: `prompts/daily-article.md`.

The job supports two modes:

- With `OPENAI_API_KEY`: it generates real content using the OpenAI SDK.
- Without `OPENAI_API_KEY`: it creates fallback content so the app can be tested locally.

## Future Apps

The next mini apps should follow the same route plus feature split:

- Task management: `src/app/tasks` and `src/features/tasks`.
- Portfolio tracking: `src/app/portfolio` and `src/features/portfolio`.
- Dashboard summaries: `src/app` plus `src/features/dashboard`.

For portfolio tracking, model assets separately from price history. Some assets will have automatic market prices, such as stocks and crypto, while others will be manually valued, such as real estate, vehicles, reserves, or custom assets. A useful starting model is:

- `Asset`: the owned thing.
- `AssetPriceSnapshot`: historical prices for market-priced assets.
- `Liability`: debts or obligations.
- `PortfolioAccount` or `PortfolioBucket`: grouping by account, reserve fund, asset class, or personal category.

## Next Decisions

- Define the final blog topic list.
- Expand Telegram notifications as needed.
- Decide where the daily scheduler will run.
- Add a `DashboardSignal` table once multiple apps start sharing metrics.
