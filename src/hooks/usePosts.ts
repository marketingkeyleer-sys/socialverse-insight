import { useBrandScope } from "@/contexts/BrandContext";
import { postBrandFilter, ALL_BRANDS, UNGROUPED } from "@/lib/brandScope";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import type { Platform, PostStatus, TablesInsert, TablesUpdate } from "@/types/database";

export interface PostFilters {
  status?: PostStatus;
  platform?: Platform;
  search?: string;
}

const PAGE_SIZE = 20;

export function usePosts(filters: PostFilters = {}, page = 0) {
  const { user } = useAuth();
  const scope = useBrandScope();
  const queryClient = useQueryClient();
  const listKey = ["posts", user?.id, scope.brandId, scope.accountIds, filters, page];

  const list = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      let query = supabase
        .from("sv_posts")
        .select("*, sv_post_platform_results(*)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const brandFilter = postBrandFilter(scope.brandId, scope.accountIds);
      if (brandFilter) query = query.or(brandFilter);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.platform) query = query.contains("platforms", [filters.platform]);
      if (filters.search) query = query.ilike("content", `%${filters.search}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { posts: data.map((post) => ({ ...post, sv_post_platform_results: post.sv_post_platform_results.filter((result) => scope.brandId === ALL_BRANDS || (result.connected_account_id !== null && scope.accountIds.includes(result.connected_account_id))) })), total: count ?? 0 };
    },
    enabled: Boolean(user?.id) && scope.ready,
  });

  const createPost = useMutation({
    mutationFn: async (input: Omit<TablesInsert<"sv_posts">, "user_id">) => {
      const { data, error } = await supabase
        .from("sv_posts")
        .insert({ ...input, user_id: user!.id, brand_id: input.brand_id ?? (scope.brandId === ALL_BRANDS || scope.brandId === UNGROUPED ? null : scope.brandId) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts", user?.id] });
      toast.success("Post saved");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save post"),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<"sv_posts"> }) => {
      const { data, error } = await supabase.from("sv_posts").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts", user?.id] });
      toast.success("Post updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update post"),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sv_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts", user?.id] });
      toast.success("Post deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete post"),
  });

  const duplicatePost = useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error: fetchError } = await supabase.from("sv_posts").select("*").eq("id", id).single();
      if (fetchError) throw fetchError;
      const { data, error } = await supabase
        .from("sv_posts")
        .insert({
          user_id: user!.id,
          title: original.title ? `${original.title} (copy)` : null,
          content: original.content,
          brand_id: original.brand_id,
          platform_content: original.platform_content,
          media_urls: original.media_urls,
          platforms: original.platforms,
          connected_account_ids: original.connected_account_ids,
          tags: original.tags,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["posts", user?.id] });
      toast.success("Post duplicated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not duplicate post"),
  });

  const retryPost = useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.functions.invoke("publish-post", { body: { postId } });
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      return data as { overallStatus: string };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["post"] });
      if (data.overallStatus === "published") toast.success("All destinations published");
      else toast.warning("Some destinations failed. Review the results below.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { list, createPost, updatePost, deletePost, duplicatePost, retryPost };
}

export function usePost(id: string | undefined) {
  const { user } = useAuth();
  const scope = useBrandScope();
  return useQuery({
    queryKey: ["post", user?.id, scope.brandId, scope.accountIds, id],
    queryFn: async () => {
      let q = supabase
        .from("sv_posts")
        .select("*, sv_post_platform_results(*)")
        .eq("id", id!);
      const brandFilter = postBrandFilter(scope.brandId, scope.accountIds);
      if (brandFilter) q = q.or(brandFilter);
      const { data, error } = await q.single();
      if (error) throw error;
      return { ...data, sv_post_platform_results: data.sv_post_platform_results.filter((result) => scope.brandId === ALL_BRANDS || (result.connected_account_id !== null && scope.accountIds.includes(result.connected_account_id))) };
    },
    enabled: Boolean(id) && Boolean(user?.id) && scope.ready,
  });
}
