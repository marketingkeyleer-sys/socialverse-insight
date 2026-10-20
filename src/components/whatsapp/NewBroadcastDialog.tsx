import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppOptionsCard } from "@/components/composer/WhatsAppOptionsCard";
import { useWhatsAppBroadcastNow } from "@/hooks/useWhatsApp";
import { isWhatsAppReady } from "@/lib/whatsapp";
import type { ConnectedAccount, WhatsAppOptions } from "@/types/database";

// Send a message to a customer list and/or groups without writing a post:
// pick who, type the message, send.
export function NewBroadcastDialog({
  account,
  open,
  onOpenChange,
}: {
  account: ConnectedAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const bridge = account.metadata?.mode === "bridge";
  const [text, setText] = useState("");
  const [options, setOptions] = useState<WhatsAppOptions>(
    bridge ? { includeContacts: true, pace: "balanced", groups: [] } : {},
  );
  const send = useWhatsAppBroadcastNow();

  function submit() {
    if (!text.trim()) return toast.error("Write the message to send");
    const problem = isWhatsAppReady(account, options);
    if (problem) return toast.error(problem);
    send.mutate(
      { accountId: account.id, text: text.trim(), options: options as Record<string, unknown> },
      {
        onSuccess: () => {
          setText("");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New broadcast</DialogTitle>
          <DialogDescription>
            Use <code>{"{name}"}</code> to put each contact's name in the message.
          </DialogDescription>
        </DialogHeader>
        <Textarea rows={5} placeholder="Write your message…" value={text} onChange={(e) => setText(e.target.value)} />
        <WhatsAppOptionsCard account={account} value={options} onChange={setOptions} content={text} mediaUrls={[]} />
        <DialogFooter>
          <Button onClick={submit} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send broadcast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
