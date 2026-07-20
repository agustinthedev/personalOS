import { prisma } from "@/lib/db";
import {
  SPORTS_PROVIDER,
  SPORTS_PROVIDER_LABEL,
  isFresh,
  liveSports,
  sportsConfig,
  unavailableLiveSports,
} from "./config";
import type {
  CompetitionMode,
  CompetitionView,
  EventView,
  NormalizedCompetition,
  NormalizedEvent,
  Sport,
  SportsDataResponse,
  SportsPreferencesView,
} from "./types";

const defaultPreferences: SportsPreferencesView = {
  preferredSports: ["football", "basketball", "padel", "formula1"],
  preferredCompetitionIds: [],
  defaultCompetitionMode: "preferred",
  lastSelectedCompetitionIds: [],
};

export async function getSportsData(): Promise<SportsDataResponse> {
  const config = sportsConfig();
  const [events, competitions, preference, syncStates] = await Promise.all([
    prisma.sportsEvent.findMany({
      where: {
        OR: [
          { startsAtUtc: { gte: retentionStart(config.pastRetentionDays) } },
          { startsAtUtc: null },
        ],
        missingSince: null,
      },
      include: { competition: true },
      orderBy: [{ startsAtUtc: "asc" }, { createdAt: "asc" }],
      take: 750,
    }),
    prisma.sportsCompetition.findMany({
      where: { isActive: true },
      orderBy: [{ sport: "asc" }, { countryName: "asc" }, { name: "asc" }],
      take: 3000,
    }),
    ensureSportsPreferences(),
    prisma.sportsSyncState.findMany({
      where: { provider: SPORTS_PROVIDER },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const allState = syncStates.find((state) => state.scopeKey === "all-supported");
  const eventState = allState ?? syncStates.find((state) => state.lastSuccessAt);
  const lastSuccess = eventState?.lastSuccessAt ?? null;
  const refreshAfter = lastSuccess
    ? new Date(lastSuccess.getTime() + config.eventsTtlMinutes * 60_000)
    : null;
  const now = new Date();

  return {
    events: dedupeEventViews(events.map(toEventView)),
    competitions: competitions.map(toCompetitionView),
    preferences: toPreferencesView(preference),
    sync: {
      lastSuccessfulRefreshAt: lastSuccess?.toISOString() ?? null,
      lastAttemptAt: eventState?.lastAttemptAt?.toISOString() ?? null,
      isStale: !isFresh(lastSuccess, config.eventsTtlMinutes * 60_000, now),
      isRefreshing: syncStates.some(
        (state) =>
          state.refreshStatus === "refreshing" &&
          Boolean(state.lockExpiresAt && state.lockExpiresAt > now),
      ),
      lastRefreshFailed: eventState?.refreshStatus === "failed",
      partialFailure: eventState?.refreshStatus === "partial_success",
      refreshAfter: refreshAfter?.toISOString() ?? null,
      provider: SPORTS_PROVIDER_LABEL,
    },
    capabilities: {
      liveSports: liveSports(),
      unavailableSports: unavailableLiveSports(),
      providerLabel: SPORTS_PROVIDER_LABEL,
    },
  };
}

export async function ensureSportsPreferences() {
  return prisma.sportsPreference.upsert({
    where: { profileKey: "default" },
    create: {
      profileKey: "default",
      preferredSports: JSON.stringify(defaultPreferences.preferredSports),
      preferredCompetitionIds: "[]",
      defaultCompetitionMode: "preferred",
      lastSelectedCompetitionIds: "[]",
    },
    update: {},
  });
}

export async function updateSportsPreferences(input: {
  timezone?: string;
  preferredSports?: Sport[];
  preferredCompetitionIds?: string[];
  defaultCompetitionMode?: CompetitionMode;
  lastSelectedSport?: Sport;
  lastSelectedCompetitionIds?: string[];
}) {
  const existing = await ensureSportsPreferences();
  const data = {
    timezone: input.timezone ?? existing.timezone,
    preferredSports: input.preferredSports
      ? JSON.stringify(input.preferredSports)
      : existing.preferredSports,
    preferredCompetitionIds: input.preferredCompetitionIds
      ? JSON.stringify(input.preferredCompetitionIds)
      : existing.preferredCompetitionIds,
    defaultCompetitionMode:
      input.defaultCompetitionMode ?? existing.defaultCompetitionMode,
    lastSelectedSport: input.lastSelectedSport ?? existing.lastSelectedSport,
    lastSelectedCompetitionIds: input.lastSelectedCompetitionIds
      ? JSON.stringify(input.lastSelectedCompetitionIds)
      : existing.lastSelectedCompetitionIds,
  };
  const updated = await prisma.sportsPreference.update({
    where: { profileKey: "default" },
    data,
  });
  return toPreferencesView(updated);
}

export async function upsertCompetitions(competitions: NormalizedCompetition[]) {
  const fetchedAt = new Date();
  const ids = new Map<string, string>();
  for (const competition of competitions) {
    const stored = await prisma.sportsCompetition.upsert({
      where: {
        provider_externalId: {
          provider: competition.provider,
          externalId: competition.externalId,
        },
      },
      create: {
        provider: competition.provider,
        externalId: competition.externalId,
        ...competitionData(competition, fetchedAt),
      },
      update: {
        ...competitionData(competition, fetchedAt),
      },
    });
    ids.set(`${competition.provider}:${competition.externalId}`, stored.id);
  }
  return ids;
}

export async function upsertEvents(events: NormalizedEvent[]) {
  const fetchedAt = new Date();
  const embedded = events
    .map((event) => event.competition)
    .filter((value): value is NormalizedCompetition => Boolean(value));
  const competitionIds = await upsertCompetitions(embedded);

  for (const event of events) {
    const lookupKey = event.competitionExternalId
      ? `${event.provider}:${event.competitionExternalId}`
      : "";
    let competitionId = competitionIds.get(lookupKey);
    if (!competitionId && event.competitionExternalId) {
      competitionId = (
        await prisma.sportsCompetition.findUnique({
          where: {
            provider_externalId: {
              provider: event.provider,
              externalId: event.competitionExternalId,
            },
          },
          select: { id: true },
        })
      )?.id;
    }
    const data = {
      sport: event.sport,
      competitionId: competitionId ?? null,
      stage: event.stage ?? null,
      round: event.round ?? null,
      participants: JSON.stringify(event.participants),
      startsAtUtc: event.startsAtUtc ?? null,
      endsAtUtc: event.endsAtUtc ?? null,
      originalTimezone: event.originalTimezone ?? null,
      timeStatus: event.timeStatus,
      status: event.status,
      venue: event.venue ?? null,
      location: event.location ?? null,
      broadcastInfo: JSON.stringify(event.broadcast ?? []),
      sourceUrl: event.sourceUrl ?? null,
      providerUpdatedAt: event.providerUpdatedAt ?? null,
      fetchedAt,
      lastSeenAt: fetchedAt,
      missingSince: null,
      rawProviderData:
        process.env.NODE_ENV === "development" && event.rawProviderData
          ? JSON.stringify(event.rawProviderData)
          : null,
    };
    await prisma.sportsEvent.upsert({
      where: {
        provider_externalId: {
          provider: event.provider,
          externalId: event.externalId,
        },
      },
      create: {
        provider: event.provider,
        externalId: event.externalId,
        ...data,
      },
      update: data,
    });
  }
}

export async function markMissingEvents(input: {
  provider?: string;
  sport?: Sport;
  competitionExternalId?: string;
  seenExternalIds: string[];
}) {
  const where = {
    provider: input.provider ?? SPORTS_PROVIDER,
    missingSince: null,
    ...(input.sport ? { sport: input.sport } : {}),
    ...(input.competitionExternalId
      ? { competition: { externalId: input.competitionExternalId } }
      : {}),
    externalId: { notIn: input.seenExternalIds },
    startsAtUtc: { gte: new Date() },
  };
  await prisma.sportsEvent.updateMany({ where, data: { missingSince: new Date() } });
}

function competitionData(competition: NormalizedCompetition, fetchedAt: Date) {
  return {
    sport: competition.sport,
    name: competition.name,
    shortName: competition.shortName ?? null,
    competitionType: competition.competitionType,
    countryCode: competition.countryCode ?? null,
    countryName: competition.countryName ?? null,
    region: competition.region ?? null,
    logoUrl: competition.logoUrl ?? null,
    currentSeason: competition.currentSeason ?? null,
    isActive: true,
    isPreferredByDefault: competition.isPreferredByDefault,
    providerUpdatedAt: competition.providerUpdatedAt ?? null,
    fetchedAt,
  };
}

function toCompetitionView(competition: {
  id: string;
  provider: string;
  externalId: string;
  sport: string;
  name: string;
  shortName: string | null;
  competitionType: string;
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  logoUrl: string | null;
  currentSeason: string | null;
  isPreferredByDefault: boolean;
  fetchedAt: Date;
}): CompetitionView {
  return {
    ...competition,
    sport: competition.sport as Sport,
    fetchedAt: competition.fetchedAt.toISOString(),
  };
}

function toEventView(event: Awaited<ReturnType<typeof prisma.sportsEvent.findMany>>[number] & {
  competition: Awaited<ReturnType<typeof prisma.sportsCompetition.findFirst>>;
}): EventView {
  return {
    id: event.id,
    provider: event.provider,
    externalId: event.externalId,
    sport: event.sport as Sport,
    competitionId: event.competitionId,
    competition: event.competition ? toCompetitionView(event.competition) : null,
    stage: event.stage,
    round: event.round,
    participants: parseJson(event.participants, []),
    startsAtUtc: event.startsAtUtc?.toISOString() ?? null,
    endsAtUtc: event.endsAtUtc?.toISOString() ?? null,
    originalTimezone: event.originalTimezone,
    timeStatus: event.timeStatus as EventView["timeStatus"],
    status: event.status as EventView["status"],
    venue: event.venue,
    location: event.location,
    broadcast: parseJson(event.broadcastInfo, []),
    sourceUrl: event.sourceUrl,
    providerUpdatedAt: event.providerUpdatedAt?.toISOString() ?? null,
    fetchedAt: event.fetchedAt.toISOString(),
  };
}

function toPreferencesView(preference: {
  preferredSports: string;
  preferredCompetitionIds: string;
  defaultCompetitionMode: string;
  lastSelectedSport: string | null;
  lastSelectedCompetitionIds: string;
  timezone: string | null;
}): SportsPreferencesView {
  return {
    preferredSports: parseJson(preference.preferredSports, defaultPreferences.preferredSports),
    preferredCompetitionIds: parseJson(preference.preferredCompetitionIds, []),
    defaultCompetitionMode:
      preference.defaultCompetitionMode === "all" ? "all" : "preferred",
    lastSelectedSport: preference.lastSelectedSport as Sport | undefined,
    lastSelectedCompetitionIds: parseJson(preference.lastSelectedCompetitionIds, []),
    timezone: preference.timezone ?? undefined,
  };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function retentionStart(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function dedupeEventViews(events: EventView[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const participants = event.participants
      .map((participant) => participant.name.toLowerCase())
      .sort()
      .join("|");
    const day = event.startsAtUtc?.slice(0, 10) ?? "tbc";
    const key = `${event.sport}:${day}:${participants}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
