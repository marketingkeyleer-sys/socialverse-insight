import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PlatformStatus = {
  platform: "instagram" | "facebook" | "youtube" | "linkedin";
  connected: boolean;
  accountName: string | null;
  avatarUrl: string | null;
};

export const getConnectedPlatforms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("connected_accounts")
      .select("platform, display_name, account_handle, avatar_url")
      .eq("user_id", context.userId)
      .in("platform", ["instagram", "facebook", "youtube", "linkedin"]);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      platform: string;
      display_name: string | null;
      account_handle: string | null;
      avatar_url: string | null;
    }>;

    const byPlatform = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = byPlatform.get(row.platform);
      if (!existing) {
        byPlatform.set(row.platform, row);
      }
    }

    const platforms: PlatformStatus[] = [
      { platform: "instagram", connected: false, accountName: null, avatarUrl: null },
      { platform: "facebook", connected: false, accountName: null, avatarUrl: null },
      { platform: "youtube", connected: false, accountName: null, avatarUrl: null },
      { platform: "linkedin", connected: false, accountName: null, avatarUrl: null },
    ];

    for (const p of platforms) {
      const row = byPlatform.get(p.platform);
      if (row) {
        p.connected = true;
        p.accountName = row.display_name ?? row.account_handle ?? null;
        p.avatarUrl = row.avatar_url ?? null;
      }
    }

    return { platforms };
  });
