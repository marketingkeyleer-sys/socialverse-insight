import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useBrands() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["brands", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("sv_brands").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const createBrand = useMutation({
    mutationFn: async (name: string) => {
      if (!user?.id) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("sv_brands")
        .insert({ user_id: user.id, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Brand created");
    },
    onError: (error: Error) => toast.error(error.message || "Could not create brand"),
  });

  const renameBrand = useMutation({
    mutationFn: async ({ brandId, name }: { brandId: string; name: string }) => {
      const { error } = await supabase.from("sv_brands").update({ name }).eq("id", brandId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Could not rename brand"),
  });

  // Deleting a brand never deletes its connected accounts — brand_id is
  // ON DELETE SET NULL, so those accounts just fall back into "Ungrouped".
  const deleteBrand = useMutation({
    mutationFn: async (brandId: string) => {
      const { error } = await supabase.from("sv_brands").delete().eq("id", brandId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["connected-accounts", user?.id] });
      toast.success("Brand deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete brand"),
  });

  return { ...query, createBrand, renameBrand, deleteBrand };
}
