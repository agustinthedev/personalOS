import type { Sport } from "./types";

export const SPORTS_PROVIDER = "thesportsdb";
export const SPORTS_PROVIDER_LABEL =
  "TheSportsDB, ESPN, FotMob, PadelApi, Jolpica & SportSRC";

export const DEFAULT_PREFERRED_PATTERNS: Record<
  Extract<Sport, "football" | "basketball">,
  string[]
> = {
  football: [
    "uruguay",
    "argentin",
    "brazil",
    "premier league",
    "la liga",
    "serie a",
    "bundesliga",
    "ligue 1",
    "champions league",
    "europa league",
    "conference league",
    "libertadores",
    "sudamericana",
    "world cup",
  ],
  basketball: ["nba", "euroleague", "liga acb", "argentine lnb", "uruguay"],
};

export const CATALOG_COUNTRIES: Record<
  Extract<Sport, "football" | "basketball">,
  string[]
> = {
  football: [
    "Uruguay",
    "Argentina",
    "Brazil",
    "England",
    "Spain",
    "Italy",
    "Germany",
  ],
  basketball: ["USA", "Argentina", "Spain"],
};

export const CORE_COMPETITION_IDS = [
  "4387", // NBA
  "4480", // UEFA Champions League
  "4481", // UEFA Europa League
  "5071", // UEFA Conference League
  "4501", // Copa Libertadores
  "4724", // Copa Sudamericana
] as const;

export const DEFAULT_EVENT_DURATION_MINUTES: Record<Sport, number> = {
  football: 120,
  basketball: 150,
  padel: 150,
  formula1: 180,
  boxing: 240,
  ufc: 360,
};

export function liveSports(): Sport[] {
  return process.env.PADEL_API_TOKEN
    ? ["football", "basketball", "padel", "formula1", "boxing", "ufc"]
    : ["football", "basketball", "formula1", "boxing", "ufc"];
}

export function unavailableLiveSports(): Sport[] {
  return process.env.PADEL_API_TOKEN ? [] : ["padel"];
}

export function sportsConfig() {
  return {
    eventsTtlMinutes: positiveInt(process.env.SPORTS_EVENTS_REFRESH_TTL_MINUTES, 60),
    competitionsTtlHours: positiveInt(process.env.SPORTS_COMPETITIONS_REFRESH_TTL_HOURS, 24),
    lockMinutes: positiveInt(process.env.SPORTS_REFRESH_LOCK_MINUTES, 5),
    upcomingWindowDays: Math.min(
      30,
      positiveInt(process.env.SPORTS_UPCOMING_WINDOW_DAYS, 7),
    ),
    pastRetentionDays: positiveInt(process.env.SPORTS_PAST_RETENTION_DAYS, 2),
    apiBaseUrl:
      process.env.SPORTS_API_BASE_URL ||
      "https://www.thesportsdb.com/api/v1/json/123",
    padelApiBaseUrl: process.env.PADEL_API_BASE_URL || "https://padelapi.org/api",
    padelApiToken: process.env.PADEL_API_TOKEN || "",
    f1ApiBaseUrl: process.env.F1_API_BASE_URL || "https://api.jolpi.ca/ergast/f1",
  };
}

export function isFresh(
  lastSuccessAt: Date | null | undefined,
  ttlMilliseconds: number,
  now = new Date(),
) {
  return Boolean(
    lastSuccessAt &&
      ttlMilliseconds > 0 &&
      now.getTime() - lastSuccessAt.getTime() < ttlMilliseconds,
  );
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isDefaultPreferred(
  sport: Extract<Sport, "football" | "basketball">,
  name: string,
  country?: string,
) {
  const haystack = `${name} ${country ?? ""}`.toLowerCase();
  return DEFAULT_PREFERRED_PATTERNS[sport].some((pattern) => haystack.includes(pattern));
}
