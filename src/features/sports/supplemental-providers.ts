import { z } from "zod";
import { sportsConfig } from "./config";
import type {
  EventStatus,
  NormalizedCompetition,
  NormalizedEvent,
  TimeStatus,
} from "./types";

const PADEL_PROVIDER = "padelapi";
const ESPN_PROVIDER = "espn";
const F1_PROVIDER = "jolpica";

const playerSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const padelMatchSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    url: z.string().nullable().optional(),
    category: z.string().optional(),
    round_name: z.string().optional(),
    played_at: z.string().nullable().optional(),
    schedule_label: z.string().nullable().optional(),
    scheduled_at_local: z.string().nullable().optional(),
    scheduled_at: z.string().nullable().optional(),
    court: z.string().nullable().optional(),
    status: z.string(),
    players: z.object({
      team_1: z.array(playerSchema),
      team_2: z.array(playerSchema),
    }),
    updated_at: z.string().optional(),
    connections: z
      .object({ tournament: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const padelTournamentSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    url: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    venue: z
      .union([
        z.string(),
        z.object({
          name: z.string().optional(),
          address: z.string().optional(),
        }),
      ])
      .nullable()
      .optional(),
    country: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    level: z.string().optional(),
    status: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    updated_at: z.string().optional(),
  })
  .passthrough();

const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item) }).passthrough();

export class PadelApiProvider {
  async getData() {
    const { padelApiToken, upcomingWindowDays } = sportsConfig();
    if (!padelApiToken) throw new Error("PadelApi token is not configured.");

    const from = dateOffset(-2);
    const until = dateOffset(Math.max(upcomingWindowDays, 30));
    const [matchPayload, tournamentPayload] = await Promise.all([
      this.request(
        `/matches?after_date=${from}&before_date=${until}&sort_by=played_at&order_by=asc&per_page=50`,
      ),
      this.request(
        `/tournaments?after_date=${dateOffset(-7)}&before_date=${until}&sort_by=start_date&order_by=asc&per_page=50`,
      ),
    ]);
    const matches = paginatedSchema(padelMatchSchema).parse(matchPayload).data;
    const tournaments = paginatedSchema(padelTournamentSchema).parse(
      tournamentPayload,
    ).data;
    const competitionById = new Map(
      tournaments.map((item) => [String(item.id), normalizePadelTournament(item)]),
    );
    const competitions = [...competitionById.values()];
    const events = matches.map((match) =>
      normalizePadelMatch(match, competitionById),
    );

    const tournamentsWithMatches = new Set(
      events.map((event) => event.competitionExternalId).filter(Boolean),
    );
    for (const tournament of tournaments) {
      if (
        tournament.status === "finished" ||
        tournamentsWithMatches.has(String(tournament.id))
      ) {
        continue;
      }
      events.push(normalizePadelTournamentStart(tournament));
    }
    return { competitions, events };
  }

  private async request(path: string) {
    return requestJson(`${sportsConfig().padelApiBaseUrl}${path}`, {
      Authorization: `Bearer ${sportsConfig().padelApiToken}`,
    });
  }
}

export class EspnUruguayProvider {
  async getData() {
    const from = compactDate(dateOffset(0));
    const until = compactDate(dateOffset(Math.max(sportsConfig().upcomingWindowDays, 30)));
    const payload = await requestJson(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/uru.1/scoreboard?dates=${from}-${until}`,
    );
    const parsed = espnPayloadSchema.parse(payload);
    const competition = uruguayCompetition();
    return {
      competitions: [competition],
      events: parsed.events
        .map((event) => normalizeEspnTeamEvent(event, competition, "football"))
        .filter((event): event is NormalizedEvent => Boolean(event)),
    };
  }
}

export class EspnNbaProvider {
  async getData() {
    // ESPN groups late-night games by the local US schedule date, even when UTC
    // has already rolled into the following day.
    const from = compactDate(dateOffset(-1));
    const until = compactDate(
      dateOffset(Math.max(sportsConfig().upcomingWindowDays, 30)),
    );
    const sources = [
      {
        slug: "nba",
        competition: nbaCompetition("nba", "NBA"),
      },
      {
        slug: "nba-summer-las-vegas",
        competition: nbaCompetition(
          "nba-summer-las-vegas",
          "NBA Summer League",
        ),
      },
    ];
    const payloads = await Promise.all(
      sources.map(async (source) => ({
        ...source,
        payload: espnPayloadSchema.parse(
          await requestJson(
            `https://site.api.espn.com/apis/site/v2/sports/basketball/${source.slug}/scoreboard?dates=${from}-${until}`,
          ),
        ),
      })),
    );
    return {
      competitions: sources.map((source) => source.competition),
      events: payloads.flatMap(({ payload, competition }) =>
        payload.events
          .map((event) =>
            normalizeEspnTeamEvent(event, competition, "basketball"),
          )
          .filter((event): event is NormalizedEvent => Boolean(event)),
      ),
    };
  }
}

