import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecentPostsDialog } from "@/components/accounts/RecentPostsDialog";
import { Badge } from "@/components/ui/badge";
import { getAccountHealth } from "@/lib/accountHealth";
import { getPlatformColor, getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { formatNumber, getRelativeTime } from "@/lib/utils";
import type { Brand, ConnectedAccount, Platform } from "@/types/database";

const SYNCABLE = new Set<Platform>(["facebook", "instagram", "youtube"]);
const INTERVALS = [
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every hour" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 1440, label: "Once a day" },
];

// A connected account as one compact line: who it is, how big it is, when it
// last synced, and everything else (auto-sync, moving brands, disconnecting)
// tucked into the menu so the page stays scannable.
export function AccountRow({
  account,
  brands,
  syncing,
  onSync,
  onDisconnect,
  onIntervalChange,
  onMove,
  onReconnect,
}: {
  account: ConnectedAccount;
  brands: Brand[];
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onIntervalChange: (minutes: number) => void;
  onMove: (brandId: string | null) => void;
  onReconnect: () => void;
}) {
  const health = getAccountHealth(account);
  const platform = account.platform as Platform;
  const Icon = getPlatformIcon(platform);
  const whatsapp = platform === "whatsapp";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={account.profile_picture_url ?? undefined} alt="" />
          <AvatarFallback>{(account.platform_display_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span
          className="absolute -bottom-1 -right-1 grid h-4.5 w-4.5 place-items-center rounded-full text-white ring-2 ring-card"
          style={{ backgroundColor: getPlatformColor(platform), height: 18, width: 18 }}
        >
          <Icon className="h-2.5 w-2.5" />
        </span>
      </div>

      <div className="min-w-0 flex-1 basis-40">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="truncate">{account.platform_display_name}</span>
          {health.level === "attention" && (
            <Badge variant="destructive" className="shrink-0 font-normal">
              {health.label}
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {getPlatformLabel(platform)}
          {account.platform_username && account.platform_username !== "null"
            ? ` · ${whatsapp || account.platform_username.startsWith("@") ? "" : "@"}${account.platform_username}`
            : ""}
        </p>
      </div>

      <div className="flex items-center gap-5 text-sm">
        <div className="text-right">
          <p className="font-medium tabular-nums">{formatNumber(account.followers_count)}</p>
          <p className="text-xs text-muted-foreground">{whatsapp ? "Contacts" : "Followers"}</p>
        </div>
        {!whatsapp && (
          <div className="text-right">
            <p className="font-medium tabular-nums">{formatNumber(account.posts_count)}</p>
            <p className="text-xs text-muted-foreground">Posts</p>
          </div>
        )}
        <div className="hidden text-right sm:block">
          <p className="text-xs">{account.last_synced_at ? getRelativeTime(account.last_synced_at) : "Never"}</p>
          <p className="text-xs text-muted-foreground">Last synced</p>
        </div>
      </div>

      {health.level === "attention" && (
        <p className="basis-full text-xs text-muted-foreground">{health.fix}</p>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {health.action === "reconnect" && (
          <Button size="sm" onClick={onReconnect}>
            Reconnect
          </Button>
        )}
        {health.action === "link" && (
          <Button asChild size="sm">
            <Link to={`/whatsapp?account=${account.id}`}>Scan QR</Link>
          </Button>
        )}
        {whatsapp && health.action !== "link" && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/whatsapp?account=${account.id}`}>Manage</Link>
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSync} disabled={syncing} title="Sync now">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Account options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!whatsapp && <DropdownMenuItem onSelect={onReconnect}>Review access / reconnect</DropdownMenuItem>}
            {!whatsapp && (
              <DropdownMenuItem onSelect={() => setPostsOpen(true)}>View recent posts</DropdownMenuItem>
            )}
            {(SYNCABLE.has(platform) || (platform === "linkedin_page" && account.scopes?.includes("socialverse:upload-post"))) && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Auto-sync</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={String(account.sync_interval_minutes)}
                    onValueChange={(v) => onIntervalChange(Number(v))}
                  >
                    {INTERVALS.map((i) => (
                      <DropdownMenuRadioItem key={i.value} value={String(i.value)}>
                        {i.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Move to brand</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel className="text-xs text-muted-foreground">One account per platform in each brand</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={account.brand_id ?? "none"} onValueChange={(v) => onMove(v === "none" ? null : v)}>
                  <DropdownMenuRadioItem value="none">No brand</DropdownMenuRadioItem>
                  {brands.map((b) => (
                    <DropdownMenuRadioItem key={b.id} value={b.id}>
                      {b.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmOpen(true)}>
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {getPlatformLabel(platform)}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll stop seeing analytics for this account and won't be able to publish to it until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!whatsapp && <RecentPostsDialog account={account} open={postsOpen} onOpenChange={setPostsOpen} />}
    </div>
  );
}
