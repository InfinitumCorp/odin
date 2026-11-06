# ODIN°™

Exercise backend for ODIN°™, the Infinitum Corporation® command suite.

It runs one simulated picture — Exercise NORTHLANTERN — through Observe, Orient, Decide and Act. A private Firmament Network™ ledger signs every sighting, draft, approval and message. Mission data is not written to the public nexus, there is no public token, and nothing is offered for sale.

This is a simulation. It is not for operational use. It does not model weapons release. An analyst may draft a course. Only the commander can approve one.

## What the backend does

- Files a field note through [HRVST]™. The note is stored at the filer's clearance.
- Answers plain questions from that picture.
- Drafts courses with SCALVS.ai™. Tasks them with :\ARCHITECT\\™ only after commander approval. A rejection reopens the situation. Finishing the tasks updates the picture.
- Records the chain of custody on a private, permissioned, Ed25519-signed hash chain.
- Holds FABRIC™ messages while the east relay is degraded, and releases them when that course is finished.
- Projects the picture into three public shapes: an ontology object, a Lattice entity, and a launch record. There is no live connection to those companies.
- Reads E(O)N™ MIL emitter fixes, read only. See [E(O)N™ MIL feed](#eon-mil-feed).
- Speaks the :\ARCHITECT\\™ action contract from InfinitumCorp/architect. An approval composes a rehearsal score. Architect cannot approve, send, or task itself.

## HTTP

| Method | Path | Body or query |
|---|---|---|
| GET | `/api/odin/health` | — |
| GET | `/api/odin/picture` | `?role=observer\|analyst\|commander` |
| GET | `/api/odin/feeds` | `?role=` |
| GET | `/architect/v1/actions` | Architect action list |
| POST | `/architect/v1/actions/{name}` | `{ runId, payload }` |
| POST | `/api/odin/ask` | `{ role, question }` |
| POST | `/api/odin/courses` | `{ role }` |
| POST | `/api/odin/decisions` | `{ role, courseId, decision, note? }` |
| POST | `/api/odin/tasks` | `{ role, taskId, status }` |
| POST | `/api/odin/traffic` | `{ role, to, body }` |
| POST | `/api/odin/observations` | `{ role, note }` |

Roles are exercise clearances, not accounts. Observer is CUI. Analyst is SECRET. Commander is TS.

Every picture, and every result that carries one, has an `eon` field with the E(O)N™ feed state. Health reports it too.

## E(O)N™ MIL feed

ODIN°™ pulls `GET https://eon.infinitumcorp.workers.dev/api/eon/feed/odin` from the server side and merges the located emitters into the picture. ODIN°™ never writes back to E(O)N™. Only emitter fixes leave E(O)N™; wearer positions, device health, EMCON and engagements do not.

- Tracks keep their `eon-` ids and `source` "E(O)N™". Rows without the `eon-` prefix are dropped, and an E(O)N™ row never replaces an ODIN°™ track.
- Every E(O)N™ fix enters the picture as CUI, so every role sees it.
- `grid` is in E(O)N™'s QUIETFIELD frame, in metres. It is shown as given and labelled with that frame. It is not mapped onto the ODIN°™ range grid.
- `eon` on the picture: `state` (`connected`, `not-configured`, `down`, `bad-feed`), `connected`, `tick`, `generatedAt`, `frame`, `tracks`, `checkedAt`, `line`. The console's Movement section shows where the tracks came from and the E(O)N™ tick.
- One pull at most every 10 seconds per isolate. A pull that takes longer than 4 seconds is dropped.

The E(O)N™ site is behind Cloudflare Access. Set an Access service token as Worker secrets:

```bash
npx wrangler secret put EON_ACCESS_CLIENT_ID
```

```bash
npx wrangler secret put EON_ACCESS_CLIENT_SECRET
```

`EON_FEED_URL` overrides the feed URL. With no token, or if the feed is down or sends bad JSON, the picture still works and says the E(O)N™ feed is not connected. The TanStack server functions read the same names from `process.env`. Never commit the token.

## Handoff

[handoff/](handoff/README.md) is a record of this backend for another model. It is not the running service. Import `brief`, `WORK`, `API`, and `RULES` from `handoff/odin_work.ts`, `handoff/odin_work.js`, or `handoff/odin_work.py`.

## Tests

```bash
npm test
```

## Cloudflare

- Project name: `odin`
- Config: `wrangler.toml`
- Worker entry: `src/worker.ts`
- Deploy, once a Cloudflare API token is available:

```bash
npx wrangler deploy
```

Secrets are set with `wrangler secret put`. None are required for the exercise. `EON_ACCESS_CLIENT_ID` and `EON_ACCESS_CLIENT_SECRET` connect the E(O)N™ MIL feed. Do not commit tokens.

The console in this repository talks to the same service. Publishing the console from the Grok preview uses the platform host; the Worker is the API host named above.