export class JolpicaF1Provider {
  async getData() {
    const year = new Date().getUTCFullYear();
    const payload = await requestJson(`${sportsConfig().f1ApiBaseUrl}/${year}.json`);
    const parsed = f1PayloadSchema.parse(payload);
    const competition = f1Competition(year);
    const now = Date.now() - sportsConfig().pastRetentionDays * 86_400_000;
    return {
      competitions: [competition],
      events: parsed.MRData.RaceTable.Races.map((race) =>
        normalizeF1Race(race, competition),
      ).filter((event) => !event.startsAtUtc || event.startsAtUtc.getTime() >= now),
    };
  }
}

function normalizePadelTournament(
  tournament: z.infer<typeof padelTournamentSchema>,
): NormalizedCompetition {
  return {
    provider: PADEL_PROVIDER,
    externalId: String(tournament.id),
    sport: "padel",
    name: tournament.name,
    shortName: tournament.level?.replaceAll("_", " "),
    competitionType: "tournament",
    countryCode: tournament.country || undefined,
    countryName: tournament.country || undefined,
    region: tournament.location || undefined,
    currentSeason: tournament.start_date.slice(0, 4),
    isPreferredByDefault: true,
    providerUpdatedAt: parseDate(tournament.updated_at),
  };
}

function normalizePadelMatch(
  match: z.infer<typeof padelMatchSchema>,
  competitionById: Map<string, NormalizedCompetition>,
): NormalizedEvent {
  const competitionExternalId = match.connections?.tournament?.split("/").pop();
  const startsAtUtc = parseDate(match.scheduled_at_local || match.scheduled_at);
  return {
    provider: PADEL_PROVIDER,
    externalId: String(match.id),
    sport: "padel",
    competitionExternalId,
    competition: competitionExternalId
      ? competitionById.get(competitionExternalId)
      : undefined,
    stage: match.category ? `${titleCase(match.category)} draw` : undefined,
    round: match.round_name || undefined,
    participants: [
      {
        name: match.players.team_1.map((player) => player.name).join(" / "),
        role: "pair",
      },
      {
        name: match.players.team_2.map((player) => player.name).join(" / "),
        role: "pair",
      },
    ],
    startsAtUtc,
    timeStatus: padelTimeStatus(match.schedule_label, startsAtUtc),
    status: padelStatus(match.status),
    venue: match.court || undefined,
    sourceUrl: safeUrl(match.url),
    providerUpdatedAt: parseDate(match.updated_at),
    rawProviderData: match,
  };
}

function normalizePadelTournamentStart(
  tournament: z.infer<typeof padelTournamentSchema>,
): NormalizedEvent {
  const competition = normalizePadelTournament(tournament);
  return {
    provider: PADEL_PROVIDER,
    externalId: `tournament-${tournament.id}`,
    sport: "padel",
    competitionExternalId: String(tournament.id),
    competition,
    stage: "Tournament begins",
    participants: [{ name: tournament.name }],
    startsAtUtc: new Date(`${tournament.start_date}T12:00:00Z`),
    originalTimezone: tournament.timezone || undefined,
    timeStatus: "tbc",
    status: "scheduled",
    venue: padelVenueName(tournament.venue),
    location: [tournament.location, tournament.country].filter(Boolean).join(", "),
    sourceUrl: safeUrl(tournament.url),
    providerUpdatedAt: parseDate(tournament.updated_at),
    rawProviderData: tournament,
  };
}

const espnPayloadSchema = z.object({
  events: z.array(
    z
      .object({
        id: z.string(),
        date: z.string(),
        season: z.object({ year: z.number(), slug: z.string().optional() }),
        competitions: z.array(
          z
            .object({
              timeValid: z.boolean().optional(),
              status: z.object({
                type: z.object({
                  state: z.string(),
                  completed: z.boolean(),
                  description: z.string(),
                }),
              }),
              venue: z
                .object({
                  fullName: z.string().optional(),
                  address: z
                    .object({
                      city: z.string().optional(),
                      country: z.string().optional(),
                    })
                    .optional(),
                })
                .optional(),
              competitors: z.array(
                z.object({
                  homeAway: z.string(),
                  team: z.object({
                    id: z.string(),
                    displayName: z.string(),
                    abbreviation: z.string().optional(),
                  }),
                }),
              ),
              broadcasts: z
                .array(z.object({ names: z.array(z.string()).optional() }).passthrough())
                .optional(),
            })
            .passthrough(),
        ),
        links: z
          .array(z.object({ href: z.string(), rel: z.array(z.string()) }))
          .optional(),
      })
      .passthrough(),
  ),
});

function uruguayCompetition(): NormalizedCompetition {
  return {
    provider: ESPN_PROVIDER,
    externalId: "uru.1",
    sport: "football",
    name: "Uruguayan Primera Division",
    shortName: "Liga AUF Uruguaya",
    competitionType: "league",
    countryCode: "UY",
    countryName: "Uruguay",
    region: "South America",
    currentSeason: String(new Date().getUTCFullYear()),
    isPreferredByDefault: true,
  };
}

