import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cndctr/v1/actions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleCndctrRequest } = await import("@/lib/odin/cndctr");
        return handleCndctrRequest(request, "");
      },
    },
  },
});
