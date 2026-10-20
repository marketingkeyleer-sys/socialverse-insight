import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getPlatformLabel } from "@/lib/platforms";
import type { Platform } from "@/types/database";

async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await (error.context as Response).clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // response wasn't JSON — fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export function useConnectedAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["connected-accounts", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_connected_accounts")
        .select("*")
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  // Kicks off the real OAuth flow: asks the oauth-start Edge Function for a
  // provider authorize URL, then sends the whole browser there. The account
  // row only appears once the provider redirects back through oauth-callback.
  const connect = useMutation({
    mutationFn: async ({ platform, brandId }: { platform: Platform; brandId?: string | null }) => {
      const { data, error } = await supabase.functions.invoke<{ authorizeUrl?: string; error?: string }>(
        "oauth-start",
        { body: { platform, brandId: brandId ?? null, origin: window.location.origin, redirectTo: window.location.href } },
      );
      if (error) throw new Error(await functionErrorMessage(error, "Could not start connection"));
      if (!data?.authorizeUrl) throw new Error(data?.error || "Could not start connection");
      window.location.href = data.authorizeUrl;
    },
    onError: (error: Error, { platform }) =>
      toast.error(error.message || `Could not connect ${getPlatformLabel(platform)}`),
  });

  const setBrand = useMutation({
    mutationFn: async ({ accountId, brandId }: { accountId: string; brandId: string | null }) => {
      const { error } = await supabase.from("sv_connected_accounts").update({ brand_id: brandId }).eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Account moved");
    },
    onError: (error: Error) => toast.error(error.message || "Could not move account"),
  });

  const disconnect = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from("sv_connected_accounts").delete().eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Account disconnected");
    },
    onError: (error: Error) => toast.error(error.message || "Could not disconnect account"),
  });

  // Pulls real recent posts + analytics history for the account (Facebook
  // only for now — other platforms still just refresh the timestamp).
  const sync = useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke<{
        postsSynced?: number;
        warnings?: string[];
        error?: string;
      }>("sync-account", { body: { accountId } });
      if (error) throw new Error(await functionErrorMessage(error, "Could not sync account"));
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data, accountId) => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["platform-posts", accountId] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(data?.postsSynced ? `Synced ${data.postsSynced} posts` : "Account synced");
      for (const warning of data?.warnings ?? []) toast.warning(warning);
    },
    onError: (error: Error) => toast.error(error.message || "Could not sync account"),
  });

  const setSyncInterval = useMutation({
    mutationFn: async ({ accountId, minutes }: { accountId: string; minutes: number }) => {
      const { error } = await supabase
        .from("sv_connected_accounts")
        .update({ sync_interval_minutes: minutes })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Auto-sync interval updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update auto-sync interval"),
  });

  return { ...query, connect, disconnect, sync, setSyncInterval, setBrand };
}
