import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultGeoPaths, repoRoot } from "../src/lib/geo/settings.ts";

/**
 * Download the locked v2fly geoip.dat and geosite.dat files.
 * Checksums are compared to the official .sha256sum asset and to geo/geo.lock.json.
 * A mismatch deletes nothing useful and leaves the data directory unchanged.
 * Loyalsoldier and sing-box builds are refused.
 */

const MAX_BYTES = 48 * 1024 * 1024;

export interface GeoLockEntry {
  file: string;
  project: string;
  tag: string;
  asset: string;
  checksumAsset: string;
  url: string;
  sha256Url: string;
  sha256: string;
  license: string;
}

export interface GeoLock {
  source: string;
  excluded: string[];
  datasets: GeoLockEntry[];
}

export class GeoChecksumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeoChecksumError";
  }
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseSha256Sum(text: string, asset: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hex = /^([a-f0-9]{64})(?:\s+\*?(\S+))?$/i;
  let bare: string | null = null;
  for (const line of lines) {
    const match = hex.exec(line);
    if (!match?.[1]) continue;
    const hash = match[1].toLowerCase();
    const file = match[2];
    if (!file) {
      bare = hash;
      continue;
    }
    if (file === asset || file.endsWith(`/${asset}`)) return hash;
  }
  if (lines.length === 1 && bare) return bare;
  throw new GeoChecksumError(`Official checksum file has no hash for ${asset}.`);
}

export function assertChecksum(input: { asset: string; officialText: string; lockHash: string; bytes: Uint8Array }): string {
  const official = parseSha256Sum(input.officialText, input.asset);
  const lock = input.lockHash.trim().toLowerCase();
  const actual = sha256(input.bytes);
  if (official !== lock || actual !== official) {
    throw new GeoChecksumError(
      [
        `Checksum mismatch for ${input.asset}.`,
        `Official sha256sum: ${official}`,
        `Lockfile sha256: ${lock}`,
        `Downloaded sha256: ${actual}`,
        "The file was not saved.",
      ].join("\n"),
    );
  }
  return actual;
}

export function allowedDownloadHost(hostname: string): boolean {
  return hostname === "github.com" || hostname.endsWith(".githubusercontent.com");
}

export function assertV2flyEntry(entry: GeoLockEntry): void {
  const banned = /loyalsoldier|sing-?box/i;
  const haystack = `${entry.project} ${entry.url} ${entry.sha256Url} ${entry.asset} ${entry.file}`;
  if (banned.test(haystack)) throw new GeoChecksumError("Refusing Loyalsoldier and sing-box datasets.");
  if (entry.project !== "v2fly/geoip" && entry.project !== "v2fly/domain-list-community") {
    throw new GeoChecksumError(`Refusing dataset project ${entry.project}.`);
  }
  if (entry.file !== "geoip.dat" && entry.file !== "geosite.dat") {
    throw new GeoChecksumError(`Refusing output name ${entry.file}.`);
  }
  for (const value of [entry.url, entry.sha256Url]) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") {
      throw new GeoChecksumError("Geo dataset URL must be https://github.com.");
    }
    const prefix = `/${entry.project}/releases/download/${entry.tag}/`;
    if (!url.pathname.startsWith(prefix)) throw new GeoChecksumError("Geo dataset URL is not the locked v2fly release.");
  }
  const assetUrl = new URL(entry.url);
  const sumUrl = new URL(entry.sha256Url);
  if (assetUrl.pathname !== `/${entry.project}/releases/download/${entry.tag}/${entry.asset}`) {
    throw new GeoChecksumError("Geo dataset asset URL does not match the lockfile.");
  }
  if (!sumUrl.pathname.endsWith(`/${entry.checksumAsset}`) || !entry.checksumAsset.endsWith(".sha256sum")) {
    throw new GeoChecksumError("Geo dataset checksum must be the official .sha256sum asset.");
  }
}

async function fetchBytes(url: string, asset: string): Promise<Uint8Array> {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(120_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new GeoChecksumError(`Geo download for ${asset} returned an empty redirect.`);
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !allowedDownloadHost(next.hostname)) {
        throw new GeoChecksumError(`Geo download for ${asset} redirected to ${next.hostname}, which is not allowed.`);
      }
      current = next.href;
      continue;
    }
    if (!response.ok) throw new GeoChecksumError(`Geo download for ${asset} failed (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new GeoChecksumError(`Geo download for ${asset} is larger than the allowed size.`);
    return bytes;
  }
  throw new GeoChecksumError(`Geo download for ${asset} followed too many redirects.`);
}

export async function readLock(file = path.join(repoRoot(), "geo", "geo.lock.json")): Promise<GeoLock> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as GeoLock;
  if (parsed.source !== "v2fly" || !Array.isArray(parsed.datasets) || parsed.datasets.length === 0) {
    throw new GeoChecksumError("Geo lockfile is not a v2fly dataset list.");
  }
  for (const entry of parsed.datasets) assertV2flyEntry(entry);
  return parsed;
}

export async function fetchGeoDatasets(options?: { lock?: GeoLock; outDir?: string; fetchBytes?: (url: string, asset: string) => Promise<Uint8Array> }): Promise<string[]> {
  const lock = options?.lock ?? (await readLock());
  const outDir = options?.outDir ?? defaultGeoPaths().dataDir;
  const download = options?.fetchBytes ?? fetchBytes;
  await mkdir(outDir, { recursive: true });
  const saved: string[] = [];
  for (const entry of lock.datasets) {
    assertV2flyEntry(entry);
    const official = new TextDecoder().decode(await download(entry.sha256Url, entry.checksumAsset));
    const parsed = parseSha256Sum(official, entry.asset);
    if (parsed !== entry.sha256.toLowerCase()) {
      throw new GeoChecksumError(
        [
          `Checksum mismatch for ${entry.asset}.`,
          `Official sha256sum: ${parsed}`,
          `Lockfile sha256: ${entry.sha256.toLowerCase()}`,
          "The file was not saved.",
        ].join("\n"),
      );
    }
    const bytes = await download(entry.url, entry.asset);
    assertChecksum({ asset: entry.asset, officialText: official, lockHash: entry.sha256, bytes });
    const finalPath = path.join(outDir, entry.file);
    const partial = `${finalPath}.partial`;
    await writeFile(partial, bytes);
    await rename(partial, finalPath);
    saved.push(finalPath);
  }
  return saved;
}

async function main(): Promise<void> {
  try {
    const saved = await fetchGeoDatasets();
    for (const file of saved) console.log(`Verified and saved ${file}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geo download failed.";
    console.error(message);
    const outDir = defaultGeoPaths().dataDir;
    await rm(path.join(outDir, "geoip.dat.partial"), { force: true });
    await rm(path.join(outDir, "geosite.dat.partial"), { force: true });
    process.exitCode = 1;
  }
}

function runningThisFile(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (runningThisFile()) void main();
