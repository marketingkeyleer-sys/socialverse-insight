import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PostEditor } from "@/components/composer/PostEditor";
import { AIComposeAssist } from "@/components/composer/AIComposeAssist";
import { PlatformSelector } from "@/components/composer/PlatformSelector";
import { MediaUploader } from "@/components/composer/MediaUploader";
import { SchedulePicker } from "@/components/composer/SchedulePicker";
import { PostPreview } from "@/components/composer/PostPreview";
import { WhatsAppOptionsCard } from "@/components/composer/WhatsAppOptionsCard";
import { isWhatsAppReady } from "@/lib/whatsapp";
import { useScopedAccounts as useConnectedAccounts, useBrandScope } from "@/contexts/BrandContext";
import { usePosts, usePost } from "@/hooks/usePosts";
import { useActivityLog } from "@/hooks/useActivityLog";
import { getPlatformCharLimit } from "@/lib/platforms";
import { supabase } from "@/lib/supabase";
import type { Platform, WhatsAppOptions } from "@/types/database";
import { platformPostContent, validatePlatformDraft, type PlatformDraft } from "../../supabase/functions/_shared/content-policy";
import { ALL_BRANDS, UNGROUPED } from "@/lib/brandScope";
import { getPlatformConfig } from "@/lib/platforms";
import { manualPlatform } from "@/lib/manualPublishing";

