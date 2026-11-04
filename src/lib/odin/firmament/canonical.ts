import { createHash, randomBytes } from "node:crypto";

/** Deterministic JSON: object keys sorted at every level, so the same record always hashes the same. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Firmament: non-finite numbers cannot be recorded");
    }
    if (value === undefined) throw new Error("Firmament: undefined cannot be recorded");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Salted digest. The private source stays off the ledger; the holder keeps data + salt. */
export function commit(data: unknown, salt = randomBytes(16).toString("hex")) {
  return { digest: sha256Hex(`${salt}:${canonicalize(data)}`), salt };
}

export function verifyCommitment(data: unknown, salt: string, digest: string): boolean {
  return sha256Hex(`${salt}:${canonicalize(data)}`) === digest;
}
