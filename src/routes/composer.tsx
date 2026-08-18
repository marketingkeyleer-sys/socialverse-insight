import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "motion/react";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { listConnectedAccounts } from "@/lib/oauth/accounts.functions";
import { createScheduledPost } from "@/lib/scheduled-posts.functions";
import { MediaUploader, type UploadedMedia } from "@/components/media-uploader";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type PublishablePlatform = "instagram" | "facebook" | "linkedin" | "youtube";

const PLATFORMS: Array<{ id: PublishablePlatform; name: string; color: string }> = [
  { id: "instagram", name: "Instagram", color: "var(--pink)" },
  { id: "facebook", name: "Facebook", color: "var(--violet)" },
  { id: "linkedin", name: "LinkedIn", color: "var(--cyan)" },
  { id: "youtube", name: "YouTube", color: "var(--destructive)" },
];

export const Route = createFileRoute("/composer")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: ComposerPage,
  head: () => ({ meta: [{ title: "Composer · SocialVerse Analytics" }] }),
});

function toIsoOrUndefined(mode: "now" | "later", date: string, time: string): string | undefined {
  if (mode === "now") return undefined;
  if (!date || !time) return undefined;
  const local = new Date(`${date}T${time}`);
  return Number.isNaN(local.getTime()) ? undefined : local.toISOString();
}

function ComposerPage() {
  const navigate = useNavigate();
  const list = useServerFn(listConnectedAccounts);
  const create = useServerFn(createScheduledPost);

  const { data, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => list(),
  });

  const [content, setContent] = useState("");
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [selected, setSelected] = useState<Set<PublishablePlatform>>(new Set());
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const accountsByPlatform = new Map((data?.accounts ?? []).map((a) => [a.platform, a]));

  const togglePlatform = (id: PublishablePlatform) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selected.size === 0) throw new Error("Select at least one platform.");

      for (const platform of selected) {
        if (!accountsByPlatform.has(platform)) {
          throw new Error(`${platform} is not connected. Connect it first.`);
        }
      }
      if (selected.has("instagram") && !media) {
        throw new Error("Instagram requires an image — text-only posts aren't supported.");
      }
      if (selected.has("youtube") && (!media || media.type !== "video")) {
        throw new Error("YouTube requires a video file.");
      }
      if (selected.has("youtube") && !youtubeTitle.trim()) {
        throw new Error("YouTube requires a title.");
      }
      const contentRequired = !(selected.size === 1 && selected.has("youtube"));
      if (contentRequired && !content.trim()) {
        throw new Error("Write something for your post.");
      }

      const scheduledAt = toIsoOrUndefined(scheduleMode, date, time);
      if (scheduleMode === "later" && !scheduledAt) {
        throw new Error("Pick a valid date and time to schedule for later.");
      }

      const targets = Array.from(selected).map((platform) => {
        const account = accountsByPlatform.get(platform)!;
        const platformOptions: Record<string, unknown> =
          platform === "youtube"
            ? { title: youtubeTitle.trim(), description: content }
            : platform === "linkedin"
              ? { authorType: "member" }
              : {};
        return { connectedAccountId: account.id, platform, platformOptions };
      });

      return create({
        data: {
          content,
          mediaUrl: media?.url,
          mediaType: media?.type,
          mediaPath: media?.path,
          scheduledAt,
          targets,
        },
      });
    },
    onSuccess: () => {
      setSuccess(true);
      setFormError(null);
      setContent("");
      setMedia(null);
      setSelected(new Set());
      setYoutubeTitle("");
      setScheduleMode("now");
      setDate("");
      setTime("");
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Could not create the post."),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Brand />
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link to="/scheduled-posts" className="hover:text-foreground">
              Scheduled posts
            </Link>
            <Link to="/connections" className="hover:text-foreground">
              Connections
            </Link>
            <button onClick={signOut} className="hover:text-foreground">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Publishing</div>
          <h1 className="mt-2 text-3xl font-semibold">Compose a post</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Write once, pick your platforms, and schedule it — or publish right away.
          </p>
        </motion.div>

        {success && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            Post created.{" "}
            <Link to="/scheduled-posts" className="underline">
              View scheduled posts
            </Link>
          </div>
        )}
        {formError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {formError}
          </div>
        )}

        <div className="mt-8 space-y-6">
          <div>
            <label className="text-sm font-medium">Content</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to share?"
              className="mt-2 min-h-[120px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Media</label>
            <div className="mt-2">
              <MediaUploader value={media} onChange={setMedia} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Platforms</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PLATFORMS.map((p) => {
                const connected = accountsByPlatform.has(p.id);
                const isSelected = selected.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                      connected
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-white/5 bg-white/[0.01] opacity-60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg" style={{ background: p.color }} />
                      {p.name}
                      {!connected && !isLoading && (
                        <Link to="/connections" className="text-xs text-primary underline">
                          Connect
                        </Link>
                      )}
                    </span>
                    <Checkbox
                      checked={isSelected}
                      disabled={!connected}
                      onCheckedChange={() => togglePlatform(p.id)}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {selected.has("youtube") && (
            <div>
              <label className="text-sm font-medium">YouTube title</label>
              <input
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                placeholder="Video title"
                className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">When</label>
            <RadioGroup
              value={scheduleMode}
              onValueChange={(v) => setScheduleMode(v as "now" | "later")}
              className="mt-2 flex gap-6"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="now" id="now" />
                Post now
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="later" id="later" />
                Schedule for later
              </label>
            </RadioGroup>

            {scheduleMode === "later" && (
              <div className="mt-3 flex gap-3">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-medium text-background shadow-glow disabled:opacity-60"
          >
            {mutation.isPending
              ? "Creating…"
              : scheduleMode === "now"
                ? "Publish now"
                : "Schedule post"}
          </button>
        </div>
      </main>
    </div>
  );
}
