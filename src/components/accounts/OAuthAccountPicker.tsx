import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

async function request(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("oauth-accounts", { body });
  if (error instanceof FunctionsHttpError) {
    const response = await error.context.json().catch(() => null);
    throw new Error(response?.error ?? error.message);
  }
  if (error || data?.error) throw new Error(data?.error ?? error?.message);
  return data as { brandId?: string; accounts: { id: string; name: string }[]; connectedCount?: number };
}

export function OAuthAccountPicker({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["oauth-selection", requestId], queryFn: () => request({ requestId }), retry: false });
  const confirm = useMutation({
    mutationFn: () => request({ requestId, selectedIds: selected }),
    onSuccess: async (data) => {
      await client.invalidateQueries({ queryKey: ["connected-accounts"] });
      toast.success(`Connected ${data.connectedCount} account(s)`);
      client.removeQueries({ queryKey: ["oauth-selection", requestId] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancel = async () => {
    if (confirm.isPending) return;
    await request({ requestId, cancel: true }).catch(() => undefined);
    client.removeQueries({ queryKey: ["oauth-selection", requestId] });
    onClose();
  };
  return <Dialog open onOpenChange={(open) => !open && void cancel()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Choose accounts to connect</DialogTitle>
        <DialogDescription>{query.data?.brandId ? "Choose one account for this brand. Connect additional accounts to another brand or Ungrouped." : "Choose the accounts you want to manage."}</DialogDescription>
      </DialogHeader>
      {query.isPending && <p>Loading authorized accounts…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data?.accounts.map((account) => <label key={account.id} className="flex items-center gap-3 rounded border p-3">
        <Checkbox checked={selected.includes(account.id)} disabled={confirm.isPending} onCheckedChange={(checked) => setSelected((prev) => checked ? query.data.brandId ? [account.id] : [...prev, account.id] : prev.filter((id) => id !== account.id))} />
        <span>{account.name}</span>
      </label>)}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={confirm.isPending} onClick={() => void cancel()}>Cancel</Button>
        <Button disabled={!selected.length || confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? "Connecting…" : "Connect selected"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
