import { createOdin, type OdinService } from "./service.ts";
import { EonSource, type EonEnv } from "./eon.ts";

let booting: Promise<OdinService> | null = null;

export function getOdin(): Promise<OdinService> {
  if (!booting) {
    booting = createOdin().catch((error: unknown) => {
      booting = null;
      throw error;
    });
  }
  return booting;
}

let eon: EonSource | null = null;

/** One E(O)N™ source per isolate. Reads Worker env when given, else process.env. */
export function getEon(env?: EonEnv): EonSource {
  if (!eon) eon = new EonSource(env ? { env } : {});
  return eon;
}
