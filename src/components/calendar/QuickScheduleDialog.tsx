import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlatformSelector } from "@/components/composer/PlatformSelector";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { usePosts } from "@/hooks/usePosts";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import type { Platform } from "@/types/database";

export function QuickScheduleDialog({
  date,
  open,
  onOpenChange,
}: {
  date: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: accounts = [] } = useConnectedAccounts();
  const { createPost } = usePosts();

  const [title, setTitle] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const platforms = [...new Set(accounts.filter((a) => selectedAccountIds.includes(a.id)).map((a) => a.platform))] as Platform[];
  const [time, setTime] = useState("09:00");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setWebsiteUrl("");
    setCaption("");
    setImageUrl(null);
    setSelectedAccountIds([]);
    setTime("09:00");
  };

  const togglePlatform = (accountId: string) => {
    setSelectedAccountIds((prev) => (prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]));
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error("Enter a title or topic first");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ caption?: string; imageUrl?: string; error?: string }>(
        "generate-post",
        { body: { title, websiteUrl } },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.caption || !data?.imageUrl) throw new Error("AI generation returned nothing usable");
      setCaption(data.caption);
      setImageUrl(data.imageUrl);
      toast.success("Generated — review below before scheduling");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (!date) return;
    if (!caption.trim()) {
      toast.error("Generate or write a caption first");
      return;
    }
    if (platforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    setSaving(true);
    try {
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledAt = new Date(date);
      scheduledAt.setHours(hours, minutes, 0, 0);
      if (scheduledAt.getTime() <= Date.now()) { toast.error("Choose a scheduling time in the future"); return; }

      await createPost.mutateAsync({
        title: title || null,
        content: caption,
        media_urls: imageUrl ? [imageUrl] : [],
        platforms,
        connected_account_ids: selectedAccountIds,
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
      });
      onOpenChange(false);
      reset();
    } catch {
      // createPost's own onError already toasts
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule a post {date && `for ${formatDate(date)}`}</DialogTitle>
          <DialogDescription>
            Give it a title and let AI draft the caption and image, or write your own below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qs-title">Title / topic</Label>
            <Input id="qs-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend sale announcement" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qs-url">Website URL (optional)</Label>
            <Input id="qs-url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <Button variant="outline" onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? "Generating…" : "Generate with AI"}
          </Button>

          {imageUrl && <img src={imageUrl} alt="" className="aspect-video w-full rounded-lg object-cover" />}

          <div className="space-y-1.5">
            <Label htmlFor="qs-caption">Caption</Label>
            <Textarea
              id="qs-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Caption appears here after generating, or write your own"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Platforms</Label>
            <PlatformSelector accounts={accounts} selected={selectedAccountIds} onToggle={togglePlatform} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qs-time">Time on {date ? formatDate(date) : "the selected day"}</Label>
            <input
              id="qs-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
