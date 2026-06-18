import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthCallback } from "@/lib/oauth/callback-handler";

type PlatformId = "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok" | "x";

export const Route = createFileRoute("/api/public/oauth/$platform/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const allowed = new Set(["instagram", "facebook", "linkedin", "youtube", "tiktok", "x"]);
        if (!allowed.has(params.platform)) return new Response("Unknown platform", { status: 404 });
        return handleOAuthCallback(request, params.platform as PlatformId);
      },
    },
  },
});