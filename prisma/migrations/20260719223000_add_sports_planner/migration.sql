-- CreateTable
CREATE TABLE "SportsCompetition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "competitionType" TEXT NOT NULL DEFAULT 'other',
    "countryCode" TEXT,
    "countryName" TEXT,
    "region" TEXT,
    "logoUrl" TEXT,
    "currentSeason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPreferredByDefault" BOOLEAN NOT NULL DEFAULT false,
    "providerUpdatedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SportsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "competitionId" TEXT,
    "stage" TEXT,
    "round" TEXT,
    "participants" TEXT NOT NULL,
    "startsAtUtc" DATETIME,
    "endsAtUtc" DATETIME,
    "originalTimezone" TEXT,
    "timeStatus" TEXT NOT NULL DEFAULT 'tbc',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "venue" TEXT,
    "location" TEXT,
    "broadcastInfo" TEXT,
    "sourceUrl" TEXT,
    "providerUpdatedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "missingSince" DATETIME,
    "rawProviderData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SportsEvent_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "SportsCompetition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SportsSyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "sport" TEXT,
    "scopeKey" TEXT NOT NULL,
    "refreshStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastAttemptAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "refreshStartedAt" DATETIME,
    "lockExpiresAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SportsPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileKey" TEXT NOT NULL DEFAULT 'default',
    "preferredSports" TEXT NOT NULL,
    "preferredCompetitionIds" TEXT NOT NULL,
    "defaultCompetitionMode" TEXT NOT NULL DEFAULT 'preferred',
    "lastSelectedSport" TEXT,
    "lastSelectedCompetitionIds" TEXT NOT NULL,
    "timezone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SportsCompetition_provider_externalId_key" ON "SportsCompetition"("provider", "externalId");
CREATE INDEX "SportsCompetition_sport_isActive_idx" ON "SportsCompetition"("sport", "isActive");
CREATE INDEX "SportsCompetition_sport_isPreferredByDefault_idx" ON "SportsCompetition"("sport", "isPreferredByDefault");
CREATE INDEX "SportsCompetition_countryName_idx" ON "SportsCompetition"("countryName");
CREATE UNIQUE INDEX "SportsEvent_provider_externalId_key" ON "SportsEvent"("provider", "externalId");
CREATE INDEX "SportsEvent_sport_startsAtUtc_idx" ON "SportsEvent"("sport", "startsAtUtc");
CREATE INDEX "SportsEvent_competitionId_startsAtUtc_idx" ON "SportsEvent"("competitionId", "startsAtUtc");
CREATE INDEX "SportsEvent_status_startsAtUtc_idx" ON "SportsEvent"("status", "startsAtUtc");
CREATE UNIQUE INDEX "SportsSyncState_provider_scopeKey_key" ON "SportsSyncState"("provider", "scopeKey");
CREATE INDEX "SportsSyncState_scopeKey_refreshStatus_idx" ON "SportsSyncState"("scopeKey", "refreshStatus");
CREATE INDEX "SportsSyncState_lockExpiresAt_idx" ON "SportsSyncState"("lockExpiresAt");
CREATE UNIQUE INDEX "SportsPreference_profileKey_key" ON "SportsPreference"("profileKey");
