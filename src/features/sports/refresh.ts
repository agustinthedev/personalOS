import { prisma } from "@/lib/db";
import { isFresh, sportsConfig, SPORTS_PROVIDER } from "./config";
import { markMissingEvents, upsertCompetitions, upsertEvents } from "./data";
import { TheSportsDbProvider } from "./provider";
import {
  EspnUruguayProvider,
  EspnNbaProvider,
  EspnUfcProvider,
  SportSrcBoxingProvider,
  JolpicaF1Provider,
  PadelApiProvider,
} from "./supplemental-providers";
import type { Sport } from "./types";

export type RefreshScope =
  | { key: "all-supported"; type: "all" }
  | { key: Sport; type: "sport"; sport: Sport }
  | {
      key: string;
      type: "competition";
      sport: Sport;
      competitionExternalId: string;
    };

export function parseRefreshScope(value: string): RefreshScope | null {
  if (value === "all-supported") return { key: value, type: "all" };
  if (
    ["football", "basketball", "padel", "formula1", "boxing", "ufc"].includes(
      value,
    )
  ) {
    return { key: value as Sport, type: "sport", sport: value as Sport };
  }
  const match =
    /^(football|basketball|padel|formula1|boxing|ufc):competition:([A-Za-z0-9_.-]+)$/.exec(
      value,
    );
  if (!match) return null;
  return {
    key: value,
    type: "competition",
    sport: match[1] as Sport,
    competitionExternalId: match[2],
  };
}

