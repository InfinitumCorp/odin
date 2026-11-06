"""Handoff of the ODIN° exercise backend built in this session.

Import it:

    from odin_work import brief, WORK, API, RULES

This is a record of what was written. It is not the running service.
The service is TypeScript, in the private repo below. This file does
not model weapons, targeting, or real locations.
"""

from __future__ import annotations

REPO = "https://github.com/InfinitumCorp/odin"
HEAD = "eb7f110"
EXERCISE = "NORTHLANTERN"
PRODUCT = "ODIN°™"

# Observer reads CUI. Analyst reads SECRET. Commander reads TS.
# These are exercise labels, not accounts and not real clearances.
ROLES = {
    "observer": {"clearance": 1, "name": "CUI", "actor": "CID-EX-OBSERVER"},
    "analyst": {"clearance": 2, "name": "SECRET", "actor": "CID-EX-ANALYST"},
    "commander": {"clearance": 3, "name": "TS", "actor": "CID-EX-COMMANDER"},
}

RULES = {
    "what_it_is": (
        "A simulated command picture for one fictional range exercise. "
        "Observe, Orient, Decide, Act. Private ledger. Human approval."
    ),
    "not_for_operational_use": True,
    "no_weapons_release": True,
    "no_real_locations": True,
    "no_public_token": True,
    "no_data_sale": True,
    "mission_data_stays_off_the_public_nexus": True,
    "omitted": ["#THRONE"],
    "approval": "An analyst may draft. Only the commander may approve or reject.",
    "eon_feed": "ODIN° reads E(O)N™ MIL emitter fixes only. It never writes back. Wearer positions, health, EMCON and engagements do not leave E(O)N™.",
    "host_named_in_BUILD_RULES": "Cloudflare Workers, project name odin",
    "host_actually_deployed": (
        "Not deployed. wrangler.toml and src/worker.ts are in the repo. "
        "No Cloudflare API token was available."
    ),
}

COMMITS = [
    {
        "sha": "f58e0fb",
        "did": "First push of the exercise backend and the white console.",
    },
    {
        "sha": "9c596b2",
        "did": "Field notes. [HRVST]™ writes a note at the filer's clearance.",
    },
    {
        "sha": "4b72a4a",
        "did": "Finishing every task in an approved course updates the picture.",
    },
    {
        "sha": "62031df",
        "did": "FABRIC™ holds messages while the east relay is degraded.",
    },
    {
        "sha": "eb7f110",
        "did": "E(O)N™ MIL emitter fixes join the picture as CUI, read only.",
    },
]

FILES = {
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
}

API = [
    {"method": "GET", "path": "/api/odin/health", "body": None},
    {"method": "GET", "path": "/api/odin/picture", "body": "query role"},
    {"method": "GET", "path": "/api/odin/ledger", "body": "query role"},
    {"method": "POST", "path": "/api/odin/ask", "body": {"role": "", "question": ""}},
    {"method": "POST", "path": "/api/odin/courses", "body": {"role": ""}},
    {
        "method": "POST",
        "path": "/api/odin/decisions",
        "body": {"role": "", "courseId": "", "decision": "approve|reject", "note": "optional"},
    },
    {
        "method": "POST",
        "path": "/api/odin/tasks",
        "body": {"role": "", "taskId": "", "status": "in-progress|done"},
    },
    {"method": "POST", "path": "/api/odin/traffic", "body": {"role": "", "to": "", "body": ""}},
    {"method": "POST", "path": "/api/odin/observations", "body": {"role": "", "note": ""}},
]

