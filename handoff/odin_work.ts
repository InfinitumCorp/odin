/**
 * Handoff of the ODIN° exercise backend built in this session.
 *
 * Import it:
 *
 *     import { brief, WORK, API, RULES } from "./odin_work.ts";
 *
 * This is a record of what was written. It is not the running service.
 * The service is the TypeScript in the private repo below. This file
 * does not model weapons, targeting, or real locations.
 */

export const REPO = "https://github.com/InfinitumCorp/odin";
export const HEAD = "eb7f110";
export const EXERCISE = "NORTHLANTERN";
export const PRODUCT = "ODIN°™";

export type RoleName = "observer" | "analyst" | "commander";
export type ClassName = "CUI" | "SECRET" | "TS";
export type ClassLevel = 1 | 2 | 3;

/** Exercise labels, not accounts and not real clearances. */
export const ROLES: Record<RoleName, { clearance: ClassLevel; name: ClassName; actor: string }> = {
  observer: { clearance: 1, name: "CUI", actor: "CID-EX-OBSERVER" },
  analyst: { clearance: 2, name: "SECRET", actor: "CID-EX-ANALYST" },
  commander: { clearance: 3, name: "TS", actor: "CID-EX-COMMANDER" },
};

export const RULES = {
  whatItIs:
    "A simulated command picture for one fictional range exercise. Observe, Orient, Decide, Act. Private ledger. Human approval.",
  notForOperationalUse: true,
  noWeaponsRelease: true,
  noRealLocations: true,
  noPublicToken: true,
  noDataSale: true,
  missionDataStaysOffThePublicNexus: true,
  omitted: ["#THRONE"],
  approval: "An analyst may draft. Only the commander may approve or reject.",
  eonFeed: "ODIN° reads E(O)N™ MIL emitter fixes only. It never writes back. Wearer positions, health, EMCON and engagements do not leave E(O)N™.",
  hostNamedInBuildRules: "Cloudflare Workers, project name odin",
  hostActuallyDeployed:
    "Not deployed. wrangler.toml and src/worker.ts are in the repo. No Cloudflare API token was available.",
} as const;

export const COMMITS = [
  { sha: "f58e0fb", did: "First push of the exercise backend and the white console." },
  { sha: "9c596b2", did: "Field notes. [HRVST]™ writes a note at the filer's clearance." },
  { sha: "4b72a4a", did: "Finishing every task in an approved course updates the picture." },
  { sha: "62031df", did: "FABRIC™ holds messages while the east relay is degraded." },
  { sha: "eb7f110", did: "E(O)N™ MIL emitter fixes join the picture as CUI, read only." },
] as const;

export const FILES = {
  "src/lib/odin/service.ts": "Exercise clock, picture, courses, tasks, traffic, notes.",
  "src/lib/odin/types.ts": "Roles, clearances, and the picture shape sent to the console.",
  "src/lib/odin/schemas.ts": "Zod checks for every write.",
  "src/lib/odin/http.ts": "HTTP adapter. Used by the TanStack route and the Worker.",
  "src/lib/odin/api.ts": "TanStack server functions. The console calls these.",
  "src/lib/odin/store.server.ts": "One process-local service. It is not durable.",
  "src/lib/odin/eon.ts": "Read-only E(O)N™ MIL feed pull. Timeout, cache, Access headers, CUI merge.",
  "src/lib/odin/eon.test.ts": "Fake E(O)N™ feed: connected, no token, down, timeout, Access refusal, bad JSON.",
  "src/lib/odin/service.test.ts": "Node test runner. Six tests, no network.",
  "src/lib/odin/firmament/ledger.ts": "Private hash chain. Ed25519. Not the public nexus.",
  "src/lib/odin/firmament/keys.ts": "Key generation and signature check.",
  "src/lib/odin/firmament/canonical.ts": "Canonical JSON and SHA-256 commitments.",
  "src/lib/odin/firmament/merkle.ts": "Merkle root over entry hashes.",
  "src/lib/odin/firmament/store.ts": "MemoryStore. Entries die with the process.",
  "src/routes/api/odin/$.ts": "Catch-all route /api/odin/*.",
  "src/worker.ts": "Cloudflare Worker entry. Same handleOdinRequest.",
  "src/components/odin-console.tsx": "White console. Picture, Decide, Record.",
  "wrangler.toml": "Worker name odin. nodejs_compat.",
  "README.md": "What the backend does and how to call it.",
} as const;

