import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useInboxState } from "@/hooks/useInbox";

export function InboxThreadTools({ accountId, conversationId }: { accountId: string; conversationId: string }) {
  const { data, isPending, error, save } = useInboxState(accountId);
  const [note, setNote] = useState<string | null>(null);
  if (isPending) return null;
  if (error) return <p role="alert" className="p-3 text-sm text-destructive">Could not load inbox controls: {error.message}</p>;
  const saved = data?.find((r) => r.conversation_id === conversationId);
  return <div className="space-y-2 border-t p-3">
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ conversation_id: conversationId, is_read: true, read_updated_at: new Date().toISOString() })}>Mark read</Button>
      <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ conversation_id: conversationId, is_read: false, read_updated_at: new Date().toISOString() })}>Mark unread</Button>
    </div>
    <label className="text-xs text-muted-foreground" htmlFor="internal-note">Private internal note</label>
    <Textarea id="internal-note" maxLength={10000} className="min-h-12" placeholder="Notes for your own reference" value={note ?? saved?.note ?? ""} onChange={(e) => setNote(e.target.value)} />
    <Button size="sm" variant="outline" disabled={save.isPending || note === null} onClick={() => save.mutate({ conversation_id: conversationId, note: note ?? "" }, { onSuccess: () => setNote(null) })}>Save note</Button>
    <p className="text-xs text-muted-foreground">Read status is saved in SocialVerse.</p>
  </div>;
}