export default function Compose() {
  const scope = useBrandScope();
  const [params] = useSearchParams();
  const editingId = params.get("id") ?? undefined;
  const navigate = useNavigate();

  const { data: accountData } = useConnectedAccounts();
  const accounts = accountData ?? [];
  const initializedPost = useRef<string | null>(null);
  const { createPost, updatePost } = usePosts();
  const { data: existingPost } = usePost(editingId);
  const { logActivity } = useActivityLog();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platformContent, setPlatformContent] = useState<Partial<Record<Platform, PlatformDraft>>>({});
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const selectedPlatforms = [...new Set(accounts.filter((a) => selectedAccountIds.includes(a.id)).map((a) => a.platform))] as Platform[];
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [whatsappOptions, setWhatsappOptions] = useState<WhatsAppOptions>({});
  const whatsappAccount = accounts.find((a) => a.platform === "whatsapp" && selectedAccountIds.includes(a.id));

  useEffect(() => {
    if (!existingPost || !accountData || initializedPost.current === existingPost.id) return;
    initializedPost.current = existingPost.id;
    setTitle(existingPost.title ?? "");
    setContent(existingPost.content);
    setPlatformContent(existingPost.platform_content ?? {});
    setMediaUrls(existingPost.media_urls ?? []);
    setSelectedAccountIds(existingPost.connected_account_ids ?? accountData.filter((a) => existingPost.platforms.includes(a.platform) && accountData.filter((b) => b.platform === a.platform).length === 1).map((a) => a.id));
    setWhatsappOptions(existingPost.whatsapp_options ?? {});
    if (existingPost.scheduled_at) {
      setScheduleMode("schedule");
      const d = new Date(existingPost.scheduled_at);
      setDate(d);
      setTime(d.toTimeString().slice(0, 5));
    }
  }, [existingPost, accountData]);

  const togglePlatform = (accountId: string) => {
    const platform = accounts.find((a) => a.id === accountId)?.platform;
    if (platform && !selectedAccountIds.includes(accountId) && !selectedPlatforms.includes(platform)) {
      setPlatformContent((previous) => ({ ...previous, [platform]: previous[platform] ?? { content: "", media_urls: [] } }));
    }
    // A QR-linked number has no template to pick, so it starts out sending to
    // the customer list at a middle pace instead of an empty, invalid state.
    if (
      platform === "whatsapp" &&
      !selectedPlatforms.includes("whatsapp") &&
      accounts.find((a) => a.id === accountId)?.metadata?.mode === "bridge" &&
      !whatsappOptions.pace
    ) {
      setWhatsappOptions({ includeContacts: true, pace: "balanced", groups: [] });
    }
    setSelectedAccountIds((prev) => (prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]));
  };

  const charLimit = selectedPlatforms.length
    ? Math.min(...selectedPlatforms.map(getPlatformCharLimit))
    : 5000;

  const scheduledAt = () => {
    if (scheduleMode === "now" || !date) return null;
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const handleSave = async (status: "draft" | "scheduled" | "published") => {
    if (editingId && !existingPost) { toast.error("This post is not available in the selected brand workspace"); return; }
    if (scope.brandId === ALL_BRANDS) { toast.error("Choose one brand workspace before composing a post"); return; }
    if (selectedAccountIds.some((id) => !accounts.some((account) => account.id === id))) { toast.error("This post contains an account outside the selected brand. Choose this brand's destinations."); return; }
    if (existingPost?.status === "publishing" || existingPost?.status === "published") {
      toast.error("Duplicate this post to create a new version. Publishing or published posts cannot be edited here.");
      return;
    }
    if (status !== "draft" && selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    if (status === "scheduled" && !date) {
      toast.error("Pick a date and time to schedule");
      return;
    }
    if (status === "scheduled" && new Date(scheduledAt()!).getTime() <= Date.now()) {
      toast.error("Choose a scheduling time in the future");
      return;
    }
    const drafts = selectedPlatforms.map((platform) => ({ platform, draft: platformPostContent({ title, content, media_urls: mediaUrls, platform_content: platformContent }, platform) }));
    if (!drafts.length && !content.trim() && !mediaUrls.length) { toast.error("Add text or media to your post"); return; }
    try { for (const { platform, draft } of drafts) { if (status !== "draft") validatePlatformDraft(platform, draft); } }
    catch (error) { toast.error(error instanceof Error ? error.message : "Check each platform's content"); return; }
    if (status !== "draft") {
      if (selectedPlatforms.includes("whatsapp")) {
        const problem = isWhatsAppReady(whatsappAccount, whatsappOptions);
        if (problem) {
          toast.error(problem);
          return;
        }
        if (whatsappOptions.headerFormat && !drafts.find((item) => item.platform === "whatsapp")?.draft.media_urls.length) {
          toast.error(`This WhatsApp template needs an ${whatsappOptions.headerFormat.toLowerCase()} attached`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        brand_id: scope.brandId === UNGROUPED ? null : scope.brandId,
        platform_content: Object.fromEntries(selectedPlatforms.filter((platform) => platformContent[platform]).map((platform) => [platform, platformContent[platform]])),
        title: title || null,
        content: content || drafts[0]?.draft.content || "",
        media_urls: mediaUrls,
        platforms: selectedPlatforms,
        connected_account_ids: selectedAccountIds,
        whatsapp_options: selectedPlatforms.includes("whatsapp") ? whatsappOptions : null,
        // "publishing" until the real per-platform outcome comes back below —
        // publish-post is what actually flips this to published/partially_failed/failed.
        status: status === "published" ? ("draft" as const) : status,
        scheduled_at: status === "scheduled" ? scheduledAt() : null,
        published_at: null,
      };

      let postId = editingId;
      if (editingId) {
        await updatePost.mutateAsync({ id: editingId, updates: payload });
      } else {
        const created = await createPost.mutateAsync(payload);
        postId = created.id;
      }

      if (status === "published" && postId) {
        const { data, error } = await supabase.functions.invoke<{
          overallStatus?: "published" | "partially_failed" | "failed";
          results?: { platform: string; status: string; errorMessage: string | null }[];
          error?: string;
        }>("publish-post", { body: { postId } });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const failed = data?.results?.filter((r) => r.status === "failed") ?? [];
        if (data?.overallStatus === "published") {
          toast.success("Published to all selected platforms");
        } else if (data?.overallStatus === "partially_failed") {
          toast.warning(`Published, but failed on: ${failed.map((f) => f.platform).join(", ")}`);
          failed.forEach((f) => f.errorMessage && toast.error(`${f.platform}: ${f.errorMessage}`));
        } else {
          toast.error(failed[0]?.errorMessage || "Publishing failed on every selected platform");
        }
      } else {
        toast.success(status === "draft" ? "Draft saved" : "Post scheduled");
      }

      await logActivity.mutateAsync({
        action: status === "draft" ? "post_created" : status === "scheduled" ? "post_created" : "post_published",
        entityType: "post",
        entityId: postId,
      });

      navigate("/posts");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save post");
    } finally {
      setSaving(false);
    }
  };

  if (existingPost && manualPlatform(existingPost.tags)) return <Navigate to={`/manual-publish?id=${existingPost.id}`} replace />;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{scope.brandName}</p><h1 className="text-2xl font-semibold tracking-tight">{editingId ? "Edit post" : "Create platform-specific content"}</h1><p className="mt-2 text-sm text-muted-foreground">Choose this company's channels, then tailor the caption and media for each platform.</p></div>
      {scope.brandId === ALL_BRANDS && <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950">Choose a single brand using the workspace selector above before creating content.</p>}
      <p className="text-sm text-muted-foreground">Using a personal Facebook or Instagram account? <Link className="font-medium text-primary underline" to="/manual-publish">Prepare a manual publishing draft</Link>.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              <PlatformSelector accounts={accounts} selected={selectedAccountIds} onToggle={togglePlatform} />
            </CardContent>
          </Card>

          <AIComposeAssist
            onGenerated={({ caption, imageUrl }) => {
              setContent(caption);
              setMediaUrls((prev) => [...prev, imageUrl]);
            }}
          />

          <Card>
            <CardHeader><CardTitle className="text-base">Working draft · optional</CardTitle><p className="text-xs text-muted-foreground">Use this for ideas. Copy it to an individual platform only when you choose.</p></CardHeader>
            <CardContent className="pt-6">
              <PostEditor title={title} content={content} onTitleChange={setTitle} onContentChange={setContent} charLimit={charLimit} />
            </CardContent>
          </Card>

          {selectedPlatforms.map((platform) => {
            const config = getPlatformConfig(platform);
            const draft = platformPostContent({ title, content, media_urls: mediaUrls, platform_content: platformContent }, platform);
            const change = (updates: Partial<PlatformDraft>) => setPlatformContent((previous) => ({ ...previous, [platform]: { content: draft.content, title: draft.title ?? "", media_urls: draft.media_urls, ...updates } }));
            return <Card key={platform} className="overflow-hidden"><CardHeader><div className="flex items-center gap-2"><config.icon className="h-5 w-5" style={{ color: config.color }} /><CardTitle className="text-base">{config.label} content</CardTitle></div><p className="text-xs text-muted-foreground">Only used for your selected {config.label} account{selectedAccountIds.filter((id) => accounts.find((a) => a.id === id)?.platform === platform).length > 1 ? "s" : ""}.</p></CardHeader><CardContent className="space-y-4">
              <div><label htmlFor={`caption-${platform}`} className="text-sm font-medium">Caption / description</label><textarea id={`caption-${platform}`} value={draft.content} onChange={(e) => change({ content: e.target.value })} className="mt-2 min-h-32 w-full rounded-lg border bg-background p-3 text-sm" placeholder={`Write a caption for ${config.label}…`} /><p className="mt-1 text-right text-xs text-muted-foreground">{draft.content.length.toLocaleString()} / {config.characterLimit.toLocaleString()}</p></div>
              {platform === "youtube" && <div><label htmlFor="youtube-title" className="text-sm font-medium">YouTube video title</label><input id="youtube-title" value={draft.title ?? ""} maxLength={100} onChange={(e) => change({ title: e.target.value })} className="mt-2 w-full rounded-lg border bg-background p-2 text-sm" /></div>}
              <MediaUploader urls={draft.media_urls} onChange={(urls) => change({ media_urls: urls })} />
              <Button type="button" size="sm" variant="outline" onClick={() => change({ content, media_urls: mediaUrls, title })}>Copy working draft to {config.label}</Button>
            </CardContent></Card>;
          })}


          {selectedPlatforms.includes("whatsapp") && whatsappAccount && (
            <WhatsAppOptionsCard
              account={whatsappAccount}
              value={whatsappOptions}
              onChange={setWhatsappOptions}
              content={platformPostContent({ content, media_urls: mediaUrls, platform_content: platformContent }, "whatsapp").content}
              mediaUrls={platformPostContent({ content, media_urls: mediaUrls, platform_content: platformContent }, "whatsapp").media_urls}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Working draft media · optional</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaUploader urls={mediaUrls} onChange={setMediaUrls} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">When to publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button variant={scheduleMode === "now" ? "default" : "outline"} size="sm" onClick={() => setScheduleMode("now")}>
                  Publish now
                </Button>
                <Button variant={scheduleMode === "schedule" ? "default" : "outline"} size="sm" onClick={() => setScheduleMode("schedule")}>
                  Schedule for later
                </Button>
              </div>
              {scheduleMode === "schedule" && (
                <div className="space-y-1.5">
                  <Label>Date & time</Label>
                  <SchedulePicker date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <PostPreview platforms={selectedPlatforms} content={content} mediaUrls={mediaUrls} platformContent={platformContent} accounts={accounts.filter((account) => selectedAccountIds.includes(account.id))} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2 rounded-xl border bg-card p-3 shadow-lg">
        <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving || scope.brandId === ALL_BRANDS}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save draft
        </Button>
        {scheduleMode === "schedule" ? (
          <Button onClick={() => handleSave("scheduled")} disabled={saving || scope.brandId === ALL_BRANDS}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule
          </Button>
        ) : (
          <Button onClick={() => handleSave("published")} disabled={saving || scope.brandId === ALL_BRANDS}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish now
          </Button>
        )}
      </div>
    </div>
  );
}
