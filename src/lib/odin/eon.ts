import type { Picture, TrackView } from "./types.ts";

/**
 * Read-only pull of the E(O)N™ MIL emitter feed.
 *
 * E(O)N™ publishes GET /api/eon/feed/odin with every located emitter in
 * ODIN's own TrackView shape. ODIN reads it and merges the tracks into the
 * picture as CUI. ODIN never writes back to E(O)N™.
 *
 * The E(O)N™ site is behind Cloudflare Access. A server-side pull needs an
 * Access service token, supplied as Worker secrets. With no token, the
 * picture still works and says the feed is not connected.
 */

export const EON_FEED_URL = "https://eon.infinitumcorp.workers.dev/api/eon/feed/odin";
export const EON_TIMEOUT_MS = 4000;
export const EON_TTL_MS = 10_000;

export interface EonEnv {
  /** Central CID-authenticated repository service. */
  LBRNTH_ENDPOINT?: string;
  EON_FEED_URL?: string;
  EON_ACCESS_CLIENT_ID?: string;
  EON_ACCESS_CLIENT_SECRET?: string;
  /** Opt-in geo routing. Unset or off leaves the exercise picture unchanged. */
  INFINITUM_GEO_ENABLED?: string;
}

export type EonState = "connected" | "not-configured" | "down" | "bad-feed";

export interface EonStatus {
  state: EonState;
  connected: boolean;
  product: "E(O)N™ MIL";
  url: string;
  /** The E(O)N™ exercise tick of the last good pull, if any. */
  tick: number | null;
  generatedAt: string | null;
  /** The frame E(O)N™ grids are in. Not ODIN's range grid. */
  frame: string | null;
  tracks: number;
  checkedAt: string;
  line: string;
}

export interface EonPull {
  status: EonStatus;
  tracks: TrackView[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface EonSourceOptions {
  env?: EonEnv;
  fetch?: FetchLike;
  timeoutMs?: number;
  ttlMs?: number;
  now?: () => Date;
}

function text(value: unknown, max = 400): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function readTrack(raw: unknown, frame: string): TrackView | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = text(row.id, 80);
  const name = text(row.name, 120);
  const grid = text(row.grid, 80) ?? (typeof row.grid === "number" ? String(row.grid) : null);
  if (!id || !id.startsWith("eon-") || !name || !grid) return null;
  const confidence =
    typeof row.confidence === "number" ? row.confidence.toFixed(2) : text(row.confidence, 16) ?? "—";
  return {
    id,
    name,
    source: text(row.source, 40) ?? "E(O)N™",
    note: text(row.note) ?? "Emitter fix from E(O)N™ MIL.",
    grid,
    frame,
    confidence,
    // Every E(O)N™ fix enters ODIN as CUI, whatever the feed says.
    classification: "CUI",
  };
}

/** Parse a feed body. Returns null when it is not an E(O)N™ feed. */
export function parseEonFeed(body: unknown): { tick: number | null; generatedAt: string | null; frame: string; tracks: TrackView[] } | null {
  if (typeof body !== "object" || body === null) return null;
  const feed = body as Record<string, unknown>;
  if (!Array.isArray(feed.tracks)) return null;
  const frame = text(feed.frame, 60) ?? "QUIETFIELD";
  const tracks: TrackView[] = [];
  const seen = new Set<string>();
  for (const raw of feed.tracks.slice(0, 200)) {
    const track = readTrack(raw, frame);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
  }
  return {
    tick: typeof feed.tick === "number" && Number.isFinite(feed.tick) ? feed.tick : null,
    generatedAt: text(feed.generatedAt, 40),
    frame,
    tracks,
  };
}

export function eonEnvFromProcess(): EonEnv {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return {
    EON_FEED_URL: env.EON_FEED_URL,
    EON_ACCESS_CLIENT_ID: env.EON_ACCESS_CLIENT_ID,
    EON_ACCESS_CLIENT_SECRET: env.EON_ACCESS_CLIENT_SECRET,
  };
}

export class EonSource {
  private readonly env: EonEnv;
  private readonly fetcher: FetchLike;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private last: { at: number; pull: EonPull } | null = null;
  private pending: Promise<EonPull> | null = null;