export type HttpMethod = "GET" | "POST";

export interface Route {
  method: HttpMethod;
  path: string;
  body: string | Record<string, string> | null;
}

export const API: readonly Route[] = [
  { method: "GET", path: "/api/odin/health", body: null },
  { method: "GET", path: "/api/odin/picture", body: "query role" },
  { method: "GET", path: "/api/odin/ledger", body: "query role" },
  { method: "POST", path: "/api/odin/ask", body: { role: "", question: "" } },
  { method: "POST", path: "/api/odin/courses", body: { role: "" } },
  {
    method: "POST",
    path: "/api/odin/decisions",
    body: { role: "", courseId: "", decision: "approve|reject", note: "optional" },
  },
  {
    method: "POST",
    path: "/api/odin/tasks",
    body: { role: "", taskId: "", status: "in-progress|done" },
  },
  { method: "POST", path: "/api/odin/traffic", body: { role: "", to: "", body: "" } },
  { method: "POST", path: "/api/odin/observations", body: { role: "", note: "" } },
];

/** Sixteen product names on the picture, in layer order. Do not rename the marks. */
export const SYSTEMS = [
  { id: "argus", name: ">_ARGUS™", layer: "Observe" },
  { id: "pollen", name: "POLLEN™", layer: "Observe" },
  { id: "flower", name: "Flower™", layer: "Observe" },
  { id: "orbis", name: "ORBIS™", layer: "Observe" },
  { id: "nemesis", name: "NEMESIS™", layer: "Observe" },
  { id: "hrvst", name: "[HRVST]™", layer: "Observe" },
  { id: "spectre", name: "+SPCTR™", layer: "Orient" },
  { id: "eidetic", name: "ei·det·ic™", layer: "Orient" },
  { id: "metatron", name: "METATRON™", layer: "Orient" },
  { id: "scalvs", name: "SCALVS.ai™", layer: "Decide" },
  { id: "architct", name: ":\\ARCHITECT\\™", layer: "Decide" },
  { id: "aether", name: "ÆTHER™ MIL", layer: "Act" },
  { id: "fabric", name: "FABRIC™", layer: "Act" },
  { id: "eon", name: "E(O)N™", layer: "Act" },
  { id: "cumulus", name: "Cumulus://Cloud™", layer: "Foundation" },
  { id: "firmament", name: "Firmament Network™", layer: "Foundation" },
] as const;

/** What an approved, fully completed course does to the picture. */
export const COURSES = [
  {
    alert: "alt-mesh",
    title: "Restore the east relay",
    opens: "At start. Classification CUI.",
    whenDone: "ÆTHER™ MIL returns to nominal. Held FABRIC™ messages are released.",
  },
  {
    alert: "alt-liaison",
    title: "Check in with Harbor Civil",
    opens: "At start. Classification SECRET.",
    whenDone: "Harbor Civil becomes Current. A FABRIC™ reply arrives. No mission data is attached.",
  },
  {
    alert: "alt-depot",
    title: "Hold the depot resupply",
    opens: "After the unrostered vehicle passes grid x 62.",
    whenDone: "The vehicle stops and is watched. The roster truck stays off the road. Nobody approaches.",
  },
  {
    alert: "alt-gap",
    title: "Close the ridge gap",
    opens: "After POLLEN™ Alpha drifts north of grid y 30.",
    whenDone: "The pollen note says Bravo is covering the ridge.",
  },
  {
    alert: "alt-flower",
    title: "Rest Flower™ bay 3",
    opens: "After the bay thermal value passes 72.",
    whenDone: "Bay 3 is marked offline. Cool bays stay open.",
  },
] as const;

export const LEDGER = {
  class: "Ledger",
  store: "MemoryStore",
  signature: "Ed25519",
  hash: "SHA-256 over canonical JSON",
  genesis: "0".repeat(64),
  typesUsed: ["audit", "grant", "identity", "provenance", "attestation"],
  typesDefinedButUnused: ["revoke", "license", "payment"],
  signers: ["system", "observer", "analyst", "commander"],
  redaction: "A reader below the entry's clearance gets the hash and a null summary.",
  verify: "Replays prevHash, hash, and signature. Health reports ledger.ok.",
} as const;

export interface WorkItem {
  name: string;
  done: boolean;
  detail: string;
}

