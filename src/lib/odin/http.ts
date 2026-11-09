import { ZodError } from "zod";
import { askSchema, decideSchema, draftSchema, observationSchema, roleSchema, taskSchema, trafficSchema } from "./schemas.ts";
import { projectFeeds } from "./feeds.ts";
import { getEon, getOdin } from "./store.server.ts";
import { withEon, type EonEnv, type EonSource } from "./eon.ts";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function fail(error: unknown) {
  if (error instanceof ZodError) {
    return json({ ok: false, error: "The request is missing a role or a required field." }, 400);
  }
  const message = error instanceof Error ? error.message : "The exercise backend failed.";
  return json({ ok: false, error: message }, 500);
}

/**
 * HTTP contract for the ODIN° exercise backend.
 * GET  /api/odin/health
 * GET  /api/odin/picture?role=observer|analyst|commander
 * GET  /api/odin/ledger?role=
 * POST /api/odin/ask        { role, question }
 * POST /api/odin/courses    { role }
 * POST /api/odin/decisions  { role, courseId, decision, note? }
 * POST /api/odin/tasks      { role, taskId, status }
 * POST /api/odin/traffic      { role, to, body }
 * POST /api/odin/observations { role, note }
 *
 * Every picture carries the read-only E(O)N™ MIL feed status in `eon`.
 */
export async function handleOdinRequest(
  request: Request,
  splat: string,
  options: { env?: EonEnv; eon?: EonSource } = {},
): Promise<Response> {
  const path = splat.replace(/^\/+|\/+$/g, "");
  const url = new URL(request.url);
  try {
    const odin = await getOdin();
    const eon = options.eon ?? getEon(options.env);
    if (request.method === "GET" && (path === "health" || path === "")) {
      const verify = await odin.verify();
      return json({
        ok: verify.ok,
        product: "ODIN°",
        exercise: "NORTHLANTERN",
        ledger: verify,
        eon: (await eon.get()).status,
        note: "Simulated exercise. Not for operational use. Private ledger. No data sale.",
      });
    }
    if (request.method === "GET" && path === "picture") {
      const role = roleSchema.parse(url.searchParams.get("role"));
      return json(await withEon(eon, await odin.picture(role)));
    }
    if (request.method === "GET" && path === "feeds") {
      const role = roleSchema.parse(url.searchParams.get("role"));
      return json(projectFeeds(await withEon(eon, await odin.picture(role))));
    }
    if (request.method === "GET" && path === "ledger") {
      const role = roleSchema.parse(url.searchParams.get("role"));
      const picture = await odin.picture(role);
      return json({
        ok: picture.ledgerOk,
        head: picture.ledgerHead,
        length: picture.ledgerLength,
        entries: picture.ledger,
      });
    }
    if (request.method !== "POST") return json({ ok: false, error: "Not found." }, 404);

    const body: unknown = await request.json().catch(() => ({}));
    if (path === "ask") {
      const data = askSchema.parse(body);
      return json(await withEon(eon, await odin.ask(data.role, data.question)));
    }
    if (path === "courses") {
      const data = draftSchema.parse(body);
      const result = await withEon(eon, await odin.draft(data.role));
      return json(result, result.ok ? 200 : 403);
    }
    if (path === "decisions") {
      const data = decideSchema.parse(body);
      const result = await withEon(eon, await odin.decide(data.role, data.courseId, data.decision, data.note));
      return json(result, result.ok ? 200 : 403);
    }
    if (path === "tasks") {
      const data = taskSchema.parse(body);
      const result = await withEon(eon, await odin.advanceTask(data.role, data.taskId, data.status));
      return json(result, result.ok ? 200 : 403);
    }
    if (path === "traffic") {
      const data = trafficSchema.parse(body);
      const result = await withEon(eon, await odin.sendTraffic(data.role, data.to, data.body));
      return json(result, result.ok ? 200 : 403);
    }
    if (path === "observations") {
      const data = observationSchema.parse(body);
      return json(await withEon(eon, await odin.observe(data.role, data.note)));
    }
    return json({ ok: false, error: "Not found." }, 404);
  } catch (error) {
    return fail(error);
  }
}
