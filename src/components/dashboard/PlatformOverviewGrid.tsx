import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLATFORM_CONFIGS, getPlatformColor } from "@/lib/platforms";
import { formatNumber, getRelativeTime } from "@/lib/utils";
import type { ConnectedAccount, Platform } from "@/types/database";

// The single "everything, per platform" glance the dashboard promises —
// every platform gets a card whether it's connected or not, so the app
// reads as complete rather than empty for whatever isn't hooked up yet.
export function PlatformOverviewGrid({ accounts }: { accounts: ConnectedAccount[] }) {
  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Platform overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORM_CONFIGS.map((config) => {
          const account = byPlatform.get(config.id);
          const color = getPlatformColor(config.id as Platform);
          const Icon = config.icon;

          if (!account) {
            return (
              <Card key={config.id} className="border-dashed">
                <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full text-white opacity-60"
                    style={{ backgroundColor: color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">Not connected</p>
                  <Button asChild size="sm" variant="outline" className="mt-1">
                    <Link to="/accounts">Connect</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={config.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: color }} />
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: color }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.platform_display_name || config.label}</p>
                    <p className="truncate text-xs text-muted-foreground">@{account.platform_username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatNumber(account.followers_count)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {formatNumber(account.posts_count)} posts
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{account.last_synced_at ? `Synced ${getRelativeTime(account.last_synced_at)}` : "Never synced"}</span>
                  <Link to="/accounts" className="inline-flex items-center gap-0.5 font-medium hover:underline" style={{ color }}>
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
