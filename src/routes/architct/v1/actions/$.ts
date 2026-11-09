import { createFileRoute } from "@tanstack/react-router";

// Alias of /architect/v1 for one release; remove after callers move.

export const Route = createFileRoute("/architct/v1/actions/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleArchitectRequest } = await import("@/lib/odin/architect");
        return handleArchitectRequest(request, params._splat ?? "");
      },
      POST: async ({ request, params }) => {
        const { handleArchitectRequest } = await import("@/lib/odin/architect");
        return handleArchitectRequest(request, params._splat ?? "");
      },
    },
  },
});
