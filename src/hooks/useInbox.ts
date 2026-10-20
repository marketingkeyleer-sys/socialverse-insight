import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Conversation {
  id: string;
  participantName: string;
  participantAvatar: string | null;
  snippet: string | null;
  updatedTime: string;
  unreadCount: number;
}

export interface InboxMessage {
  id: string;
  text: string | null;
  fromId: string;
  fromName: string | null;
  createdTime: string;
}

export function useConversations(accountId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["conversations", user?.id, accountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ conversations: Conversation[]; error?: string }>(
        "list-conversations",
        { body: { accountId } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.conversations ?? [];
    },
    enabled: Boolean(user?.id && accountId),
  });
}

export function useMessages(accountId: string | undefined, conversationId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["messages", user?.id, accountId, conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        messages: InboxMessage[];
        ownerId: string;
        error?: string;
      }>("get-messages", { body: { accountId, conversationId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { messages: data?.messages ?? [], ownerId: data?.ownerId };
    },
    enabled: Boolean(user?.id && accountId && conversationId),
  });
}

export function useSendMessage(accountId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, text }: { conversationId: string; text: string }) => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("send-message", {
        body: { accountId, conversationId, text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not send reply"),
  });
}

export function useInboxState(accountId: string | undefined) {
  const { user } = useAuth();
  const client = useQueryClient();
  const queryKey = ["inbox-state", user?.id, accountId];
  const query = useQuery({ queryKey, enabled: Boolean(user && accountId), queryFn: async () => {
    const { data, error } = await supabase.from("sv_inbox_state").select("*").eq("connected_account_id", accountId!);
    if (error) throw error;
    return data;
  } });
  const save = useMutation({ mutationFn: async (input: { conversation_id: string; is_read?: boolean; read_updated_at?: string; note?: string }) => {
    if (!user || !accountId) throw new Error("Sign in and select an account");
    const { error } = await supabase.from("sv_inbox_state").upsert({ user_id: user.id, connected_account_id: accountId, ...input }, { onConflict: "user_id,connected_account_id,conversation_id", defaultToNull: false });
    if (error) throw error;
  }, onSuccess: () => client.invalidateQueries({ queryKey }), onError: (error: Error) => toast.error(error.message) });
  return { ...query, save };
}
