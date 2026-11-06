import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/architct/v1/actions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleArchitctRequest } = await import("@/lib/odin/architct");
        return handleArchitctRequest(request, "");
      },
    },
  },
});