  constructor(options: EonSourceOptions = {}) {
    this.env = options.env ?? eonEnvFromProcess();
    this.fetcher = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? EON_TIMEOUT_MS;
    this.ttlMs = options.ttlMs ?? EON_TTL_MS;
    this.now = options.now ?? (() => new Date());
  }

  get url() {
    return this.env.EON_FEED_URL?.trim() || EON_FEED_URL;
  }

  /** The last pull, or a fresh one when the cache is older than the TTL. */
  async get(): Promise<EonPull> {
    const at = this.now().getTime();
    if (this.last && at - this.last.at < this.ttlMs) return this.last.pull;
    if (!this.pending) {
      this.pending = this.pull().then((pull) => {
        this.last = { at: this.now().getTime(), pull };
        this.pending = null;
        return pull;
      });
    }
    return this.pending;
  }

  private status(state: EonState, line: string, feed?: { tick: number | null; generatedAt: string | null; frame: string; tracks: TrackView[] }): EonStatus {
    return {
      state,
      connected: state === "connected",
      product: "E(O)N™ MIL",
      url: this.url,
      tick: feed?.tick ?? null,
      generatedAt: feed?.generatedAt ?? null,
      frame: feed?.frame ?? null,
      tracks: feed?.tracks.length ?? 0,
      checkedAt: this.now().toISOString(),
      line,
    };
  }

  private async pull(): Promise<EonPull> {
    const id = this.env.EON_ACCESS_CLIENT_ID?.trim();
    const secret = this.env.EON_ACCESS_CLIENT_SECRET?.trim();
    if (!id || !secret) {
      return {
        status: this.status("not-configured", "The E(O)N™ feed is not connected. No Access service token is configured."),
        tracks: [],
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetcher(this.url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "CF-Access-Client-Id": id,
          "CF-Access-Client-Secret": secret,
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      return {
        status: this.status("down", controller.signal.aborted ? "The E(O)N™ feed did not answer in time." : "The E(O)N™ feed could not be reached."),
        tracks: [],
      };
    }
    try {
      if (!response.ok) {
        const line =
          response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)
            ? "Cloudflare Access refused the E(O)N™ service token."
            : `The E(O)N™ feed answered ${response.status}.`;
        return { status: this.status("down", line), tracks: [] };
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { status: this.status("bad-feed", "The E(O)N™ feed did not send JSON."), tracks: [] };
      }
      const feed = parseEonFeed(body);
      if (!feed) return { status: this.status("bad-feed", "The E(O)N™ feed sent an unexpected shape."), tracks: [] };
      const count = feed.tracks.length;
      const line = `${count === 1 ? "One emitter fix" : `${count} emitter fixes`} from E(O)N™ MIL${feed.tick !== null ? ` at tick ${feed.tick}` : ""}. Grids are in the ${feed.frame} frame, not the ODIN° range grid.`;
      return { status: this.status("connected", line, feed), tracks: feed.tracks };
    } catch {
      return { status: this.status("down", "The E(O)N™ feed could not be read."), tracks: [] };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Add E(O)N™ fixes to a picture. ODIN's own tracks are never replaced. */
export function mergeEon(picture: Picture, pull: EonPull): Picture {
  const own = new Set(picture.tracks.map((track) => track.id));
  const extra = pull.tracks.filter((track) => !own.has(track.id));
  return { ...picture, tracks: [...picture.tracks, ...extra], eon: pull.status };
}

/** Merge E(O)N™ into a picture, or into a result that carries one. */
export async function withEon<T>(source: EonSource, result: T): Promise<T> {
  if (typeof result !== "object" || result === null) return result;
  const pull = await source.get();
  if ("tracks" in result && "exercise" in result) return mergeEon(result as unknown as Picture, pull) as T;
  if ("picture" in result && (result as { picture?: unknown }).picture) {
    const carrier = result as unknown as { picture: Picture };
    return { ...result, picture: mergeEon(carrier.picture, pull) } as T;
  }
  return result;
}
