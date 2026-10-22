import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
  bodyText: string;
  headerFormat: "IMAGE" | "VIDEO" | null;
  bodyParamCount: 0 | 1;
  supported: boolean;
  unsupportedReason?: string;
}

async function invokeWhatsApp<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>("whatsapp", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const parsed = await (error.context as Response).clone().json().catch(() => null);
      if (typeof parsed?.error === "string") throw new Error(parsed.error);
    }
    throw new Error(error.message);
  }
  if (data && typeof data === "object" && "error" in data && data.error) throw new Error(data.error);
  return data as T;
}

export type WhatsAppConnectInput =
  | { mode: "cloud"; phoneNumberId: string; wabaId: string; accessToken: string; brandId: string | null }
  | { mode: "bridge"; brandId: string | null };

export function useWhatsAppConnect() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WhatsAppConnectInput) =>
      invokeWhatsApp<{ accountId: string; displayName?: string; phone?: string; state?: string }>({
        action: "connect",
        ...input,
      }),
    onSuccess: async (data, input) => {
      await queryClient.invalidateQueries({ queryKey: ["connected-accounts", user?.id] });
      toast.success(
        input.mode === "bridge"
          ? "Scan the QR code with your phone to finish linking"
          : `Connected WhatsApp${data.phone ? ` ${data.phone}` : ""}`,
      );
    },
  });
}

export interface BridgeStatus {
  state: "disconnected" | "starting" | "qr" | "authenticating" | "ready" | "error";
  qr: string | null;
  account: { name: string; phone: string } | null;
  error: string | null;
  engine?: string;
  capabilities?: { pairingCode: boolean; remoteLogout: boolean };
}

