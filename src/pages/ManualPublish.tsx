import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaUploader } from "@/components/composer/MediaUploader";
import { useBrandScope } from "@/contexts/BrandContext";
import { usePost, usePosts } from "@/hooks/usePosts";
import { ALL_BRANDS, UNGROUPED } from "@/lib/brandScope";
import { manualDraft, manualPlatform, manualReminder, PERSONAL_PLATFORMS, type PersonalPlatform } from "@/lib/manualPublishing";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function ManualPublish() {
  const scope = useBrandScope();
  const [params, setParams] = useSearchParams();
  const id = params.get("id") ?? undefined;
  const { data: existing, isPending, isError } = usePost(id);
  const { createPost, updatePost } = usePosts();
  const loaded = useRef("");
  const [platform, setPlatform] = useState<PersonalPlatform>(params.get("platform") === "instagram" ? "instagram" : "facebook");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [remindAt, setRemindAt] = useState("");
  const [busyMedia, setBusyMedia] = useState<number | null>(null);
  useEffect(() => {
    if (!existing || loaded.current === existing.id) return;
    const target = manualPlatform(existing.tags);
    if (!target) return;
    loaded.current = existing.id;
    setPlatform(target); setTitle(existing.title ?? ""); setContent(existing.content); setMedia(existing.media_urls ?? []);
  }, [existing]);
  const busy = createPost.isPending || updatePost.isPending;
  const blocked = !scope.ready || scope.brandId === ALL_BRANDS || Boolean(id && (!existing || !manualPlatform(existing.tags) || existing.status !== "draft"));
  const save = async () => {
    if (blocked) throw new Error("Choose the draft's brand workspace before saving.");
    const payload = manualDraft(platform, content, title, media, scope.brandId === UNGROUPED ? null : scope.brandId);
    if (id) { await updatePost.mutateAsync({ id, updates: payload }); return id; }
    const created = await createPost.mutateAsync(payload);
    loaded.current = created.id; setParams({ id: created.id }, { replace: true });
    return created.id;
  };
  const action = async (work: () => Promise<unknown>) => {
    try { await work(); } catch (error) { toast.error(error instanceof Error ? error.message : "Please try again."); }
  };
  return <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{scope.brandName}</p><h1 className="mt-1 text-2xl font-semibold">Personal account publishing</h1><p className="mt-2 text-sm text-muted-foreground">Prepare your post here, then publish it yourself in Facebook or Instagram. No social account connection is required.</p></div>
    <p role="status" className="rounded-xl border bg-muted/30 p-4 text-sm">Manual drafts stay separate from automated publishing. SocialVerse cannot automatically publish these posts, confirm their publication or retrieve personal-account analytics.</p>
    {scope.brandId === ALL_BRANDS && <p role="alert">Choose one brand in the workspace selector to save a personal-account draft.</p>}
    {id && isPending && <p role="status">Loading draft…</p>}
    {id && (isError || (existing && !manualPlatform(existing.tags))) && <p role="alert">This manual draft is not available in this workspace. <Link className="underline" to="/posts">Return to posts</Link>.</p>}
    <Card><CardHeader><CardTitle>1. Prepare your content</CardTitle></CardHeader><CardContent className="space-y-4">
      <div><Label htmlFor="personal-platform">Platform</Label><select id="personal-platform" value={platform} onChange={event => setPlatform(event.target.value as PersonalPlatform)} className="mt-2 w-full rounded-md border bg-background p-2">{Object.entries(PERSONAL_PLATFORMS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div>
      <div><Label htmlFor="manual-title">Draft title</Label><Input id="manual-title" value={title} onChange={event => setTitle(event.target.value)}/></div>
      <div><Label htmlFor="manual-caption">Caption</Label><textarea id="manual-caption" className="mt-2 min-h-40 w-full rounded-lg border bg-background p-3 text-sm" value={content} onChange={event => setContent(event.target.value)}/></div>
      <MediaUploader urls={media} onChange={setMedia}/>
      <Button disabled={blocked || busy} onClick={() => void action(save)}>{busy ? "Saving…" : "Save manual draft"}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. Publish on your account</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Copy your caption, download each attachment, and open the platform. Check that you are using the right profile, attach the media, paste the caption and publish there.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!content} onClick={() => void action(async () => { await navigator.clipboard.writeText(content); toast.success("Caption copied"); })}>Copy caption</Button>
        <Button asChild><a href={PERSONAL_PLATFORMS[platform].url} target="_blank" rel="noreferrer">Open {platform === "facebook" ? "Facebook" : "Instagram"}</a></Button></div>
      <div className="flex flex-wrap gap-2">{media.map((url, index) => <Button key={url} variant="outline" disabled={busyMedia !== null} onClick={() => void action(async () => {
        setBusyMedia(index);
        try {
          const parsed = new URL(url); if (parsed.protocol !== "https:") throw new Error("This attachment URL is not supported.");
          const response = await fetch(url); if (!response.ok) throw new Error("Attachment download failed. Try again.");
          const blob = await response.blob(); const ext = parsed.pathname.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin";
          download(blob, `socialverse-${index + 1}.${ext}`);
        } finally { setBusyMedia(null); }
      })}>{busyMedia === index ? "Downloading…" : `Download attachment ${index + 1}`}</Button>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>3. Add a calendar reminder</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Save a reminder file and import it into your calendar. The reminder depends on your calendar's notification settings; SocialVerse does not send a notification or publish automatically.</p>
      <Label htmlFor="manual-reminder">Reminder date and time (your device timezone)</Label><Input id="manual-reminder" type="datetime-local" value={remindAt} onChange={event => setRemindAt(event.target.value)}/>
      <Button variant="outline" disabled={blocked || busy || !remindAt} onClick={() => void action(async () => {
        const at = new Date(remindAt); if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now()) throw new Error("Choose a future reminder time.");
        const draftId = await save();
        download(new Blob([manualReminder(at, platform, draftId, window.location.origin)], { type: "text/calendar;charset=utf-8" }), "socialverse-reminder.ics");
        toast.success("Reminder file downloaded. Import it into your calendar.");
      })}>Save draft and download reminder</Button>
    </CardContent></Card>
  </div>;
}
