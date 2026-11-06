import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/architect/v1/actions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleArchitectRequest } = await import("@/lib/odin/architect");
        return handleArchitectRequest(request, "");
      },
    },
  },
});
