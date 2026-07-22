import { z } from "zod";
import {
  CATALOG_COUNTRIES,
  CORE_COMPETITION_IDS,
  isDefaultPreferred,
  sportsConfig,
  SPORTS_PROVIDER,
} from "./config";
import type {
  EventStatus,
  NormalizedCompetition,
  NormalizedEvent,
  Sport,
} from "./types";

const leagueSchema = z
  .object({
    idLeague: z.string(),
    strSport: z.string().optional().nullable(),
    strLeague: z.string(),
    strLeagueAlternate: z.string().optional().nullable(),
    idCup: z.string().optional().nullable(),
    strCurrentSeason: z.string().optional().nullable(),
    strCountry: z.string().optional().nullable(),
    strBadge: z.string().optional().nullable(),
  })
  .passthrough();

const eventSchema = z
  .object({
    idEvent: z.string(),
    idLeague: z.string().optional().nullable(),
    strLeague: z.string().optional().nullable(),
    strSport: z.string().optional().nullable(),
    strHomeTeam: z.string().optional().nullable(),
    strAwayTeam: z.string().optional().nullable(),
    strEvent: z.string().optional().nullable(),
    strTimestamp: z.string().optional().nullable(),
    dateEvent: z.string().optional().nullable(),
    strTime: z.string().optional().nullable(),
    strStatus: z.string().optional().nullable(),
    strVenue: z.string().optional().nullable(),
    strCountry: z.string().optional().nullable(),
    strCity: z.string().optional().nullable(),
    strRound: z.string().optional().nullable(),
    strSeason: z.string().optional().nullable(),
    strThumb: z.string().optional().nullable(),
  })
  .passthrough();

export type ProviderCapabilities = {
  supportedSports: Sport[];
  supportsGlobalDateQuery: boolean;
  supportsCompetitionCatalog: boolean;
  supportsCompetitionQuery: boolean;
  supportsCountryMetadata: boolean;
  supportsBroadcastData: boolean;
  supportsLiveStatus: boolean;
};

export interface SportsScheduleProvider {
  getCompetitions(sport?: Sport): Promise<NormalizedCompetition[]>;
  getUpcomingEvents(query: {
    sports: Sport[];
    competitionExternalId?: string;
    force?: boolean;
  }): Promise<NormalizedEvent[]>;
  getCapabilities(): ProviderCapabilities;
}

export class TheSportsDbProvider implements SportsScheduleProvider {
  getCapabilities(): ProviderCapabilities {
    return {
      supportedSports: ["football", "basketball"],
      supportsGlobalDateQuery: true,
      supportsCompetitionCatalog: true,
      supportsCompetitionQuery: true,
      supportsCountryMetadata: true,
      supportsBroadcastData: false,
      supportsLiveStatus: true,
    };
  }

  async getCompetitions(sport?: Sport) {
    const requested = sport ? [sport] : (["football", "basketball"] as Sport[]);
    const supported = requested.filter(
      (item): item is Extract<Sport, "football" | "basketball"> =>
        item === "football" || item === "basketball",
    );
    const all: NormalizedCompetition[] = [];

    for (const current of supported) {
      const providerSport = current === "football" ? "Soccer" : "Basketball";
      for (const country of CATALOG_COUNTRIES[current]) {
        const payload = await this.request(
          `/search_all_leagues.php?c=${encodeURIComponent(country)}&s=${providerSport}`,
        );
        const parsed = z.array(leagueSchema).safeParse(payload.countries ?? []);
        if (!parsed.success) throw new Error("Invalid competition catalog response.");
        all.push(...parsed.data.map((league) => normalizeLeague(league, current)));
      }
    }

    if (!sport) {
      const discoveredIds = new Set(all.map((competition) => competition.externalId));
      for (const id of CORE_COMPETITION_IDS) {
        if (discoveredIds.has(id)) continue;
        const payload = await this.request(`/lookupleague.php?id=${id}`);
        const parsed = z.array(leagueSchema).safeParse(payload.leagues ?? []);
        if (!parsed.success) throw new Error("Invalid core competition response.");
        for (const league of parsed.data) {
          const normalizedSport = providerSport(league.strSport);
          if (normalizedSport === "football" || normalizedSport === "basketball") {
            all.push(normalizeLeague(league, normalizedSport));
            discoveredIds.add(league.idLeague);
          }
        }
      }
    }

    return dedupeBy(all, (competition) => competition.externalId);
  }

