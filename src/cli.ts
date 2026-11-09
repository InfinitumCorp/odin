import { realpathSync } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultGeoPaths, effectiveGeoRouting, parseGeoSwitch, readGeoRouting, writeGeoRouting, type GeoPaths } from "./lib/geo/settings.ts";

/**
 * ODIN°™ geo routing switch.
 * There is no settings screen, so the choice is a config file plus this flag.
 *   node --experimental-strip-types src/cli.ts --geo on
 *   node --experimental-strip-types src/cli.ts --geo off
 *   node --experimental-strip-types src/cli.ts --geo status
 */

async function present(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function runGeoCli(argv: string[], paths?: Partial<GeoPaths>): Promise<{ code: number; text: string }> {
  let requested: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--geo" || arg === "--geo-routing") {
      requested = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--geo=")) {
      requested = arg.slice("--geo=".length);
    } else if (arg === "--help" || arg === "-h") {
      return {
        code: 0,
        text: "Usage: --geo on|off|status\nGeo routing is off unless this switch or INFINITUM_GEO_ENABLED turns it on.\n",
      };
    } else {
      return { code: 1, text: `Unknown argument ${arg}. Use --geo on, --geo off, or --geo status.\n` };
    }
  }

  if (requested && requested !== "status") {
    const text = requested.trim().toLowerCase();
    if (text !== "on" && text !== "off" && text !== "1" && text !== "0" && text !== "true" && text !== "false") {
      return { code: 1, text: "Use --geo on or --geo off.\n" };
    }
    await writeGeoRouting(parseGeoSwitch(text) === true, paths?.settingsPath);
  }

  const saved = await readGeoRouting(paths);
  const effective = await effectiveGeoRouting(paths);
  const env = paths && "env" in paths ? paths.env : process.env.INFINITUM_GEO_ENABLED;
  const dataDir = paths?.dataDir;
  const lines = [
    `Geo routing is ${effective ? "on" : "off"}.`,
    `Saved setting: ${saved ? "on" : "off"}.`,
    `Override INFINITUM_GEO_ENABLED: ${env && env.trim() ? env.trim() : "unset"}.`,
  ];
  if (dataDir) {
    const geoip = await present(path.join(dataDir, "geoip.dat"));
    const geosite = await present(path.join(dataDir, "geosite.dat"));
    lines.push(`Datasets: geoip.dat ${geoip ? "present" : "missing"}, geosite.dat ${geosite ? "present" : "missing"}.`);
  }
  return { code: 0, text: `${lines.join("\n")}\n` };
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

if (runningThisFile()) {
  const result = await runGeoCli(process.argv.slice(2), defaultGeoPaths());
  if (result.code === 0) process.stdout.write(result.text);
  else process.stderr.write(result.text);
  process.exitCode = result.code;
}
