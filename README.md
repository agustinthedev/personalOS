# Personal OS

Personal OS is a local-first dashboard for personal mini apps. Each mini app owns its route, data model, and feature module while the home dashboard links to the systems that power the day.

Current mini apps:

- `Daily Blog`: generates and stores short-form morning readings.
- `Board`: a personal kanban board with columns, categories, checklists, comments, archives, and drag-and-drop task movement.
- `Portfolio`: tracks assets, market investments, liabilities, net worth history, and projection scenarios.

## Stack

- Next.js App Router for frontend routes and server-rendered pages.
- React client components for interactive app surfaces.
- Prisma + SQLite for local persistence.
- Server actions with `zod` validation for write flows.
- TypeScript scripts with `tsx` for schedulable jobs.
- Optional OpenAI integration for generated article content.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run db:migrate
npm run prisma:generate
npm run article:generate
```

## Environment

Create a local `.env` from `.env.example`.

Core variables:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.4-mini"
FORCED_TOPIC=""
APP_BASE_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

Portfolio provider variables:

```env
MARKET_PRICE_API_KEY=""
MARKET_PRICE_API_BASE_URL=""
CRYPTO_PRICE_API_BASE_URL="https://api.coingecko.com/api/v3/simple/price"
COMMODITY_PRICE_API_BASE_URL=""
FX_RATE_API_BASE_URL="https://open.er-api.com/v6/latest"
```

`CRYPTO_PRICE_API_BASE_URL` uses CoinGecko's Simple Price endpoint by default for common crypto symbols. `FX_RATE_API_BASE_URL` uses ExchangeRate-API's open endpoint by default. If no live FX provider or cached rate is available, Portfolio falls back to a local USD/UYU rate so the app remains usable.

## Project Structure

- `src/app`: Next.js route segments and thin page composition.
- `src/features`: mini app domain modules.
- `src/lib`: shared infrastructure, including the Prisma client.
- `scripts`: scheduled or manual jobs.
- `prompts`: versioned AI prompts and app requirements.
- `prisma`: schema, migrations, and the local SQLite database.
- `docs`: architecture notes.

Feature convention:

```text
src/features/<feature-name>/
  components/
  actions.ts
  data.ts
  services.ts
  types.ts
```

Use only the files a feature needs. Routes in `src/app` should stay thin and import domain logic from `src/features`.

## Routes

- `/`: Personal OS dashboard.
- `/blog`: published daily readings.
- `/blog/[slug]`: article reading view.
- `/board`: kanban board.
- `/portfolio`: portfolio and net worth tracker.

## Portfolio

Portfolio tracks:

- Manual assets such as cash, cash equivalents, real estate, vehicles, collectibles, and other assets.
- Market assets such as crypto, stocks, ETFs, funds, fixed income/bonds, and commodities.
- Transaction-first market positions using buys, sells, transfers, and adjustments.
- Liabilities with optional payoff month assumptions.
- USD/UYU conversion using cached FX snapshots.
- Net worth snapshots and projection scenarios.

Important modeling notes:

- Market assets are transaction-first. Their current value is based on `quantityHeld * currentUnitPrice`.
- Manual assets store a manual value directly.
- Bonds/fixed income can use `maturityDate`, `expectedAnnualGrowthPercent`, `isIncomeProducing`, and `expectedMonthlyIncome` for projections.
- `Cash & Equivalents` is separate from plain cash and still counts as liquid assets.
- Projections do not change current net worth or stored snapshots.

The Projection Lab at the bottom of `/portfolio` supports scenario filtering by horizon, asset category, growth, income, liability payoff, and growth shock.

## Blog Flow

1. `npm run article:generate` picks a topic from the calendar rotation.
2. If `OPENAI_API_KEY` exists, it generates the article with AI.
3. If it does not exist, it creates local fallback content.
4. It stores the published article in SQLite.
5. The dashboard `/` and `/blog` read it from the database.

## Database

Run migrations after schema changes:

```bash
npm run db:migrate
```

Regenerate Prisma Client when needed:

```bash
npm run prisma:generate
```

The development database is ignored by git:

```text
prisma/dev.db
```

## Daily Automation

Locally, the simplest scheduled command is:

```bash
npm run article:generate
```

Once deployed, scheduled jobs should move to the hosting provider cron, GitHub Actions, a dedicated worker, or an external scheduler.
