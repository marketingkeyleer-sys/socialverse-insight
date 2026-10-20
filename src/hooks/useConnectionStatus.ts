import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Platform } from "@/types/database";

export interface PlatformAvailability {
  ready: boolean;
  reason?: string;
}

// Which platforms the server can connect right now. If the check itself
// fails, everything is treated as available so a hiccup here can never block
// a user from connecting — the real connect still reports its own errors.
export function useConnectionStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["connection-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        platforms: Record<string, PlatformAvailability>;
        cloudApiAvailable: boolean;
      }>("connection-status");
      if (error || !data) return null;
      return data;
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    retry: false,
  });
}

export function availability(
  status: Record<string, PlatformAvailability> | undefined,
  platform: Platform,
): PlatformAvailability {
  return status?.[platform] ?? { ready: true };
}