function nbaCompetition(
  externalId: string,
  name: string,
): NormalizedCompetition {
  return {
    provider: ESPN_PROVIDER,
    externalId,
    sport: "basketball",
    name,
    shortName: name === "NBA" ? "NBA" : "NBA Summer League",
    competitionType: name === "NBA" ? "league" : "tournament",
    countryCode: "US",
    countryName: "USA",
    region: "North America",
    currentSeason: String(new Date().getUTCFullYear()),
    isPreferredByDefault: true,
  };
}

function normalizeEspnTeamEvent(
  event: z.infer<typeof espnPayloadSchema>["events"][number],
  competition: NormalizedCompetition,
  sport: "football" | "basketball",
): NormalizedEvent | null {
  const detail = event.competitions[0];
  if (!detail) return null;
  const participants = [...detail.competitors]
    .sort((a, b) => (a.homeAway === "home" ? -1 : b.homeAway === "home" ? 1 : 0))
    .map((competitor) => ({
      id: competitor.team.id,
      name: competitor.team.displayName,
      shortName: competitor.team.abbreviation,
      role: competitor.homeAway === "home" ? ("home" as const) : ("away" as const),
    }));
  if (participants.length === 0) return null;
  const sourceUrl = event.links?.find((link) => link.rel.includes("summary"))?.href;
  return {
    provider: ESPN_PROVIDER,
    externalId: event.id,
    sport,
    competitionExternalId: competition.externalId,
    competition,
    stage: event.season.slug ? titleCase(event.season.slug) : undefined,
    participants,
    startsAtUtc: parseDate(event.date),
    originalTimezone: "UTC",
    timeStatus: detail.timeValid === false ? "tbc" : "confirmed",
    status: espnStatus(detail.status.type),
    venue: detail.venue?.fullName,
    location: [detail.venue?.address?.city, detail.venue?.address?.country]
      .filter(Boolean)
      .join(", "),
    broadcast:
      detail.broadcasts?.flatMap((broadcast) => broadcast.names || []) || [],
    sourceUrl: safeUrl(sourceUrl),
    rawProviderData: event,
  };
}

const f1RaceSchema = z.object({
  round: z.string(),
  raceName: z.string(),
  date: z.string(),
  time: z.string().optional(),
  url: z.string().optional(),
  Circuit: z.object({
    circuitName: z.string(),
    Location: z.object({
      locality: z.string(),
      country: z.string(),
    }),
  }),
});

const f1PayloadSchema = z.object({
  MRData: z.object({
    RaceTable: z.object({
      Races: z.array(f1RaceSchema),
    }),
  }),
});

function f1Competition(year: number): NormalizedCompetition {
  return {
    provider: F1_PROVIDER,
    externalId: `f1-${year}`,
    sport: "formula1",
    name: "Formula 1 World Championship",
    shortName: "F1",
    competitionType: "championship",
    region: "International",
    currentSeason: String(year),
    isPreferredByDefault: true,
  };
}

function normalizeF1Race(
  race: z.infer<typeof f1RaceSchema>,
  competition: NormalizedCompetition,
): NormalizedEvent {
  const startsAtUtc = parseDate(
    race.time ? `${race.date}T${race.time}` : `${race.date}T12:00:00Z`,
  );
  return {
    provider: F1_PROVIDER,
    externalId: `${competition.currentSeason}-${race.round}`,
    sport: "formula1",
    competitionExternalId: competition.externalId,
    competition,
    stage: `Round ${race.round}`,
    participants: [{ name: race.raceName }],
    startsAtUtc,
    originalTimezone: "UTC",
    timeStatus: race.time ? "confirmed" : "tbc",
    status: "scheduled",
    venue: race.Circuit.circuitName,
    location: `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`,
    sourceUrl: safeUrl(race.url),
    rawProviderData: race,
  };
}

async function requestJson(url: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", ...headers },
    });
    if (!response.ok) throw new Error(`Schedule provider returned ${response.status}.`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function dateOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compactDate(value: string) {
  return value.replaceAll("-", "");
}

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? undefined : result;
}

function padelVenueName(
  venue:
    | string
    | { name?: string; address?: string }
    | null
    | undefined,
) {
  if (typeof venue === "string") return venue;
  return venue?.name || venue?.address || undefined;
}

function padelTimeStatus(
  label: string | null | undefined,
  date: Date | undefined,
): TimeStatus {
  const value = label?.toLowerCase() || "";
  if (value.includes("not before")) return "not_before";
  if (value.includes("followed") || value.includes("order")) return "order_of_play";
  return date ? "confirmed" : "tbc";
}

function padelStatus(value: string): EventStatus {
  if (value === "live") return "live";
  if (["ended", "finished", "retired", "walkover", "bye"].includes(value)) {
    return "finished";
  }
  if (value === "cancelled") return "cancelled";
  return "scheduled";
}

function espnStatus(value: {
  state: string;
  completed: boolean;
  description: string;
}): EventStatus {
  const description = value.description.toLowerCase();
  if (description.includes("postpon")) return "postponed";
  if (description.includes("cancel")) return "cancelled";
  if (description.includes("delay")) return "delayed";
  if (value.completed || value.state === "post") return "finished";
  if (value.state === "in") return "live";
  return "scheduled";
}

function safeUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function titleCase(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}
