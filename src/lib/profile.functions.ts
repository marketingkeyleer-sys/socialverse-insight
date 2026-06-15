import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const ensureCurrentUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as Record<string, unknown>;
    const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
    const email = stringOrNull(claims.email) ?? stringOrNull(metadata.email);
    const fullName = stringOrNull(metadata.full_name) ?? stringOrNull(metadata.name);
    const avatarUrl = stringOrNull(metadata.avatar_url) ?? stringOrNull(metadata.picture);

    const { error } = await context.supabase.from("profiles").upsert(
      {
        id: context.userId,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) throw new Error(error.message);
    return { ok: true };
  });