# Sixteen product names on the picture, in layer order.
# Wordmarks keep the mark. Do not rename them.
SYSTEMS = [
    {"id": "argus", "name": ">_ARGUS™", "layer": "Observe"},
    {"id": "pollen", "name": "POLLEN™", "layer": "Observe"},
    {"id": "flower", "name": "Flower™", "layer": "Observe"},
    {"id": "orbis", "name": "ORBIS™", "layer": "Observe"},
    {"id": "nemesis", "name": "NEMESIS™", "layer": "Observe"},
    {"id": "hrvst", "name": "[HRVST]™", "layer": "Observe"},
    {"id": "spectre", "name": "+SPCTR™", "layer": "Orient"},
    {"id": "eidetic", "name": "ei·det·ic™", "layer": "Orient"},
    {"id": "metatron", "name": "METATRON™", "layer": "Orient"},
    {"id": "scalvs", "name": "SCALVS.ai™", "layer": "Decide"},
    {"id": "architect", "name": ":\\ARCHITECT\\™", "layer": "Decide"},
    {"id": "aether", "name": "ÆTHER™ MIL", "layer": "Act"},
    {"id": "fabric", "name": "FABRIC™", "layer": "Act"},
    {"id": "eon", "name": "E(O)N™", "layer": "Act"},
    {"id": "cumulus", "name": "Cumulus://Cloud™", "layer": "Foundation"},
    {"id": "firmament", "name": "Firmament Network™", "layer": "Foundation"},
]

# What an approved, fully completed course does to the picture.
COURSES = [
    {
        "alert": "alt-mesh",
        "title": "Restore the east relay",
        "opens": "At start. Classification CUI.",
        "when_done": "ÆTHER™ MIL returns to nominal. Held FABRIC™ messages are released.",
    },
    {
        "alert": "alt-liaison",
        "title": "Check in with Harbor Civil",
        "opens": "At start. Classification SECRET.",
        "when_done": "Harbor Civil becomes Current. A FABRIC™ reply arrives. No mission data is attached.",
    },
    {
        "alert": "alt-depot",
        "title": "Hold the depot resupply",
        "opens": "After the unrostered vehicle passes grid x 62.",
        "when_done": "The vehicle stops and is watched. The roster truck stays off the road. Nobody approaches.",
    },
    {
        "alert": "alt-gap",
        "title": "Close the ridge gap",
        "opens": "After POLLEN™ Alpha drifts north of grid y 30.",
        "when_done": "The pollen note says Bravo is covering the ridge.",
    },
    {
        "alert": "alt-flower",
        "title": "Rest Flower™ bay 3",
        "opens": "After the bay thermal value passes 72.",
        "when_done": "Bay 3 is marked offline. Cool bays stay open.",
    },
]

LEDGER = {
    "class": "Ledger",
    "store": "MemoryStore",
    "signature": "Ed25519",
    "hash": "SHA-256 over canonical JSON",
    "genesis": "0" * 64,
    "types_used": ["audit", "grant", "identity", "provenance", "attestation"],
    "types_defined_but_unused": ["revoke", "license", "payment"],
    "signers": ["system", "observer", "analyst", "commander"],
    "redaction": "A reader below the entry's clearance gets the hash and a null summary.",
    "verify": "Replays prevHash, hash, and signature. Health reports ledger.ok.",
}

