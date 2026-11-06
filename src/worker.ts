import { handleArchitctRequest } from "./lib/odin/architct.ts";
import { handleOdinRequest } from "./lib/odin/http.ts";
import type { EonEnv } from "./lib/odin/eon.ts";

/**
 * Cloudflare Worker entry for the ODIN° exercise API.
 * The same handler serves /api/odin/* inside the console.
 * E(O)N™ Access credentials come from Worker secrets in `env`.
 */
export default {
  async fetch(request: Request, env: EonEnv = {}): Promise<Response> {
    const url = new URL(request.url);
    const prefix = "/api/odin";
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
      const splat = url.pathname.slice(prefix.length).replace(/^\//, "");
      return handleOdinRequest(request, splat, { env });
    }
    const actions = "/architct/v1/actions";
    if (url.pathname === actions || url.pathname.startsWith(`${actions}/`)) {
      const action = url.pathname.slice(actions.length).replace(/^\//, "");
      return handleArchitctRequest(request, action);
    }
    if (url.pathname === "/health") {
      return handleOdinRequest(request, "health", { env });
    }
    return new Response("ODIN° exercise API. GET /api/odin/health", {
      status: url.pathname === "/" ? 200 : 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
