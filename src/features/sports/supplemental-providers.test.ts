import assert from "node:assert/strict";
import test from "node:test";
import {
  FotMobUruguayTvProvider,
  extractFotMobTvEvents,
  selectNbaScheduleSources,
} from "./supplemental-providers";

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

test("extracts structured Uruguay TV listings", () => {
  const html = `<html><script type="application/ld+json">${JSON.stringify({
    "@graph": [
      {
        "@type": "SportsEvent",
        "@id": "https://www.fotmob.com/matches/penarol-vs-cerro-largo#5904138",
        name: "Peñarol vs Cerro Largo",
        startDate: "2026-07-26T21:30:00.000Z",
        homeTeam: { name: "Peñarol" },
        awayTeam: { name: "Cerro Largo" },
        broadcastEvent: {
          publishedOn: [{ name: "Disney+ Premium" }],
        },
      },
    ],
  })}</script></html>`;
  const events = extractFotMobTvEvents(html);
  assert.equal(events.length, 1);
  assert.equal(events[0].startDate, "2026-07-26T21:30:00.000Z");
  assert.deepEqual(
    events[0].broadcastEvent?.publishedOn?.map((service) => service.name),
    ["Disney+ Premium"],
  );
});

test("loads the aggregate Uruguay TV guide with one request", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "SportsEvent",
        "@id": "https://www.fotmob.com/matches/example#123",
        name: "Home vs Away",
        startDate: "2026-07-26T21:30:00.000Z",
        homeTeam: { name: "Home" },
        awayTeam: { name: "Away" },
        broadcastEvent: { publishedOn: [{ name: "Disney+ Premium" }] },
      })}</script>`,
      { status: 200 },
    );
  };
  try {
    const result = await new FotMobUruguayTvProvider().getData();
    assert.equal(result.events.length, 1);
    assert.deepEqual(requestedUrls, ["https://www.fotmob.com/es/tv-guide/uy"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
