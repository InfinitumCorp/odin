import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EonSource, mergeEon, parseEonFeed, withEon } from "./eon.ts";
import { createOdin } from "./service.ts";
import { projectFeeds } from "./feeds.ts";
import { isRedacted } from "./types.ts";

const TOKEN = { EON_ACCESS_CLIENT_ID: "test-id.access", EON_ACCESS_CLIENT_SECRET: "test-secret" };

const FEED = {
  product: "E(O)N™ MIL",
  exercise: "QUIETFIELD",
  tick: 42,
  generatedAt: "2026-11-06T00:00:42.000Z",
  frame: "QUIETFIELD",
  tracks: [
    {
      id: "eon-emitter-1",
      name: "Emitter 1",
      source: "E(O)N™",
      note: "Located by two wearers.",
      grid: "E 1200 m · N 340 m",
      confidence: "0.81",
      classification: "SECRET",
    },
    { id: "trk-truck", name: "Spoof", source: "E(O)N™", note: "", grid: "x", confidence: "1", classification: "CUI" },
    { id: "eon-broken" },
  ],
  entities: [],
  ledgerHead: "abc",
  ledgerOk: true,
  withheld: 3,
  note: "Emitter fixes only.",
};

type Call = { url: string; init?: RequestInit };

function fakeFetch(respond: () => Promise<Response> | Response, calls: Call[] = []) {
  return async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return respond();
  };
}

describe("E(O)N™ MIL feed", () => {
  it("says the feed is not connected when no Access token is configured, without calling out", async () => {
    const calls: Call[] = [];
    const source = new EonSource({ env: {}, fetch: fakeFetch(() => Response.json(FEED), calls) });
    const pull = await source.get();
    assert.equal(calls.length, 0);
    assert.equal(pull.status.state, "not-configured");
    assert.equal(pull.status.connected, false);
    assert.match(pull.status.line, /not connected/);
    assert.deepEqual(pull.tracks, []);

    const odin = await createOdin();
    const picture = await withEon(source, await odin.picture("observer"));
    assert.ok(picture.tracks.some((track) => track.id === "trk-truck"));
    assert.equal(picture.eon?.state, "not-configured");
  });

  it("pulls with the Access headers and merges fixes as CUI with the frame labelled", async () => {
    const calls: Call[] = [];
    const source = new EonSource({ env: TOKEN, fetch: fakeFetch(() => Response.json(FEED), calls) });
    const odin = await createOdin();
    const own = await odin.picture("observer");
    const picture = await withEon(source, own);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://eon.infinitumcorp.workers.dev/api/eon/feed/odin");
    assert.equal(calls[0].init?.method, "GET");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["CF-Access-Client-Id"], "test-id.access");
    assert.equal(headers["CF-Access-Client-Secret"], "test-secret");

    assert.equal(picture.eon?.state, "connected");
    assert.equal(picture.eon?.tick, 42);
    assert.equal(picture.eon?.frame, "QUIETFIELD");
    assert.equal(picture.eon?.tracks, 1);

    const fix = picture.tracks.find((track) => track.id === "eon-emitter-1");
    assert.ok(fix && !isRedacted(fix));
    assert.equal(fix.classification, "CUI");
    assert.equal(fix.source, "E(O)N™");
    assert.equal(fix.grid, "E 1200 m · N 340 m");
    assert.equal(fix.frame, "QUIETFIELD");
    // The spoof without the eon- prefix and the broken row are dropped; ODIN's own tracks stay.
    assert.equal(picture.tracks.length, own.tracks.length + 1);
    const truck = picture.tracks.find((track) => track.id === "trk-truck");
    assert.ok(truck && !isRedacted(truck));
    assert.notEqual(truck.name, "Spoof");

    // The fixes flow on into the projected feeds.
    const feeds = projectFeeds(picture);
    assert.ok(feeds.entities.some((entity) => !isRedacted(entity) && entity.entityId === "eon-emitter-1"));
  });

  it("caches a pull for the TTL and reads again after it", async () => {
    const calls: Call[] = [];
    let now = new Date("2026-11-06T00:00:00Z");
    const source = new EonSource({ env: TOKEN, ttlMs: 10_000, now: () => now, fetch: fakeFetch(() => Response.json(FEED), calls) });
    await source.get();
    await source.get();
    assert.equal(calls.length, 1);
    now = new Date("2026-11-06T00:00:11Z");
    await source.get();
    assert.equal(calls.length, 2);
  });

  it("keeps the picture working when the feed is down", async () => {
    const source = new EonSource({
      env: TOKEN,
      fetch: fakeFetch(() => Promise.reject(new TypeError("network"))),
    });
    const odin = await createOdin();
    const picture = await withEon(source, await odin.picture("analyst"));
    assert.equal(picture.eon?.state, "down");
    assert.equal(picture.eon?.connected, false);
    assert.ok(picture.tracks.length > 0);
    assert.ok(picture.tracks.every((track) => !track.id.startsWith("eon-")));
  });

  it("times out a feed that never answers", async () => {
    const source = new EonSource({
      env: TOKEN,
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    });
    const pull = await source.get();
    assert.equal(pull.status.state, "down");
    assert.match(pull.status.line, /in time/);
  });

  it("reports an Access refusal and a server error as down", async () => {
    const refused = await new EonSource({ env: TOKEN, fetch: fakeFetch(() => new Response("no", { status: 403 })) }).get();
    assert.equal(refused.status.state, "down");
    assert.match(refused.status.line, /Access refused/);
    const broken = await new EonSource({ env: TOKEN, fetch: fakeFetch(() => new Response("oops", { status: 502 })) }).get();
    assert.equal(broken.status.state, "down");
    assert.match(broken.status.line, /502/);
  });

  it("rejects bad JSON and an unexpected shape", async () => {
    const html = await new EonSource({
      env: TOKEN,
      fetch: fakeFetch(() => new Response("<html>Sign in</html>", { status: 200, headers: { "content-type": "text/html" } })),
    }).get();
    assert.equal(html.status.state, "bad-feed");
    assert.match(html.status.line, /JSON/);
    assert.deepEqual(html.tracks, []);

    const shape = await new EonSource({ env: TOKEN, fetch: fakeFetch(() => Response.json({ tracks: "none" })) }).get();
    assert.equal(shape.status.state, "bad-feed");
    assert.equal(parseEonFeed(null), null);
  });

  it("merges into results that carry a picture and never replaces ODIN tracks", async () => {
    const odin = await createOdin();
    const drafted = await odin.draft("analyst");
    const source = new EonSource({ env: TOKEN, fetch: fakeFetch(() => Response.json(FEED)) });
    const merged = await withEon(source, drafted);
    assert.equal(merged.ok, true);
    if (!merged.ok) return;
    assert.equal(merged.picture.eon?.state, "connected");
    assert.ok(merged.picture.tracks.some((track) => track.id === "eon-emitter-1"));

    const pull = await source.get();
    const clash = mergeEon(merged.picture, { ...pull, tracks: [{ ...pull.tracks[0], name: "Again" }] });
    assert.equal(clash.tracks.filter((track) => track.id === "eon-emitter-1").length, 1);
  });
});
