import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export function AIComposeAssist({
  onGenerated,
}: {
  onGenerated: (result: { caption: string; imageUrl: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error("Enter a title or topic first");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        caption?: string;
        imageUrl?: string;
        error?: string;
      }>("generate-post", { body: { title, websiteUrl } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.caption || !data?.imageUrl) throw new Error("AI generation returned nothing usable");

      onGenerated({ caption: data.caption, imageUrl: data.imageUrl });
      toast.success("Caption and image generated — review before publishing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> AI assist
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Give it a title and it drafts a caption and image below — nothing publishes until you review and click
          Publish yourself.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ai-title">Title / topic</Label>
          <Input
            id="ai-title"
            placeholder="e.g. Launching our new winter collection"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-url">Website URL (optional)</Label>
          <Input
            id="ai-url"
            placeholder="https://example.com/product"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="w-full">
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {generating ? "Generating…" : "Generate with AI"}
        </Button>
      </CardContent>
    </Card>
  );
}
