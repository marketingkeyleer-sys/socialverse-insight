import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { TablesUpdate } from "@/types/database";

export function useProfile() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sv_profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: TablesUpdate<"sv_profiles">) => {
      const { data, error } = await supabase
        .from("sv_profiles")
        .update(updates)
        .eq("id", user!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      await refreshProfile();
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update profile"),
  });

  return { ...query, updateProfile };
}
