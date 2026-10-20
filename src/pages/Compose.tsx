import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { usePosts, usePost } from "@/hooks/usePosts";
import { useActivityLog } from "@/hooks/useActivityLog";
import { getPlatformCharLimit } from "@/lib/platforms";
import { supabase } from "@/lib/supabase";
import type { Platform, WhatsAppOptions } from "@/types/database";

export default function Compose() {
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
    if (content.length > charLimit) { toast.error(`Content exceeds the ${charLimit} character limit`); return; }
    if (!content.trim() && !mediaUrls.length) { toast.error("Add text or media to your post"); return; }
    if (status !== "draft") {
      if (selectedPlatforms.includes("instagram") && mediaUrls.length === 0) {
        toast.error("Instagram needs at least one image or video attached — it can't post text alone");
        return;
      }
      if (selectedPlatforms.includes("youtube") && !mediaUrls.some((u) => /\.(mp4|mov)$/i.test(u))) {
        toast.error("YouTube needs a video file attached (MP4 or MOV)");
        return;
      }
      if (selectedPlatforms.includes("whatsapp")) {
        const problem = isWhatsAppReady(whatsappAccount, whatsappOptions);
        if (problem) {
          toast.error(problem);
          return;
        }
        if (whatsappOptions.headerFormat && mediaUrls.length === 0) {
          toast.error(`This WhatsApp template needs an ${whatsappOptions.headerFormat.toLowerCase()} attached`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: title || null,
        content,
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{editingId ? "Edit post" : "Compose a post"}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AIComposeAssist
            onGenerated={({ caption, imageUrl }) => {
              setContent(caption);
              setMediaUrls((prev) => [...prev, imageUrl]);
            }}
          />

          <Card>
            <CardContent className="pt-6">
              <PostEditor title={title} content={content} onTitleChange={setTitle} onContentChange={setContent} charLimit={charLimit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              <PlatformSelector accounts={accounts} selected={selectedAccountIds} onToggle={togglePlatform} />
            </CardContent>
          </Card>

          {selectedPlatforms.includes("whatsapp") && whatsappAccount && (
            <WhatsAppOptionsCard
              account={whatsappAccount}
              value={whatsappOptions}
              onChange={setWhatsappOptions}
              content={content}
              mediaUrls={mediaUrls}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Media</CardTitle>
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
              <PostPreview platforms={selectedPlatforms} content={content} mediaUrls={mediaUrls} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2 rounded-xl border bg-card p-3 shadow-lg">
        <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving || !content}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save draft
        </Button>
        {scheduleMode === "schedule" ? (
          <Button onClick={() => handleSave("scheduled")} disabled={saving || !content}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule
          </Button>
        ) : (
          <Button onClick={() => handleSave("published")} disabled={saving || !content}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish now
          </Button>
        )}
      </div>
    </div>
  );
}
