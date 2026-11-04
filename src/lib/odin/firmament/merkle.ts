import { sha256Hex } from "./canonical.ts";

export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return sha256Hex("");
  let level = hashes.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(sha256Hex(`${left}${right}`));
    }
    level = next;
  }
  return level[0]!;
}
