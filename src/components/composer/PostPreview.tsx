import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import type { Platform } from "@/types/database";

export function PostPreview({ platforms, content, mediaUrls }: { platforms: Platform[]; content: string; mediaUrls: string[] }) {
  const { profile } = useAuth();

  if (platforms.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Select a platform to preview your post
      </div>
    );
  }

  return (
    <Tabs defaultValue={platforms[0]}>
      <TabsList>
        {platforms.map((p) => {
          const Icon = getPlatformIcon(p);
          return (
            <TabsTrigger key={p} value={p} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {getPlatformLabel(p)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {platforms.map((p) => (
        <TabsContent key={p} value={p}>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{(profile?.full_name ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{profile?.full_name ?? "Your name"}</p>
                <p className="text-xs text-muted-foreground">Just now</p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{content || "Your post content will appear here…"}</p>
            {mediaUrls.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-1.5 overflow-hidden rounded-lg">
                {mediaUrls.slice(0, 4).map((url) =>
                  /\.(mp4|mov)$/i.test(url) ? (
                    <video key={url} src={url} className="aspect-video w-full object-cover" muted />
                  ) : (
                    <img key={url} src={url} alt="" className="aspect-video w-full object-cover" />
                  ),
                )}
              </div>
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
