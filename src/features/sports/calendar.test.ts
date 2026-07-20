import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIcs,
  calendarDescription,
  escapeIcs,
  eventEnd,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "./calendar";
import type { EventView } from "./types";

const event: EventView = {
  id: "local-1",
  provider: "test",
  externalId: "event-1",
  sport: "football",
  competitionId: "competition-1",
  competition: {
    id: "competition-1",
    provider: "test",
    externalId: "league-1",
    sport: "football",
    name: "Test Cup",
    shortName: null,
    competitionType: "cup",
    countryCode: "UY",
    countryName: "Uruguay",
    region: "South America",
    logoUrl: null,
    currentSeason: "2026",
    isPreferredByDefault: true,
    fetchedAt: "2026-07-19T10:00:00.000Z",
  },
  stage: "Semi-final",
  round: "Round 2",
  participants: [{ name: "Team A" }, { name: "Team B" }],
  startsAtUtc: "2026-07-20T20:00:00.000Z",
  endsAtUtc: null,
  originalTimezone: "UTC",
  timeStatus: "confirmed",
  status: "scheduled",
  venue: "National Stadium",
  location: "Montevideo, Uruguay",
  broadcast: ["Test TV"],
  sourceUrl: "https://example.com/event/1",
  providerUpdatedAt: null,
  fetchedAt: "2026-07-19T10:00:00.000Z",
};

test("uses the centralized football duration", () => {
  assert.equal(eventEnd(event)?.toISOString(), "2026-07-20T22:00:00.000Z");
});

test("creates Google and Outlook compose URLs with event data", () => {
  const google = new URL(googleCalendarUrl(event) ?? "");
  const outlook = new URL(outlookCalendarUrl(event) ?? "");
  assert.equal(google.hostname, "calendar.google.com");
  assert.equal(google.searchParams.get("text"), "Team A vs Team B");
  assert.equal(google.searchParams.get("dates"), "20260720T200000Z/20260720T220000Z");
  assert.equal(outlook.hostname, "outlook.live.com");
  assert.equal(outlook.searchParams.get("subject"), "Team A vs Team B");
  assert.match(outlook.searchParams.get("body") ?? "", /Competition: Test Cup/);
});

test("includes estimated-time warnings", () => {
  const padel = { ...event, sport: "padel" as const, timeStatus: "estimated" as const };
  assert.match(calendarDescription(padel), /may change depending on earlier matches/);
});

test("builds one escaped multi-event ICS calendar with stable identifiers", () => {
  const calendar = buildIcs([
    event,
    { ...event, id: "local-2", externalId: "event-2", venue: "Court, 1" },
  ]);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.match(calendar, /UID:test-event-1@personal-os/);
  assert.match(calendar, /LOCATION:Court\\, 1/);
  assert.equal(escapeIcs("a,b;c\nline"), "a\\,b\\;c\\nline");
});

test("disables calendar URLs when no usable time exists", () => {
  const noTime = { ...event, startsAtUtc: null };
  assert.equal(googleCalendarUrl(noTime), null);
  assert.equal(outlookCalendarUrl(noTime), null);
});

test("disables calendar actions for date-only TBC events", () => {
  const dateOnly = { ...event, sport: "formula1" as const, timeStatus: "tbc" as const };
  assert.equal(googleCalendarUrl(dateOnly), null);
  assert.equal(outlookCalendarUrl(dateOnly), null);
});

test("uses combat-sport durations for calendar blocks", () => {
  assert.equal(
    eventEnd({ ...event, sport: "boxing" })?.toISOString(),
    "2026-07-21T00:00:00.000Z",
  );
  assert.equal(
    eventEnd({ ...event, sport: "ufc" })?.toISOString(),
    "2026-07-21T02:00:00.000Z",
  );
});
