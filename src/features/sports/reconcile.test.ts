import assert from "node:assert/strict";
import test from "node:test";
import { reconcileEventViews } from "./reconcile";
import type { EventView } from "./types";

function event(overrides: Partial<EventView> = {}): EventView {
  return {
    id: "espn-1",
    provider: "espn",
    externalId: "1",
    sport: "football",
    competitionId: "uru-1",
    competition: null,
    stage: null,
    round: null,
    participants: [{ name: "Peñarol" }, { name: "Cerro Largo" }],
    startsAtUtc: "2026-08-01T18:00:00.000Z",
    endsAtUtc: null,
    originalTimezone: "UTC",
    timeStatus: "tbc",
    status: "scheduled",
    venue: "Estadio Campeón del Siglo",
    location: "Montevideo, Uruguay",
    broadcast: [],
    sourceUrl: null,
    providerUpdatedAt: null,
    fetchedAt: "2026-07-22T10:00:00.000Z",
    ...overrides,
  };
}

test("prefers a confirmed corroborating schedule over a shifted placeholder", () => {
  const result = reconcileEventViews([
    event(),
    event({
      id: "fotmob-1",
      provider: "fotmob",
      startsAtUtc: "2026-07-26T21:30:00.000Z",
      timeStatus: "confirmed",
      broadcast: ["Disney+ Premium"],
    }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].startsAtUtc, "2026-07-26T21:30:00.000Z");
  assert.equal(result[0].timeStatus, "confirmed");
  assert.deepEqual(result[0].broadcast, ["Disney+ Premium"]);
  assert.equal(result[0].competitionId, "uru-1");
});

test("does not merge separate confirmed fixtures between the same teams", () => {
  const result = reconcileEventViews([
    event({ startsAtUtc: "2026-07-20T18:00:00.000Z", timeStatus: "confirmed" }),
    event({ id: "later", startsAtUtc: "2026-07-27T18:00:00.000Z", timeStatus: "confirmed" }),
  ]);
  assert.equal(result.length, 2);
});
