import path from "node:path";
import { loadGeoCatalog, type GeoCatalog } from "./dat.ts";
import { classifyText, type GeoAnnotation } from "./policy.ts";
import { defaultGeoPaths, effectiveGeoRouting, type GeoPaths } from "./settings.ts";

/**
 * Live geo routing reads the switch on every call and loads datasets once.
 * createOdin() does not use this. The exercise service stays on GEO_OFF
 * unless a caller passes a router, so a saved setting cannot change tests.
 */

export interface GeoRouter {
  annotate(text: string): Promise<GeoAnnotation | null>;
}

export const GEO_OFF: GeoRouter = {
  async annotate(): Promise<null> {
    return null;
  },
};

async function readOptional(file: string): Promise<Uint8Array | null> {
  const { readFile } = await import("node:fs/promises");
  try {
    return new Uint8Array(await readFile(file));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function createLiveGeoRouter(paths?: Partial<GeoPaths>): GeoRouter {
  const dataDir = paths?.dataDir ?? defaultGeoPaths().dataDir;
  let catalog: GeoCatalog | null = null;
  let loaded = false;

  async function dataset(): Promise<GeoCatalog | null> {
    if (loaded) return catalog;
    const geoip = await readOptional(path.join(dataDir, "geoip.dat"));
    const geosite = await readOptional(path.join(dataDir, "geosite.dat"));
    if (!geoip && !geosite) return null;
    catalog = loadGeoCatalog(geoip ?? new Uint8Array(), geosite ?? new Uint8Array());
    loaded = true;
    return catalog;
  }

  return {
    async annotate(text: string): Promise<GeoAnnotation | null> {
      if (!(await effectiveGeoRouting(paths))) return null;
      const ready = await dataset();
      if (!ready) return null;
      return classifyText(ready, text);
    },
  };
}