  async getUpcomingEvents(query: {
    sports: Sport[];
    competitionExternalId?: string;
    force?: boolean;
  }) {
    if (query.competitionExternalId) {
      const payload = await this.request(
        `/eventsnextleague.php?id=${encodeURIComponent(query.competitionExternalId)}`,
      );
      return this.normalizeEvents(payload.events ?? []);
    }

    const config = sportsConfig();
    const events: NormalizedEvent[] = [];
    for (let day = 0; day < config.upcomingWindowDays; day += 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + day);
      const dateValue = date.toISOString().slice(0, 10);
      for (const sport of query.sports.filter(
        (item): item is Extract<Sport, "football" | "basketball"> =>
          item === "football" || item === "basketball",
      )) {
        const providerSport = sport === "football" ? "Soccer" : "Basketball";
        const payload = await this.request(
          `/eventsday.php?d=${dateValue}&s=${providerSport}`,
          scheduleRequestRevalidateSeconds(day, Boolean(query.force)),
        );
        events.push(...this.normalizeEvents(payload.events ?? []));
      }
    }
    return dedupeBy(events, (event) => event.externalId);
  }

  private normalizeEvents(value: unknown) {
    const parsed = z.array(eventSchema).safeParse(value);
    if (!parsed.success) throw new Error("Invalid sports schedule response.");
    return parsed.data.map(normalizeEvent).filter((event): event is NormalizedEvent => Boolean(event));
  }

  private async request(
    path: string,
    revalidateSeconds?: number,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${sportsConfig().apiBaseUrl}${path}`, {
        ...(revalidateSeconds
          ? { next: { revalidate: revalidateSeconds } }
          : { cache: "no-store" as const }),
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("Sports provider rate limit reached.");
        throw new Error(`Sports provider returned ${response.status}.`);
      }
      return (await response.json()) as Record<string, unknown>;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function scheduleRequestRevalidateSeconds(
  dayOffset: number,
  force: boolean,
) {
  if (force || dayOffset < 2) return undefined;
  return 6 * 60 * 60;
}

function normalizeLeague(
  league: z.infer<typeof leagueSchema>,
  sport: Extract<Sport, "football" | "basketball">,
): NormalizedCompetition {
  const name = league.strLeague.trim();
  const country = league.strCountry?.trim() || undefined;
  return {
    provider: SPORTS_PROVIDER,
    externalId: league.idLeague,
    sport,
    name,
    shortName: league.strLeagueAlternate?.split(",")[0]?.trim() || undefined,
    competitionType: competitionType(name, league.idCup),
    countryName: country,
    region: regionForCountry(country),
    logoUrl: safeProviderUrl(league.strBadge),
    currentSeason: league.strCurrentSeason || undefined,
    isPreferredByDefault: isDefaultPreferred(sport, name, country),
  };
}

function normalizeEvent(event: z.infer<typeof eventSchema>): NormalizedEvent | null {
  const sport = providerSport(event.strSport);
  if (!sport) return null;
  const names = participantNames(event);
  if (names.length === 0) return null;
  const startsAt = providerDate(event);
  const competitionName = event.strLeague?.trim() || "Unspecified competition";
  const competitionExternalId = event.idLeague || `event-${event.idEvent}`;
  return {
    provider: SPORTS_PROVIDER,
    externalId: event.idEvent,
    sport,
    competitionExternalId,
    competition: {
      provider: SPORTS_PROVIDER,
      externalId: competitionExternalId,
      sport,
      name: competitionName,
      competitionType: competitionType(competitionName),
      countryName: event.strCountry?.trim() || undefined,
      currentSeason: event.strSeason || undefined,
      isPreferredByDefault: isDefaultPreferred(
        sport,
        competitionName,
        event.strCountry || undefined,
      ),
    },
    round: event.strRound || undefined,
    participants: names.map((name, index) => ({
      name,
      role: index === 0 ? "home" : "away",
    })),
    startsAtUtc: startsAt,
    originalTimezone: startsAt ? "UTC" : undefined,
    timeStatus: startsAt ? "confirmed" : "tbc",
    status: normalizeStatus(event.strStatus),
    venue: event.strVenue || undefined,
    location: [event.strCity, event.strCountry].filter(Boolean).join(", ") || undefined,
    sourceUrl: `https://www.thesportsdb.com/event/${event.idEvent}`,
    rawProviderData: event,
  };
}

function providerDate(event: z.infer<typeof eventSchema>) {
  const value =
    event.strTimestamp ||
    (event.dateEvent && event.strTime
      ? `${event.dateEvent}T${event.strTime.replace("Z", "")}Z`
      : event.dateEvent
        ? `${event.dateEvent}T00:00:00Z`
        : null);
  if (!value) return undefined;
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function participantNames(event: z.infer<typeof eventSchema>) {
  const explicit = [event.strHomeTeam, event.strAwayTeam]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name));
  if (explicit.length > 0) return explicit;
  return (event.strEvent ?? "")
    .split(/\s+(?:vs|v|@)\s+/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

function providerSport(
  value?: string | null,
): Extract<Sport, "football" | "basketball"> | null {
  if (value?.toLowerCase() === "soccer") return "football";
  if (value?.toLowerCase() === "basketball") return "basketball";
  return null;
}

function normalizeStatus(value?: string | null): EventStatus {
  const status = value?.toLowerCase() ?? "";
  if (status.includes("postpon")) return "postponed";
  if (status.includes("cancel")) return "cancelled";
  if (status.includes("delay")) return "delayed";
  if (status.includes("live") || status.includes("progress")) return "live";
  if (status.includes("finish") || status === "ft" || status.includes("match finished")) {
    return "finished";
  }
  return "scheduled";
}

function competitionType(name: string, cup?: string | null) {
  const value = name.toLowerCase();
  if (value.includes("qualif")) return "qualifier";
  if (
    value.includes("uefa champions") ||
    value.includes("uefa europa") ||
    value.includes("uefa conference") ||
    value.includes("libertadores") ||
    value.includes("sudamericana")
  ) {
    return "continental";
  }
  if (value.includes("world") || value.includes("international")) return "international";
  if (cup === "1" || value.includes("cup") || value.includes("copa")) return "cup";
  if (value.includes("playoff")) return "playoff";
  if (value.includes("tour")) return "tour";
  if (value.includes("tournament")) return "tournament";
  return "league";
}

function regionForCountry(country?: string) {
  if (!country) return undefined;
  if (["Uruguay", "Argentina", "Brazil"].includes(country)) return "South America";
  if (["England", "Spain", "Italy", "Germany", "France"].includes(country)) return "Europe";
  if (country === "USA") return "North America";
  return undefined;
}

function safeProviderUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function dedupeBy<T>(values: T[], key: (value: T) => string) {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}
