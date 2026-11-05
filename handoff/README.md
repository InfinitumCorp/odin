# Handoff

A record of the ODIN°™ exercise backend. It is not the running service. The service is `src/lib/odin/`.

This is a simulation. It is not for operational use. It does not model weapons release.

The service commit this record describes is `62031df`.

## TypeScript

```ts
import { brief, WORK, API, RULES, COURSES } from "./odin_work.ts";

console.log(brief());
```

## JavaScript

Same exports, already compiled. Use this if the TypeScript file will not import.

```js
import { brief, WORK, API, RULES } from "./odin_work.js";

console.log(brief());
```

## Python

```python
from odin_work import brief, WORK, API, RULES

print(brief())
```

`WORK` is what was built and what was not. `API` is the HTTP contract. `COURSES` is what a finished course changes on the picture. `RULES` states the limit: fictional exercise, no weapons release, private ledger, Cloudflare not deployed.
