import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import type { ConnectedAccount } from "@/types/database";
import { publishingAccessIssue } from "../../../supabase/functions/_shared/publishing-access";

export function PlatformSelector({ accounts, selected, onToggle, onSelectAll }: {
  accounts: ConnectedAccount[]; selected: string[]; onToggle: (accountId: string) => void;
  onSelectAll?: (ids: string[]) => void;
}) {
  const active = accounts.filter(account => account.is_active);
  const allSelected = active.length > 0 && active.every(account => selected.includes(account.id));
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{selected.length} selected · choose one or several pages</p>{onSelectAll && <Button type="button" size="sm" variant={allSelected ? "default" : "outline"} aria-pressed={allSelected} disabled={!active.length} onClick={() => onSelectAll(allSelected ? [] : active.map(account => account.id))}>{allSelected ? "Clear all" : "All"}</Button>}</div>
    <div className="grid gap-3 sm:grid-cols-2">{PLATFORM_CONFIGS.map(config => {
      const own = accounts.filter(account => account.platform === config.id);
      const Icon = config.icon;
      return <section key={config.id} className="space-y-2 rounded-xl border p-3"><p className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4" style={{color:config.color}}/>{config.label}</p>
        {own.length ? own.map(account => <button key={account.id} type="button" aria-pressed={selected.includes(account.id)} disabled={!account.is_active} onClick={() => onToggle(account.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-accent disabled:opacity-50", selected.includes(account.id) && "border-primary bg-primary/5")}><span className="min-w-0"><span className="block truncate font-medium">{account.platform_display_name ?? account.platform_username ?? config.label}</span><span className="block text-xs text-muted-foreground">{publishingAccessIssue(account) ? "Publishing access needs attention" : "Connected"}</span></span>{selected.includes(account.id) && <Check className="h-4 w-4 shrink-0 text-primary"/>}</button>) : <Link to="/accounts" className="block rounded-lg border border-dashed p-2 text-xs text-muted-foreground hover:text-primary">Connect {config.label}</Link>}
      </section>;
    })}</div>
  </div>;
}
