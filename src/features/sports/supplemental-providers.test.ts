import assert from "node:assert/strict";
import test from "node:test";
import { selectNbaScheduleSources } from "./supplemental-providers";

test("discovers every NBA schedule feed without including adjacent leagues", () => {
  const sources = selectNbaScheduleSources([
    { slug: "wnba", name: "WNBA" },
    { slug: "nba-summer-utah", name: "Salt Lake City Summer League" },
    { slug: "nba-development", name: "NBA G League" },
    { slug: "nba", name: "NBA" },
    { slug: "nba-summer-california", name: "California Classic" },
    { slug: "nba-summer-utah", name: "Duplicate" },
  ]);

  assert.deepEqual(
    sources.map((source) => source.slug),
    ["nba", "nba-summer-california", "nba-summer-utah"],
  );
});
