import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Json } from "@/types/database";

export function useActivityLog(limit = 20) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const recent = useQuery({
    queryKey: ["activity-log", user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const logActivity = useMutation({
    mutationFn: async ({
      action,
      entityType,
      entityId,
      metadata,
    }: {
      action: string;
      entityType?: string;
      entityId?: string;
      metadata?: Json;
    }) => {
      const { error } = await supabase.from("sv_activity_log").insert({
        user_id: user!.id,
        action,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        metadata: metadata ?? {},
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["activity-log", user?.id] });
    },
  });

  return { recent, logActivity };
}
