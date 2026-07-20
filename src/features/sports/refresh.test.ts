import assert from "node:assert/strict";
import test from "node:test";
import { isDefaultPreferred, isFresh } from "./config";
import { parseRefreshScope } from "./refresh";

test("event and competition freshness uses last success and strict TTLs", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  assert.equal(isFresh(new Date("2026-07-19T11:01:00.000Z"), 60 * 60_000, now), true);
  assert.equal(isFresh(new Date("2026-07-19T11:00:00.000Z"), 60 * 60_000, now), false);
  assert.equal(isFresh(null, 60 * 60_000, now), false);
  assert.equal(isFresh(new Date("2026-07-18T12:01:00.000Z"), 24 * 3_600_000, now), true);
});

test("validates global, sport, and scoped competition refresh locks", () => {
  assert.deepEqual(parseRefreshScope("all-supported"), {
    key: "all-supported",
    type: "all",
  });
  assert.deepEqual(parseRefreshScope("basketball"), {
    key: "basketball",
    type: "sport",
    sport: "basketball",
  });
  assert.deepEqual(parseRefreshScope("formula1"), {
    key: "formula1",
    type: "sport",
    sport: "formula1",
  });
  assert.deepEqual(parseRefreshScope("boxing"), {
    key: "boxing",
    type: "sport",
    sport: "boxing",
  });
  assert.deepEqual(parseRefreshScope("ufc"), {
    key: "ufc",
    type: "sport",
    sport: "ufc",
  });
  assert.deepEqual(parseRefreshScope("football:competition:4328"), {
    key: "football:competition:4328",
    type: "competition",
    sport: "football",
    competitionExternalId: "4328",
  });
  assert.equal(parseRefreshScope("football:competition:../bad"), null);
});

test("NBA and broad football defaults remain centralized", () => {
  assert.equal(isDefaultPreferred("basketball", "NBA", "USA"), true);
  assert.equal(isDefaultPreferred("football", "Copa Libertadores", "South America"), true);
  assert.equal(isDefaultPreferred("football", "Uncommon League", "Iceland"), false);
});
