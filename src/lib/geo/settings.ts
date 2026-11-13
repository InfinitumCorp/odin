import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Geo routing stays off unless an operator turns it on.
 * INFINITUM_GEO_ENABLED overrides the saved file for one process.
 * The saved choice lives in data/settings.json, which is not committed.
 * config/odin.json is the shipped default and stays false.
 */

export interface GeoPaths {
  settingsPath: string;
  configPath: string;
  dataDir: string;
  env?: string;
}

let forced = false;
let forcedEnv: string | undefined;

export function repoRoot(): string {
  return fileURLToPath(new URL("../../../", import.meta.url));
}

export function defaultGeoPaths(): GeoPaths {
  const root = repoRoot();
  return {
    settingsPath: path.join(root, "data", "settings.json"),
    configPath: path.join(root, "config", "odin.json"),
    dataDir: path.join(root, "data", "geo"),
  };
}

/** Worker binding. An empty value clears a previous binding. Undefined leaves the process env alone. */
export function noteGeoEnv(value: string | undefined): void {
  if (value === undefined) return;
  const trimmed = value.trim();
  if (!trimmed) {
    forced = false;
    forcedEnv = undefined;
    return;
  }
  forced = true;
  forcedEnv = trimmed;
}

export function currentGeoEnv(): string | undefined {
  if (forced) return forcedEnv;
  const value = process.env.INFINITUM_GEO_ENABLED;
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function resetGeoEnvForTests(): void {
  forced = false;
  forcedEnv = undefined;
}

/** Parse a switch. Null means unset. Unknown text fails closed. */
export function parseGeoSwitch(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text === "1" || text === "true" || text === "on" || text === "yes") return true;
  if (text === "0" || text === "false" || text === "off" || text === "no") return false;
  return false;
}

export function resolveGeoEnabled(env: string | undefined, persisted: boolean): boolean {
  const parsed = parseGeoSwitch(env);
  return parsed === null ? persisted : parsed;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

async function readFlag(file: string): Promise<boolean | null> {
  const { readFile } = await import("node:fs/promises");
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    return null;
  }
  try {
    const parsed = JSON.parse(text) as { geoRouting?: unknown };
    return typeof parsed.geoRouting === "boolean" ? parsed.geoRouting : null;
  } catch {
    return null;
  }
}

/** Local saved choice, then the shipped config, then off. */
export async function readGeoRouting(paths?: Partial<GeoPaths>): Promise<boolean> {
  const defaults = defaultGeoPaths();
  const local = await readFlag(paths?.settingsPath ?? defaults.settingsPath);
  if (local !== null) return local;
  const configured = await readFlag(paths?.configPath ?? defaults.configPath);
  return configured ?? false;
}

export async function writeGeoRouting(enabled: boolean, settingsPath?: string): Promise<void> {
  const file = settingsPath ?? defaultGeoPaths().settingsPath;
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ geoRouting: enabled }, null, 2)}\n`, "utf8");
}

export async function effectiveGeoRouting(paths?: Partial<GeoPaths>): Promise<boolean> {
  const env = paths && "env" in paths ? paths.env : currentGeoEnv();
  return resolveGeoEnabled(env, await readGeoRouting(paths));
}