// Polls the bridge through the Edge Function (the bridge key never reaches
// the browser). Fast while a QR is waiting to be scanned, slow once linked.
export function useBridgeStatus(accountId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["bridge-status", user?.id, accountId],
    queryFn: async () => {
      const status = await invokeWhatsApp<BridgeStatus>({ action: "bridge-status", accountId });
      // The function adopts the real name/number once the QR is scanned.
      if (status.state === "ready") queryClient.invalidateQueries({ queryKey: ["connected-accounts", user?.id] });
      return status;
    },
    enabled: Boolean(user?.id && accountId),
    gcTime: 0,
    retry: false,
    refetchInterval: (q) => (q.state.data?.state === "ready" ? 30000 : 3000),
  });

  const session = useMutation({
    mutationFn: (op: "start" | "restart" | "logout") => invokeWhatsApp<BridgeStatus>({ action: "bridge-session", accountId, op }),
    onSuccess: (status) => {
      queryClient.setQueryData(["bridge-status", user?.id, accountId], status);
      queryClient.invalidateQueries({ queryKey: ["connected-accounts", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not change the WhatsApp session"),
  });

  const pairingCode = useMutation({
    mutationFn: async (phone: string) => (await invokeWhatsApp<{ code: string }>({ action: "bridge-pairing-code", accountId, phone })).code,
    onError: (e: Error) => toast.error(e.message || "Could not get a pairing code"),
  });

  return { ...query, session, pairingCode };
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  size: number | null;
}

export function useBridgeGroups(accountId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["bridge-groups", accountId],
    queryFn: async () => (await invokeWhatsApp<{ groups: WhatsAppGroup[] }>({ action: "bridge-groups", accountId })).groups,
    enabled: Boolean(accountId) && enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useWhatsAppTemplates(accountId: string | undefined) {
  return useQuery({
    queryKey: ["whatsapp-templates", accountId],
    queryFn: async () => (await invokeWhatsApp<{ templates: WhatsAppTemplate[] }>({ action: "templates", accountId })).templates,
    enabled: Boolean(accountId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useWhatsAppContacts(accountId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["whatsapp-contacts", accountId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_whatsapp_contacts")
        .select("*")
        .eq("connected_account_id", accountId!)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(accountId),
  });

  const addContacts = useMutation({
    mutationFn: async (input: {
      rows: { phone: string; name?: string | null; tags?: string[] }[];
      source: string;
    }) => {
      if (!user?.id || !accountId) throw new Error("Not ready");
      const now = new Date().toISOString();
      const payload = input.rows.map((r) => ({
        user_id: user.id,
        connected_account_id: accountId,
        phone: r.phone,
        name: r.name ?? null,
        tags: r.tags ?? [],
        opted_in: true,
        opted_in_at: now,
        opt_in_source: input.source,
        opted_out_at: null,
      }));
      // Re-adding a number someone previously opted out of is a deliberate
      // act by the owner confirming fresh consent, so upsert re-enables them.
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase
          .from("sv_whatsapp_contacts")
          .upsert(payload.slice(i, i + 500), { onConflict: "connected_account_id,phone" });
        if (error) throw error;
      }
      return payload.length;
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success(`Saved ${count} contact${count === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message || "Could not save contacts"),
  });

  const setOptedIn = useMutation({
    mutationFn: async ({ id, optedIn }: { id: string; optedIn: boolean }) => {
      const { error } = await supabase
        .from("sv_whatsapp_contacts")
        .update(
          optedIn
            ? { opted_in: true, opted_in_at: new Date().toISOString(), opted_out_at: null }
            : { opted_in: false, opted_out_at: new Date().toISOString() },
        )
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error(e.message || "Could not update contact"),
  });

  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sv_whatsapp_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error(e.message || "Could not delete contact"),
  });

  return { ...query, addContacts, setOptedIn, removeContact };
}

export function useWhatsAppBroadcasts(accountId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["whatsapp-broadcasts", accountId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: broadcasts, error } = await supabase
        .from("sv_whatsapp_broadcasts")
        .select("*")
        .eq("connected_account_id", accountId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const ids = broadcasts.map((b) => b.id);
      const { data: stats, error: statsErr } = ids.length
        ? await supabase.from("sv_whatsapp_broadcast_stats").select("*").in("broadcast_id", ids)
        : { data: [], error: null };
      if (statsErr) throw statsErr;
      const byId = new Map((stats ?? []).map((s) => [s.broadcast_id, s]));
      return broadcasts.map((b) => ({ ...b, stats: byId.get(b.id) ?? null }));
    },
    enabled: Boolean(accountId),
    // Delivery/read receipts arrive via webhook while the page is open.
    refetchInterval: 15000,
  });

  const resume = useMutation({
    mutationFn: ({ broadcastId, retryFailed }: { broadcastId: string; retryFailed?: boolean }) =>
      invokeWhatsApp<{ counts: { total: number; sent: number; failed: number; pending: number; queued: number } }>({
        action: "resume",
        broadcastId,
        retryFailed: retryFailed ?? false,
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey });
      const { sent, total, queued, pending } = data.counts;
      toast.success(
        `Sent ${sent} of ${total}${queued ? `, ${queued} queued` : ""}${pending ? `, ${pending} still pending` : ""}`,
      );
    },
    onError: (e: Error) => toast.error(e.message || "Could not resume broadcast"),
  });

  const cancel = useMutation({
    mutationFn: (broadcastId: string) => invokeWhatsApp<{ ok: true }>({ action: "cancel", broadcastId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Broadcast stopped");
    },
    onError: (e: Error) => toast.error(e.message || "Could not stop broadcast"),
  });

  return { ...query, resume, cancel };
}

export function useWhatsAppBroadcastNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; text: string; mediaUrl?: string | null; options: Record<string, unknown> }) =>
      invokeWhatsApp<{ broadcastId: string; counts: { total: number; sent: number; queued: number; failed: number } }>({
        action: "broadcast",
        ...input,
      }),
    onSuccess: async (data, input) => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-broadcasts", input.accountId] });
      const { total, sent, queued } = data.counts;
      toast.success(queued ? `Queued ${total} messages — they send gradually in the background` : `Sent ${sent} of ${total}`);
    },
    onError: (e: Error) => toast.error(e.message || "Could not send broadcast"),
  });
}