export async function refreshSports(scope: RefreshScope, _force = false) {
  void _force;
  const lock = await acquireRefreshLock(scope);
  if (!lock) return { status: "already-refreshing" as const };

  try {
    const results = await Promise.allSettled(refreshJobs(scope));
    const successes = results
      .filter(
        (result): result is PromiseFulfilledResult<RefreshResult> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
    const failures = results.filter((result) => result.status === "rejected");
    if (successes.length === 0) throw new Error("All sports providers failed.");

    const status = failures.length > 0 ? "partial_success" : "success";
    await finishRefresh(
      scope,
      status,
      failures.length > 0 ? "Some schedule providers could not be updated." : null,
    );
    return {
      status,
      events: successes.reduce((sum, result) => sum + result.events, 0),
      competitions: successes.reduce(
        (sum, result) => sum + result.competitions,
        0,
      ),
      unavailableSports: [],
    };
  } catch (error) {
    console.error("Sports refresh failed", {
      scope: scope.key,
      error: error instanceof Error ? error.message : String(error),
    });
    await finishRefresh(scope, "failed", "Sports provider refresh failed.");
    return {
      status: "failure" as const,
      message: "Could not update sports schedules.",
    };
  }
}

type RefreshResult = { events: number; competitions: number };

function refreshJobs(scope: RefreshScope): Promise<RefreshResult>[] {
  if (scope.type === "competition") {
    if (scope.sport === "football" && scope.competitionExternalId === "uru.1") {
      return [refreshEspnUruguay()];
    }
    if (
      scope.sport === "basketball" &&
      ["nba", "nba-summer-las-vegas"].includes(scope.competitionExternalId)
    ) {
      return [refreshEspnNba()];
    }
    if (scope.sport === "football" || scope.sport === "basketball") {
      return [refreshTheSportsDb(scope)];
    }
    if (scope.sport === "padel") return [refreshPadel()];
    if (scope.sport === "formula1") return [refreshFormula1()];
    if (scope.sport === "boxing") return [refreshBoxing()];
    return [refreshUfc()];
  }

  const requested =
    scope.type === "all"
      ? ([
          "football",
          "basketball",
          "padel",
          "formula1",
          "boxing",
          "ufc",
        ] as Sport[])
      : [scope.sport];
  const jobs: Promise<RefreshResult>[] = [];
  if (requested.some((sport) => sport === "football" || sport === "basketball")) {
    jobs.push(refreshTheSportsDb(scope));
  }
  if (requested.includes("football")) jobs.push(refreshEspnUruguay());
  if (requested.includes("basketball")) jobs.push(refreshEspnNba());
  if (requested.includes("padel")) jobs.push(refreshPadel());
  if (requested.includes("formula1")) jobs.push(refreshFormula1());
  if (requested.includes("boxing")) jobs.push(refreshBoxing());
  if (requested.includes("ufc")) jobs.push(refreshUfc());
  return jobs;
}

async function refreshTheSportsDb(
  scope: RefreshScope,
): Promise<RefreshResult> {
  const provider = new TheSportsDbProvider();
  const catalogScope =
    scope.type === "sport" &&
    (scope.sport === "football" || scope.sport === "basketball")
      ? scope.sport
      : undefined;
  const shouldRefreshCatalog =
    scope.type !== "competition" &&
    (await catalogIsStale(catalogScope));
  let competitions = 0;
  if (shouldRefreshCatalog) {
    const catalog = await provider.getCompetitions(catalogScope);
    await upsertCompetitions(catalog);
    competitions = catalog.length;
    await recordCatalogSuccess(catalogScope);
  }
  const sports =
    scope.type === "sport"
      ? [scope.sport]
      : (["football", "basketball"] as Sport[]);
  const events = await provider.getUpcomingEvents({
    sports,
    competitionExternalId:
      scope.type === "competition" ? scope.competitionExternalId : undefined,
  });
  await upsertEvents(events);
  if (events.length > 0) {
    await markMissingEvents({
      provider: SPORTS_PROVIDER,
      sport: scope.type === "all" ? undefined : scope.sport,
      competitionExternalId:
        scope.type === "competition" ? scope.competitionExternalId : undefined,
      seenExternalIds: events.map((event) => event.externalId),
    });
  }
  return { events: events.length, competitions };
}

async function refreshPadel(): Promise<RefreshResult> {
  const result = await new PadelApiProvider().getData();
  await upsertCompetitions(result.competitions);
  await upsertEvents(result.events);
  return { events: result.events.length, competitions: result.competitions.length };
}

async function refreshEspnUruguay(): Promise<RefreshResult> {
  const result = await new EspnUruguayProvider().getData();
  await upsertCompetitions(result.competitions);
  await upsertEvents(result.events);
  return { events: result.events.length, competitions: result.competitions.length };
}

async function refreshEspnNba(): Promise<RefreshResult> {
  const result = await new EspnNbaProvider().getData();
  await upsertCompetitions(result.competitions);
  await upsertEvents(result.events);
  return { events: result.events.length, competitions: result.competitions.length };
}

async function refreshFormula1(): Promise<RefreshResult> {
  const result = await new JolpicaF1Provider().getData();
  await upsertCompetitions(result.competitions);
  await upsertEvents(result.events);
  return { events: result.events.length, competitions: result.competitions.length };
}

async function refreshBoxing(): Promise<RefreshResult> {
  const result = await new SportSrcBoxingProvider().getData();
  await upsertCompetitions(result.competitions);
  await upsertEvents(result.events);
  return { events: result.events.length, competitions: result.competitions.length };
}

async function refreshUfc(): Promise<RefreshResult> {
  const result = await new EspnUfcProvider().getData();
  await upsertCompetitions(result.competitions);
  await upsertEvents(result.events);
  return { events: result.events.length, competitions: result.competitions.length };
}

async function acquireRefreshLock(scope: RefreshScope) {
  const now = new Date();
  const lockExpiresAt = new Date(
    now.getTime() + sportsConfig().lockMinutes * 60_000,
  );

  await prisma.sportsSyncState.upsert({
    where: {
      provider_scopeKey: { provider: SPORTS_PROVIDER, scopeKey: scope.key },
    },
    create: {
      provider: SPORTS_PROVIDER,
      scopeKey: scope.key,
      sport: scope.type === "all" ? null : scope.sport,
      refreshStatus: "idle",
    },
    update: {},
  });

  const updated = await prisma.sportsSyncState.updateMany({
    where: {
      provider: SPORTS_PROVIDER,
      scopeKey: scope.key,
      OR: [
        { refreshStatus: { not: "refreshing" } },
        { lockExpiresAt: null },
        { lockExpiresAt: { lte: now } },
      ],
    },
    data: {
      refreshStatus: "refreshing",
      lastAttemptAt: now,
      refreshStartedAt: now,
      lockExpiresAt,
      lastError: null,
    },
  });
  return updated.count === 1;
}

async function finishRefresh(
  scope: RefreshScope,
  status: "success" | "failed" | "partial_success",
  lastError: string | null,
) {
  await prisma.sportsSyncState.update({
    where: {
      provider_scopeKey: { provider: SPORTS_PROVIDER, scopeKey: scope.key },
    },
    data: {
      refreshStatus: status,
      lastSuccessAt: status === "success" || status === "partial_success" ? new Date() : undefined,
      refreshStartedAt: null,
      lockExpiresAt: null,
      lastError,
    },
  });
}

async function catalogIsStale(sport?: Sport) {
  const scopeKey = `catalog:${sport ?? "all"}`;
  const state = await prisma.sportsSyncState.findUnique({
    where: {
      provider_scopeKey: { provider: SPORTS_PROVIDER, scopeKey },
    },
  });
  if (!state?.lastSuccessAt) return true;
  return !isFresh(
    state.lastSuccessAt,
    sportsConfig().competitionsTtlHours * 3_600_000,
  );
}

async function recordCatalogSuccess(sport?: Sport) {
  const now = new Date();
  const scopeKey = `catalog:${sport ?? "all"}`;
  await prisma.sportsSyncState.upsert({
    where: {
      provider_scopeKey: { provider: SPORTS_PROVIDER, scopeKey },
    },
    create: {
      provider: SPORTS_PROVIDER,
      scopeKey,
      sport: sport ?? null,
      refreshStatus: "success",
      lastAttemptAt: now,
      lastSuccessAt: now,
    },
    update: {
      refreshStatus: "success",
      lastAttemptAt: now,
      lastSuccessAt: now,
      lastError: null,
    },
  });
}
