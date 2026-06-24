import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/oauth/$platform/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        url.pathname = `/api/public/oauth/${params.platform}/callback`;
        return new Response(null, { status: 308, headers: { Location: url.toString() } });
      },
    },
  },
});