WORK = [
    {
        "name": "Exercise picture",
        "done": True,
        "detail": (
            "One in-memory world. Tracks move. Alerts appear on a clock. "
            "Each role receives the same picture with anything above its "
            "clearance replaced by a withheld row."
        ),
    },
    {
        "name": "Ask the picture",
        "done": True,
        "detail": (
            "Plain questions about the depot, the ridge, Flower™, Harbor Civil, "
            "the mesh, identity, the ledger, or approval. Answers come from the "
            "world. They do not invent a weapon or an approach order."
        ),
    },
    {
        "name": "Field notes",
        "done": True,
        "detail": (
            "POST /api/odin/observations. [HRVST]™ files the note at the "
            "filer's clearance and writes a provenance entry. A lower role "
            "sees only that a note was withheld."
        ),
    },
    {
        "name": "Draft, approve, task",
        "done": True,
        "detail": (
            "SCALVS.ai™ drafts one course per open situation. An analyst "
            "cannot approve. The commander approves or rejects. Approval "
            "creates tasks through :\\ARCHITECT\\™. Rejection writes an audit entry "
            "and creates no tasks."
        ),
    },
    {
        "name": "Finish a course",
        "done": True,
        "detail": (
            "When every task on a course is done, the course status becomes "
            "complete and the picture changes. See COURSES."
        ),
    },
    {
        "name": "Contested traffic",
        "done": True,
        "detail": (
            "While ÆTHER™ MIL is degraded, a FABRIC™ message is stored with "
            "held=true. An observer cannot send. Restoring the east relay "
            "clears held on every waiting message. Later messages are not held."
        ),
    },
    {
        "name": "Private ledger",
        "done": True,
        "detail": (
            "Firmament-shaped entries: seq, prevHash, timestamp, signer, "
            "type, product, actor, subject, payload, hash, signature. "
            "The chain is checked on health and on every picture."
        ),
    },
    {
        "name": "Console",
        "done": True,
        "detail": (
            "White page, Helvetica stack, one column. Three views: Picture, "
            "Decide, Record. Role switcher. Field note, course buttons, "
            "task buttons, and a FABRIC™ send box. Withheld rows stay visible "
            "as withheld."
        ),
    },
    {
        "name": "Reject and redraft",
        "done": True,
        "detail": (
            "A commander rejection is stored on the course and the ledger. "
            "The situation opens again, so an analyst can draft another course. "
            "The refused course stays on the picture."
        ),
    },
    {
        "name": "Public feed shapes",
        "done": True,
        "detail": (
            "The picture is also readable as an ontology object, a Lattice entity, "
            "and a launch record. No live connection. No weapons release. "
            "SpaceX's own GitHub org has no launch SDK; the launch fields follow the public v4 record."
        ),
    },
    {
        "name": "E(O)N™ MIL emitter feed",
        "done": True,
        "detail": (
            "ODIN° reads GET https://eon.infinitumcorp.workers.dev/api/eon/feed/odin with a Cloudflare Access service token (EON_ACCESS_CLIENT_ID, EON_ACCESS_CLIENT_SECRET). It merges the eon- tracks into the picture as CUI, keeps the grid as given, and labels it with E(O)N™'s QUIETFIELD frame; there is no mapping to the ODIN° range grid. Every picture carries eon: state, tick, frame. A 4 second timeout, a 10 second cache. Feed down, bad JSON, or no token leaves the picture working and says the feed is not connected. ODIN° never writes back."
        ),
    },
    {
        "name": "Worker package",
        "done": False,
        "detail": (
            "wrangler.toml and src/worker.ts are written. Deploy was not run."
        ),
    },
    {
        "name": "Durable ledger",
        "done": False,
        "detail": "Memory only. A restart opens a new exercise.",
    },
    {
        "name": "E(O)N™ Access token",
        "done": False,
        "detail": "No Access service token was created and no Worker secret was set. Until then the picture says the E(O)N™ feed is not connected.",
    },
]

NOT_DONE = [item["name"] for item in WORK if not item["done"]]


def brief() -> str:
    """One page of text. Print this, or hand the string to another model."""
    lines = [
        f"{PRODUCT} exercise backend. {EXERCISE}.",
        REPO,
        f"HEAD {HEAD}.",
        "",
        RULES["what_it_is"],
        "Simulation only. Not for operational use. No weapons release.",
        "No public token. No data sale. Mission records stay on the private ledger.",
        "",
        "Done:",
    ]
    for item in WORK:
        mark = "yes" if item["done"] else "no"
        lines.append(f"- [{mark}] {item['name']}. {item['detail']}")
    lines.append("")
    lines.append("HTTP:")
    for route in API:
        lines.append(f"- {route['method']} {route['path']}")
    lines.append("")
    lines.append("Roles: observer CUI, analyst SECRET, commander TS.")
    lines.append("An analyst drafts. Only the commander approves.")
    return "\n".join(lines)


if __name__ == "__main__":
    print(brief())
