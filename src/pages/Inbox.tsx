import { useState } from "react";
import { AlertTriangle, Inbox as InboxIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getPlatformColor, getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { cn, formatDate, getRelativeTime, truncateText } from "@/lib/utils";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { useConversations, useMessages, useSendMessage, useInboxState } from "@/hooks/useInbox";
import { Input } from "@/components/ui/input";
import { InboxThreadTools } from "@/components/accounts/InboxThreadTools";
import type { Platform } from "@/types/database";

const MESSAGING_PLATFORMS = new Set<Platform>(["facebook", "instagram"]);

export default function InboxPage() {
  const { data: accounts = [], isLoading: accountsLoading } = useConnectedAccounts();
  const messagingAccounts = accounts.filter((a) => MESSAGING_PLATFORMS.has(a.platform));

  const [selectedAccountId, setAccountId] = useState<string | undefined>(undefined);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Defaults to the first messaging-capable account until the user picks one
  // — derived during render instead of an effect+setState so there's no
  // extra render pass just to land on the same value.
  const accountId = selectedAccountId ?? messagingAccounts[0]?.id;
  const account = messagingAccounts.find((a) => a.id === accountId);
  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    isError: conversationsError,
    error: conversationsErrorObj,
  } = useConversations(accountId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    isError: messagesError,
    error: messagesErrorObj,
  } = useMessages(accountId, conversationId);
  const sendMessage = useSendMessage(accountId);
  const { data: states = [] } = useInboxState(accountId);
  const unread = (c: (typeof conversations)[number]) => {
    const state = states.find((s) => s.conversation_id === c.id);
    return state?.is_read !== null && state?.is_read !== undefined && state.read_updated_at && new Date(c.updatedTime) <= new Date(state.read_updated_at) ? !state.is_read : c.unreadCount > 0;
  };
  const filteredConversations = conversations.filter((c) => (!unreadOnly || unread(c)) && `${c.participantName} ${c.snippet ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const conversation = conversations.find((c) => c.id === conversationId);

  const handleSend = () => {
    if (!conversationId || !draft.trim()) return;
    sendMessage.mutate(
      { conversationId, text: draft.trim() },
      { onSuccess: () => setDraft("") },
    );
  };

  if (accountsLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (messagingAccounts.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <InboxIcon className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">No inbox yet</h1>
          <p className="mt-1 max-w-md text-muted-foreground">
            Connect a Facebook Page or Instagram Business account to see and reply to your DMs here. YouTube and
            LinkedIn don't offer a message inbox through their public APIs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <Select value={accountId} onValueChange={(v) => { setAccountId(v); setConversationId(undefined); }}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose an account" />
          </SelectTrigger>
          <SelectContent>
            {messagingAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {getPlatformLabel(a.platform)} — {a.platform_display_name ?? a.platform_username ?? a.platform_user_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Input aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly((v) => !v)}>Unread</Button>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid h-[600px] grid-cols-1 md:grid-cols-[280px_1fr]">
          {/* Conversation list */}
          <div className="overflow-y-auto border-r">
            {conversationsLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : conversationsError ? (
              <div className="flex items-start gap-2 p-4 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {conversationsErrorObj instanceof Error ? conversationsErrorObj.message : "Could not load conversations"}
              </div>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              <ul>
                {filteredConversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => { setConversationId(c.id); setDraft(""); }}
                      className={cn(
                        "flex w-full flex-col gap-0.5 border-b p-3 text-left hover:bg-accent",
                        c.id === conversationId && "bg-accent",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.participantName}</span>
                        {unread(c) && (
                          <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                            {c.unreadCount || 1}
                          </span>
                        )}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{c.snippet ?? ""}</span>
                      <span className="text-[10px] text-muted-foreground">{getRelativeTime(c.updatedTime)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Thread */}
          <div className="flex flex-col">
            {!conversationId ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a conversation
              </div>
            ) : (
              <>
                {account && (
                  <div className="flex items-center gap-2 border-b p-3">
                    {(() => {
                      const Icon = getPlatformIcon(account.platform);
                      return <Icon className="h-4 w-4" style={{ color: getPlatformColor(account.platform) }} />;
                    })()}
                    <span className="text-sm font-medium">{conversation?.participantName ?? "Conversation"}</span>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4">
                  {messagesLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-2/3 rounded-lg" />
                      ))}
                    </div>
                  ) : messagesError ? (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {messagesErrorObj instanceof Error ? messagesErrorObj.message : "Could not load messages"}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(messagesData?.messages ?? []).map((m) => {
                        const isOwner = m.fromId === messagesData?.ownerId;
                        return (
                          <div key={m.id} className={cn("flex", isOwner ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                                isOwner ? "bg-primary text-primary-foreground" : "bg-muted",
                              )}
                            >
                              <p className="whitespace-pre-wrap">{m.text ?? truncateText("(attachment)", 40)}</p>
                              <p className={cn("mt-1 text-[10px]", isOwner ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                {formatDate(m.createdTime, { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {accountId && <InboxThreadTools key={`${accountId}:${conversationId}`} accountId={accountId} conversationId={conversationId} />}
                <div className="flex items-end gap-2 border-t p-3">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a reply…"
                    className="min-h-10 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button onClick={handleSend} disabled={!draft.trim() || sendMessage.isPending} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
