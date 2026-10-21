import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecentPostsDialog } from "@/components/accounts/RecentPostsDialog";
import { getPlatformColor, getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { formatNumber, getRelativeTime } from "@/lib/utils";
import type { ConnectedAccount, Platform } from "@/types/database";

const SYNCABLE_PLATFORMS = new Set<Platform>(["facebook", "instagram", "youtube"]);
const INTERVAL_OPTIONS = [
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every hour" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 1440, label: "Once a day" },
];

export function ConnectedAccountCard({
  account,
  onDisconnect,
  onSync,
  onSyncIntervalChange,
  syncing,
  disconnecting,
}: {
  account: ConnectedAccount;
  onDisconnect: () => void;
  onSync: () => void;
  onSyncIntervalChange: (minutes: number) => void;
  syncing: boolean;
  disconnecting: boolean;
}) {
  const platform = account.platform as Platform;
  const Icon = getPlatformIcon(platform);
  const [postsOpen, setPostsOpen] = useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={account.profile_picture_url ?? undefined} alt={account.platform_display_name ?? ""} />
              <AvatarFallback>{(account.platform_display_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span
              className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-white ring-2 ring-card"
              style={{ backgroundColor: getPlatformColor(platform) }}
            >
              <Icon className="h-3 w-3" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{account.platform_display_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {platform === "whatsapp" ? account.platform_username : `@${account.platform_username}`} · {getPlatformLabel(platform)}
            </p>
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <div>
            <p className="font-semibold">{formatNumber(account.followers_count)}</p>
            <p className="text-xs text-muted-foreground">{platform === "whatsapp" ? "Opted-in contacts" : "Followers"}</p>
          </div>
          {platform === "whatsapp" ? (
            <Link to={`/whatsapp?account=${account.id}`} className="text-left hover:underline">
              <p className="font-semibold">Manage</p>
              <p className="text-xs text-muted-foreground">Contacts and broadcasts</p>
            </Link>
          ) : (
            <button type="button" onClick={() => setPostsOpen(true)} className="text-left hover:underline">
              <p className="font-semibold">{formatNumber(account.posts_count)}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </button>
          )}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Last synced</p>
            <p className="text-xs">{account.last_synced_at ? getRelativeTime(account.last_synced_at) : "Never"}</p>
          </div>
        </div>

        {(SYNCABLE_PLATFORMS.has(platform) || (platform === "linkedin_page" && account.scopes?.includes("socialverse:upload-post"))) && (
          <Select
            value={String(account.sync_interval_minutes)}
            onValueChange={(v) => onSyncIntervalChange(Number(v))}
          >
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue placeholder="Auto-sync" />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  Auto-sync: {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync now
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive">
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect {getPlatformLabel(platform)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll stop seeing analytics for this account and won't be able to publish to it until you reconnect.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDisconnect} disabled={disconnecting}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
      <RecentPostsDialog account={account} open={postsOpen} onOpenChange={setPostsOpen} />
    </Card>
  );
}
