import type { Entry } from "./ledger.ts";

export interface LedgerStore {
  last(): Promise<Entry | undefined>;
  append(entry: Entry): Promise<void>;
  all(): Promise<Entry[]>;
}

/** Process-local store. The ODIN° private ledger is not the public nexus. */
export class MemoryStore implements LedgerStore {
  private rows: Entry[] = [];

  async last() {
    return this.rows[this.rows.length - 1];
  }

  async append(entry: Entry) {
    this.rows.push(entry);
  }

  async all() {
    return this.rows.slice();
  }
}
