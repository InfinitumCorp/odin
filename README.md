# ODIN°™

Exercise backend for ODIN°™, the Infinitum Corporation® command suite.

It runs one simulated picture — Exercise NORTHLANTERN — through Observe, Orient, Decide and Act. A private Firmament Network™ ledger signs every sighting, draft, approval and message. Mission data is not written to the public nexus, there is no public token, and nothing is offered for sale.

This is a simulation. It is not for operational use. It does not model weapons release. An analyst may draft a course. Only the commander can approve one.

## What the backend does

- Files a field note through [HRVST]™. The note is stored at the filer's clearance.
- Answers plain questions from that picture.
- Drafts courses with SCALVS.ai™. Tasks them with /CNDCTR/™ only after commander approval. Finishing the tasks updates the picture.
- Records the chain of custody on a private, permissioned, Ed25519-signed hash chain.
- Holds FABRIC™ messages while the east relay is degraded, and releases them when that course is finished.

## HTTP

| Method | Path | Body or query |
|---|---|---|
| GET | `/api/odin/health` | — |
| GET | `/api/odin/picture` | `?role=observer\|analyst\|commander` |
| GET | `/api/odin/ledger` | `?role=` |
| POST | `/api/odin/ask` | `{ role, question }` |
| POST | `/api/odin/courses` | `{ role }` |
| POST | `/api/odin/decisions` | `{ role, courseId, decision, note? }` |
| POST | `/api/odin/tasks` | `{ role, taskId, status }` |
| POST | `/api/odin/traffic` | `{ role, to, body }` |
| POST | `/api/odin/observations` | `{ role, note }` |

Roles are exercise clearances, not accounts. Observer is CUI. Analyst is SECRET. Commander is TS.

## Handoff

[handoff/](handoff/README.md) is a record of this backend for another model. It is not the running service. Import `brief`, `WORK`, `API`, and `RULES` from `handoff/odin_work.ts`, `handoff/odin_work.js`, or `handoff/odin_work.py`.

## Tests

```bash
node --experimental-strip-types --test src/lib/odin/service.test.ts
```

## Cloudflare

- Project name: `odin`
- Config: `wrangler.toml`
- Worker entry: `src/worker.ts`
- Deploy, once a Cloudflare API token is available:

```bash
npx wrangler deploy
```

Secrets are set with `wrangler secret put`. None are required for the exercise. Do not commit tokens.

The console in this repository talks to the same service. Publishing the console from the Grok preview uses the platform host; the Worker is the API host named above.
