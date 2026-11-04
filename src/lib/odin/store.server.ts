import { createOdin, type OdinService } from "./service.ts";

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
