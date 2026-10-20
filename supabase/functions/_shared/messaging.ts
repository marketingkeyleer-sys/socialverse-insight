// Facebook Page Messenger and Instagram DMs share the same underlying Graph
// API conversations/messages/send edges — only the owning id (Page id vs IG
// business account id) and the `platform` query param differ, so one
// implementation covers both instead of duplicating per platform.
const GRAPH_VERSION = "v21.0";

export interface Conversation {
  id: string;
  participantName: string;
  participantAvatar: string | null;
  snippet: string | null;
  updatedTime: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  text: string | null;
  fromId: string;
  fromName: string | null;
  createdTime: string;
}

function messagingPlatformParam(platform: "facebook" | "instagram"): string {
  return platform === "facebook" ? "messenger" : "instagram";
}

export async function fetchConversations(
  ownerId: string,
  token: string,
  platform: "facebook" | "instagram",
): Promise<Conversation[]> {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${ownerId}/conversations` +
    `?platform=${messagingPlatformParam(platform)}` +
    `&fields=participants,snippet,updated_time,unread_count` +
    `&limit=25&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Conversations fetch failed (${res.status})`);

  // deno-lint-ignore no-explicit-any
  return ((json.data ?? []) as any[]).map((c) => {
    // deno-lint-ignore no-explicit-any
    const other = (c.participants?.data ?? []).find((p: any) => p.id !== ownerId);
    return {
      id: c.id,
      participantName: other?.name ?? other?.username ?? "Unknown",
      participantAvatar: null,
      snippet: c.snippet ?? null,
      updatedTime: c.updated_time,
      unreadCount: c.unread_count ?? 0,
    };
  });
}

export async function fetchMessages(conversationId: string, token: string): Promise<Message[]> {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${conversationId}/messages` +
    `?fields=id,message,from,created_time&limit=50&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Messages fetch failed (${res.status})`);

  // deno-lint-ignore no-explicit-any
  return ((json.data ?? []) as any[])
    .map((m) => ({
      id: m.id,
      text: m.message ?? null,
      fromId: m.from?.id,
      fromName: m.from?.name ?? m.from?.username ?? null,
      createdTime: m.created_time,
    }))
    .reverse(); // Graph returns newest-first; a thread reads oldest-first
}

export async function getRecipientId(conversationId: string, token: string, ownerId: string): Promise<string> {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${conversationId}` +
    `?fields=participants&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Could not resolve recipient (${res.status})`);
  // deno-lint-ignore no-explicit-any
  const other = (json.participants?.data ?? []).find((p: any) => p.id !== ownerId);
  if (!other) throw new Error("Could not identify the other participant in this conversation");
  return other.id;
}

export async function sendMessage(
  ownerId: string,
  token: string,
  recipientId: string,
  text: string,
): Promise<{ messageId: string }> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${ownerId}/messages?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Send failed (${res.status})`);
  return { messageId: json.message_id };
}
