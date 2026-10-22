import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { functionError } from "@/lib/functionError";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export function AIComposeAssist({
  onGenerated,
}: {
  onGenerated: (result: { caption: string; imageUrl?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [withImage, setWithImage] = useState(false);
  const { user } = useAuth();
  const cache = useQueryClient();
  const usage = useQuery({queryKey:["ai-usage",user?.id],enabled:Boolean(user),retry:false,staleTime:30000,queryFn:async () => {
    const {data,error} = await supabase.functions.invoke<{usage:{used:number;limit:number;resetAt:string}}>("generate-post",{body:{usageOnly:true}});
    if (error) throw new Error(await functionError(error,"AI usage could not load"));
    if (!data?.usage) throw new Error("AI usage is unavailable");
    return data.usage;
  }});

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
        warning?: string;
        error?: string;
      }>("generate-post", { body: { title, websiteUrl, withImage } });
      if (error) throw new Error(await functionError(error,"AI generation failed"));
      if (data?.error) throw new Error(data.error);
      if (!data?.caption) throw new Error("AI generation returned no caption");

      onGenerated({ caption: data.caption, imageUrl: data.imageUrl });
      toast.success("Working draft generated — review it and copy to your chosen channels");
      if (data.warning) toast.warning(data.warning);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI generation failed");
    } finally {
      setGenerating(false);
      void cache.invalidateQueries({queryKey:["ai-usage",user?.id]});
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> AI assist
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Generate a fast caption first. Add an optional image, then review the draft before publishing. A website URL is included as a link; this tool does not read the website.
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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withImage} onChange={event => setWithImage(event.target.checked)} disabled={generating}/>Also generate an image (takes longer)</label>
        {usage.data && <p className="text-xs text-muted-foreground">{usage.data.used}/{usage.data.limit} AI requests used this hour · resets {new Date(usage.data.resetAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}. Attempts count even if a provider fails.</p>}
        {usage.error && <p className="text-xs text-destructive">{usage.error.message}</p>}
        <Button onClick={handleGenerate} disabled={generating || Boolean(usage.data && usage.data.used >= usage.data.limit)} className="w-full">
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {generating ? (withImage ? "Generating caption and image…" : "Drafting caption…") : withImage ? "Generate caption & image" : "Generate caption"}
        </Button>
      </CardContent>
    </Card>
  );
}
