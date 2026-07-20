export const sports = ["football", "basketball", "padel", "formula1"] as const;
export type Sport = (typeof sports)[number];
export type CompetitionMode = "preferred" | "all";
export type EventStatus =
  | "scheduled"
  | "delayed"
  | "postponed"
  | "cancelled"
  | "live"
  | "finished";
export type TimeStatus =
  | "confirmed"
  | "estimated"
  | "not_before"
  | "order_of_play"
  | "tbc";

export type SportsParticipant = {
  id?: string;
  name: string;
  shortName?: string;
  role?: "home" | "away" | "player" | "pair";
};

export type NormalizedCompetition = {
  provider: string;
  externalId: string;
  sport: Sport;
  name: string;
  shortName?: string;
  competitionType: string;
  countryCode?: string;
  countryName?: string;
  region?: string;
  logoUrl?: string;
  currentSeason?: string;
  isPreferredByDefault: boolean;
  providerUpdatedAt?: Date;
};

export type NormalizedEvent = {
  provider: string;
  externalId: string;
  sport: Sport;
  competitionExternalId?: string;
  competition?: NormalizedCompetition;
  stage?: string;
  round?: string;
  participants: SportsParticipant[];
  startsAtUtc?: Date;
  endsAtUtc?: Date;
  originalTimezone?: string;
  timeStatus: TimeStatus;
  status: EventStatus;
  venue?: string;
  location?: string;
  broadcast?: string[];
  sourceUrl?: string;
  providerUpdatedAt?: Date;
  rawProviderData?: unknown;
};

export type CompetitionView = {
  id: string;
  provider: string;
  externalId: string;
  sport: Sport;
  name: string;
  shortName: string | null;
  competitionType: string;
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  logoUrl: string | null;
  currentSeason: string | null;
  isPreferredByDefault: boolean;
  fetchedAt: string;
};

export type EventView = {
  id: string;
  provider: string;
  externalId: string;
  sport: Sport;
  competitionId: string | null;
  competition: CompetitionView | null;
  stage: string | null;
  round: string | null;
  participants: SportsParticipant[];
  startsAtUtc: string | null;
  endsAtUtc: string | null;
  originalTimezone: string | null;
  timeStatus: TimeStatus;
  status: EventStatus;
  venue: string | null;
  location: string | null;
  broadcast: string[];
  sourceUrl: string | null;
  providerUpdatedAt: string | null;
  fetchedAt: string;
};

export type SportsPreferencesView = {
  preferredSports: Sport[];
  preferredCompetitionIds: string[];
  defaultCompetitionMode: CompetitionMode;
  lastSelectedSport?: Sport;
  lastSelectedCompetitionIds: string[];
  timezone?: string;
};

export type SyncMetadata = {
  lastSuccessfulRefreshAt: string | null;
  lastAttemptAt: string | null;
  isStale: boolean;
  isRefreshing: boolean;
  lastRefreshFailed: boolean;
  partialFailure: boolean;
  refreshAfter: string | null;
  provider: string;
};

export type SportsDataResponse = {
  events: EventView[];
  competitions: CompetitionView[];
  preferences: SportsPreferencesView;
  sync: SyncMetadata;
  capabilities: {
    liveSports: Sport[];
    unavailableSports: Sport[];
    providerLabel: string;
  };
};