export const WORK: readonly WorkItem[] = [
  {
    name: "Exercise picture",
    done: true,
    detail:
      "One in-memory world. Tracks move. Alerts appear on a clock. Each role receives the same picture with anything above its clearance replaced by a withheld row.",
  },
  {
    name: "Ask the picture",
    done: true,
    detail:
      "Plain questions about the depot, the ridge, Flower™, Harbor Civil, the mesh, identity, the ledger, or approval. Answers come from the world. They do not invent a weapon or an approach order.",
  },
  {
    name: "Field notes",
    done: true,
    detail:
      "POST /api/odin/observations. [HRVST]™ files the note at the filer's clearance and writes a provenance entry. A lower role sees only that a note was withheld.",
  },
  {
    name: "Draft, approve, task",
    done: true,
    detail:
      "SCALVS.ai™ drafts one course per open situation. An analyst cannot approve. The commander approves or rejects. Approval creates tasks through :\\ARCHITECT\\™. Rejection writes an audit entry and creates no tasks.",
  },
  {
    name: "Finish a course",
    done: true,
    detail: "When every task on a course is done, the course status becomes complete and the picture changes. See COURSES.",
  },
  {
    name: "Contested traffic",
    done: true,
    detail:
      "While ÆTHER™ MIL is degraded, a FABRIC™ message is stored with held=true. An observer cannot send. Restoring the east relay clears held on every waiting message. Later messages are not held.",
  },
  {
    name: "Private ledger",
    done: true,
    detail:
      "Firmament-shaped entries: seq, prevHash, timestamp, signer, type, product, actor, subject, payload, hash, signature. The chain is checked on health and on every picture.",
  },
  {
    name: "Console",
    done: true,
    detail:
      "White page, Helvetica stack, one column. Three views: Picture, Decide, Record. Role switcher. Field note, course buttons, task buttons, and a FABRIC™ send box. Withheld rows stay visible as withheld.",
  },
  {
    name: "Reject and redraft",
    done: true,
    detail:
      "A commander rejection is stored on the course and the ledger. The situation opens again, so an analyst can draft another course. The refused course stays on the picture.",
  },
  {
    name: "Public feed shapes",
    done: true,
    detail:
      "The picture is also readable as an ontology object, a Lattice entity, and a launch record. No live connection. No weapons release. SpaceX's own GitHub org has no launch SDK; the launch fields follow the public v4 record.",
  },
  {
    name: "E(O)N™ MIL emitter feed",
    done: true,
    detail:
      "ODIN° reads GET https://eon.infinitumcorp.workers.dev/api/eon/feed/odin with a Cloudflare Access service token (EON_ACCESS_CLIENT_ID, EON_ACCESS_CLIENT_SECRET). It merges the eon- tracks into the picture as CUI, keeps the grid as given, and labels it with E(O)N™'s QUIETFIELD frame; there is no mapping to the ODIN° range grid. Every picture carries eon: state, tick, frame. A 4 second timeout, a 10 second cache. Feed down, bad JSON, or no token leaves the picture working and says the feed is not connected. ODIN° never writes back.",
  },
  {
    name: "Worker package",
    done: false,
    detail: "wrangler.toml and src/worker.ts are written. Deploy was not run.",
  },
  {
    name: "Durable ledger",
    done: false,
    detail: "Memory only. A restart opens a new exercise.",
  },
  {
    name: "E(O)N™ Access token",
    done: false,
    detail: "No Access service token was created and no Worker secret was set. Until then the picture says the E(O)N™ feed is not connected.",
  },
];

export const NOT_DONE = WORK.filter((item) => !item.done).map((item) => item.name);

/** One page of text. Print this, or hand the string to another model. */
export function brief(): string {
  const lines = [
    `${PRODUCT} exercise backend. ${EXERCISE}.`,
    REPO,
    `HEAD ${HEAD}.`,
    "",
    RULES.whatItIs,
    "Simulation only. Not for operational use. No weapons release.",
    "No public token. No data sale. Mission records stay on the private ledger.",
    "",
    "Done:",
    ...WORK.map((item) => `- [${item.done ? "yes" : "no"}] ${item.name}. ${item.detail}`),
    "",
    "HTTP:",
    ...API.map((route) => `- ${route.method} ${route.path}`),
    "",
    "Roles: observer CUI, analyst SECRET, commander TS.",
    "An analyst drafts. Only the commander approves.",
  ];
  return lines.join("\n");
}

