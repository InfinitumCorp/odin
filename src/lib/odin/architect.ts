import { timingSafeEqual } from "node:crypto";
import { getOdin } from "./store.server.ts";

/**
 * The :\ARCHITECT\™ action contract, from InfinitumCorp/architect.
 * ODIN° can be played. It cannot approve a course, send a message, or release anything.
 *
 *   GET  /architect/v1/actions
 *   POST /architect/v1/actions/{name}   { runId, payload }
 *
 * /architct/v1 is still served as an alias for one release.
 */

export interface ArchitectAction {
  name: string;
  description: string;
  risk: "read" | "write";
}

export const ARCHITECT_ACTIONS: ArchitectAction[] = [
  { name: "read_picture", description: "Read the exercise picture for a role.", risk: "read" },
  { name: "ask_picture", description: "Ask the exercise picture a question.", risk: "read" },
  { name: "list_courses", description: "List the courses visible to a role.", risk: "read" },
  { name: "file_note", description: "File a field note. It is not a course and it is not tasked.", risk: "write" },
  { name: "draft_courses", description: "Draft courses for the commander. Nothing is tasked.", risk: "write" },
];

const ROLES = new Set(["observer", "analyst", "commander"]);

function roleOf(payload: Record<string, unknown>) {
  const role = String(payload.role ?? "analyst");
  return ROLES.has(role) ? (role as "observer" | "analyst" | "commander") : null;
}

function authorized(request: Request) {
  // ARCHITCT_PRODUCT_TOKEN is the previous name, still read for one release.
  const token = process.env.ARCHITECT_PRODUCT_TOKEN ?? process.env.ARCHITCT_PRODUCT_TOKEN;
  if (!token) return false;
  const got = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function handleArchitectRequest(request: Request, action: string): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "invalid token" }, { status: 401 });
  }
  if (request.method === "GET" && !action) {
    return Response.json(ARCHITECT_ACTIONS);
  }
  if (request.method !== "POST" || !action) {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  const known = ARCHITECT_ACTIONS.find((item) => item.name === action);
  if (!known) {
    return Response.json({ error: `no action "${action}"` }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { payload?: Record<string, unknown> };
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const role = roleOf(payload);
  if (!role) return Response.json({ ok: false, error: "The role is not an exercise role." }, { status: 400 });

  const odin = await getOdin();
  if (action === "read_picture") {
    return Response.json({ ok: true, result: await odin.picture(role) });
  }
  if (action === "ask_picture") {
    const question = String(payload.question ?? "").trim();
    if (!question) return Response.json({ ok: false, error: "A question is required." }, { status: 400 });
    return Response.json({ ok: true, result: await odin.ask(role, question) });
  }
  if (action === "list_courses") {
    const picture = await odin.picture(role);
    return Response.json({ ok: true, result: picture.courses });
  }
  if (action === "file_note") {
    const note = String(payload.note ?? "").trim();
    if (!note) return Response.json({ ok: false, error: "A note is required." }, { status: 400 });
    const result = await odin.observe(role, note);
    return Response.json({ ok: result.ok, result }, { status: result.ok ? 200 : 400 });
  }
  const drafted = await odin.draft(role);
  return Response.json({ ok: drafted.ok, result: drafted }, { status: drafted.ok ? 200 : 403 });
}
