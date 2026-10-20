import { useBrandScope } from "@/contexts/BrandContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Ad, AdAccount, AdCampaign, AdObjective, AdSet } from "@/types/database";

export function useAdAccounts() {
  const { user } = useAuth();
  const scope = useBrandScope();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["ad-accounts", user?.id, scope.brandId, scope.accountIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("sv_ad_accounts").select("*").in("connected_account_id", scope.accountIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdAccount[];
    },
    enabled: Boolean(user?.id) && scope.ready,
  });

  const refresh = useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke<{ adAccounts?: unknown[]; error?: string }>(
        "list-ad-accounts",
        { body: { accountId } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ad-accounts", user?.id, scope.brandId, scope.accountIds] });
      toast.success("Ad accounts refreshed");
    },
    onError: (error: Error) => toast.error(error.message || "Could not fetch ad accounts"),
  });

  return { list, refresh };
}

export interface CampaignWithChildren extends AdCampaign {
  sv_ad_sets: (AdSet & { sv_ads: Ad[] })[];
}

export function useAdCampaigns() {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["ad-campaigns", user?.id, scope.brandId, scope.accountIds],
    queryFn: async () => {
      const parent = await supabase.from("sv_ad_accounts").select("id").in("connected_account_id", scope.accountIds);
      if (parent.error) throw parent.error;
      const { data, error } = await supabase
        .from("sv_ad_campaigns")
        .select("*, sv_ad_sets(*, sv_ads(*))")
        .in("ad_account_id", parent.data.map((row) => row.id))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CampaignWithChildren[];
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}

export interface CreateCampaignInput {
  adAccountRowId: string;
  campaign: { name: string; objective: AdObjective };
  adSet: {
    name: string;
    dailyBudgetCents: number;
    startTime: string;
    endTime: string | null;
    targeting: { ageMin: number; ageMax: number; genders: number[]; countries: string[] };
  };
  ad: {
    name: string;
    postId?: string;
    headline?: string;
    body?: string;
    mediaUrl?: string;
    destinationUrl?: string;
    callToAction?: string;
  };
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "create-ad-campaign",
        { body: input },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      toast.success("Campaign created (paused) — activate it when you're ready to spend");
    },
    onError: (error: Error) => toast.error(error.message || "Could not create campaign"),
  });
}

export function useUpdateAdStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ level, id, status }: { level: "campaign" | "adSet" | "ad"; id: string; status: "active" | "paused" }) => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("update-ad-status", {
        body: { level, id, status },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      toast.success(status === "active" ? "Activated — this is now spending real budget" : "Paused");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update status"),
  });
}

export interface BoostablePost {
  resultId: string;
  postId: string; // sv_posts.id, for showing title/content
  platformPostId: string; // the real Facebook post id — what Meta's ad creative needs
  publishedUrl: string | null;
  title: string | null;
  content: string;
  publishedAt: string | null;
}

// Only posts that actually succeeded on Facebook can be boosted — the ad
// creative references the real Facebook post id (page_id_postId), not our
// own sv_posts.id, so a post that failed or never targeted Facebook has
// nothing to boost.
export function useBoostablePosts() {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["boostable-posts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_post_platform_results")
        .select("id, platform_post_id, published_url, published_at, sv_posts(id, title, content)")
        .eq("platform", "facebook")
        .eq("status", "published")
        .not("platform_post_id", "is", null)
        .order("published_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data
        .filter((r) => r.sv_posts)
        .map((r) => ({
          resultId: r.id,
          postId: r.sv_posts!.id,
          platformPostId: r.platform_post_id as string,
          publishedUrl: r.published_url,
          title: r.sv_posts!.title,
          content: r.sv_posts!.content,
          publishedAt: r.published_at,
        })) as BoostablePost[];
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}

export function useSyncAdPerformance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; synced?: number; error?: string }>(
        "sync-ad-performance",
        { body: { campaignId } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      toast.success(`Synced ${data?.synced ?? 0} ad(s)`);
    },
    onError: (error: Error) => toast.error(error.message || "Could not sync performance"),
  });
}
