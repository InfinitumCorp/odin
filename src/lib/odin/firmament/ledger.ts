import { canonicalize, sha256Hex } from "./canonical.ts";
import { type Signer, verifySignature } from "./keys.ts";
import { merkleRoot } from "./merkle.ts";
import { type LedgerStore, MemoryStore } from "./store.ts";

/**
 * Private ODIN° instance of the Firmament ledger.
 * Mission records stay here. They are not written to the public nexus.
 */
export type RecordType =
  | "identity"
  | "grant"
  | "revoke"
  | "provenance"
  | "license"
  | "payment"
  | "audit"
  | "attestation";

export interface RecordInput {
  type: RecordType;
  product: string;
  actor: string;
  subject: string;
  payload: Record<string, unknown>;
}

export interface Entry extends RecordInput {
  seq: number;
  prevHash: string;
  timestamp: string;
  signer: string;
  hash: string;
  signature: string;
}

export interface VerifyResult {
  ok: boolean;
  length: number;
  brokenAt?: number;
  reason?: string;
}

export const GENESIS = "0".repeat(64);

function entryBody(e: Omit<Entry, "hash" | "signature">) {
  const { seq, prevHash, timestamp, signer, type, product, actor, subject, payload } = e;
  return canonicalize({ seq, prevHash, timestamp, signer, type, product, actor, subject, payload });
}

export class Ledger {
  private readonly authorized: Set<string>;
  private readonly store: LedgerStore;
  private readonly clock: () => Date;

  constructor(
    store: LedgerStore = new MemoryStore(),
    options: { authorizedSigners?: string[]; clock?: () => Date } = {},
  ) {
    this.store = store;
    this.authorized = new Set(options.authorizedSigners ?? []);
    this.clock = options.clock ?? (() => new Date());
  }

  authorize(publicKey: string) {
    this.authorized.add(publicKey);
  }

  async append(input: RecordInput, signer: Signer): Promise<Entry> {
    if (this.authorized.size > 0 && !this.authorized.has(signer.publicKey)) {
      throw new Error("Firmament: signer is not authorized to write to this ledger");
    }
    const head = await this.store.last();
    const unsigned = {
      ...input,
      seq: head ? head.seq + 1 : 0,
      prevHash: head ? head.hash : GENESIS,
      timestamp: this.clock().toISOString(),
      signer: signer.publicKey,
    };
    const body = entryBody(unsigned);
    const hash = sha256Hex(body);
    const entry: Entry = { ...unsigned, hash, signature: signer.sign(hash) };
    await this.store.append(entry);
    return entry;
  }

  async entries(): Promise<Entry[]> {
    return this.store.all();
  }

  async query(filter: Partial<Pick<Entry, "type" | "product" | "actor" | "subject">>): Promise<Entry[]> {
    return (await this.store.all()).filter((e) =>
      (Object.keys(filter) as (keyof typeof filter)[]).every((k) => e[k] === filter[k]),
    );
  }

  async verify(): Promise<VerifyResult> {
    const all = await this.store.all();
    let prev = GENESIS;
    for (let i = 0; i < all.length; i++) {
      const e = all[i]!;
      const fail = (reason: string): VerifyResult => ({ ok: false, length: all.length, brokenAt: i, reason });
      if (e.seq !== i) return fail("sequence gap or reorder");
      if (e.prevHash !== prev) return fail("chain link broken");
      const { hash, signature, ...rest } = e;
      if (sha256Hex(entryBody(rest)) !== hash) return fail("entry contents altered");
      if (!verifySignature(e.signer, hash, signature)) return fail("invalid signature");
      if (this.authorized.size > 0 && !this.authorized.has(e.signer)) return fail("unauthorized signer");
      prev = hash;
    }
    return { ok: true, length: all.length };
  }

  async root(): Promise<string> {
    return merkleRoot((await this.store.all()).map((e) => e.hash));
  }
}
