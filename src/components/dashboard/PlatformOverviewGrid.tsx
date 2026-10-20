import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import { formatNumber, getRelativeTime } from "@/lib/utils";
import type { ConnectedAccount } from "@/types/database";

export function PlatformOverviewGrid({ accounts }: { accounts: ConnectedAccount[] }) {
  return <section aria-label="Platform channels"><h2 className="mb-3 text-sm font-semibold text-muted-foreground">Connected channels · individual account data</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {PLATFORM_CONFIGS.map((config) => {
      const channels = accounts.filter((account) => account.platform === config.id);
      return <Card key={config.id} className="overflow-hidden py-0"><div className="h-1" style={{ background: config.color }} /><CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: config.color }}><config.icon className="h-5 w-5" /></span><div><h3 className="font-semibold">{config.label}</h3><p className="text-xs text-muted-foreground">{channels.length ? `${channels.length} connected ${channels.length === 1 ? "channel" : "channels"}` : "Ready when you are"}</p></div></div>
        {!channels.length ? <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No account connected for this workspace. <Link to="/accounts" className="font-medium text-primary underline">Connect account</Link></div> : <div className="divide-y">{channels.map((account) => <div key={account.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{account.platform_display_name || config.label}</p><p className="truncate text-xs text-muted-foreground">{account.platform_username ? `@${account.platform_username.replace(/^@/, "")}` : "Connected account"}</p></div><div className="text-right"><p className="font-semibold tabular-nums">{formatNumber(account.followers_count)}</p><p className="text-[10px] text-muted-foreground">{config.id === "youtube" ? "subscribers" : "followers"}</p></div></div>
          <p className="mt-2 text-[11px] text-muted-foreground">{formatNumber(account.posts_count)} posts · {account.last_synced_at ? `Updated ${getRelativeTime(account.last_synced_at)}` : "Awaiting first sync"}{!account.is_active ? " · Reconnect required" : ""}</p>
        </div>)}</div>}
      </CardContent></Card>;
    })}
  </div></section>;
}
