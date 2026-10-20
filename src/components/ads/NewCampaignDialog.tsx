import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, truncateText } from "@/lib/utils";
import { useBoostablePosts, useCreateCampaign, type CreateCampaignInput } from "@/hooks/useAds";
import type { AdAccount, AdObjective } from "@/types/database";

const OBJECTIVES: { value: AdObjective; label: string }[] = [
  { value: "OUTCOME_AWARENESS", label: "Awareness — get seen by more people" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement — likes, comments, shares" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic — clicks to a link" },
  { value: "OUTCOME_LEADS", label: "Leads — sign-ups, inquiries" },
  { value: "OUTCOME_SALES", label: "Sales — conversions" },
];

const GENDER_OPTIONS = [
  { value: [0], label: "All" },
  { value: [1], label: "Men" },
  { value: [2], label: "Women" },
];

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewCampaignDialog({ adAccounts }: { adAccounts: AdAccount[] }) {
  const [open, setOpen] = useState(false);
  const { data: boostablePosts = [] } = useBoostablePosts();
  const createCampaign = useCreateCampaign();

  const [adAccountRowId, setAdAccountRowId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState<AdObjective>("OUTCOME_ENGAGEMENT");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [startDate, setStartDate] = useState(todayISODate());
  const [endDate, setEndDate] = useState("");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [genders, setGenders] = useState<number[]>([0]);
  const [countries, setCountries] = useState("US");
  const [creativeMode, setCreativeMode] = useState<"boost" | "new">("boost");
  const [boostPostId, setBoostPostId] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");

  const reset = () => {
    setCampaignName("");
    setBoostPostId("");
    setHeadline("");
    setBody("");
    setMediaUrl("");
    setDestinationUrl("");
  };

  const canSubmit =
    adAccountRowId &&
    campaignName.trim() &&
    Number(dailyBudget) > 0 &&
    (creativeMode === "boost" ? boostPostId : headline && body && mediaUrl && destinationUrl);

  const handleSubmit = () => {
    const boosted = boostablePosts.find((p) => p.resultId === boostPostId);
    const input: CreateCampaignInput = {
      adAccountRowId,
      campaign: { name: campaignName.trim(), objective },
      adSet: {
        name: `${campaignName.trim()} — ad set`,
        dailyBudgetCents: Math.round(Number(dailyBudget) * 100),
        startTime: new Date(startDate).toISOString(),
        endTime: endDate ? new Date(endDate).toISOString() : null,
        targeting: {
          ageMin: Number(ageMin),
          ageMax: Number(ageMax),
          genders,
          countries: countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
        },
      },
      ad: {
        name: `${campaignName.trim()} — ad`,
        ...(creativeMode === "boost"
          ? { postId: boosted?.platformPostId }
          : { headline, body, mediaUrl, destinationUrl, callToAction: "LEARN_MORE" }),
      },
    };
    createCampaign.mutate(input, {
      onSuccess: () => {
        setOpen(false);
        reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New campaign</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New ad campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Ad account</Label>
            <Select value={adAccountRowId} onValueChange={setAdAccountRowId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an ad account" />
              </SelectTrigger>
              <SelectContent>
                {adAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? a.meta_ad_account_id} {a.currency ? `(${a.currency})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Campaign name</Label>
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Spring promo" />
          </div>

          <div className="space-y-1.5">
            <Label>Objective</Label>
            <Select value={objective} onValueChange={(v) => setObjective(v as AdObjective)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Daily budget (USD)</Label>
              <Input type="number" min="1" step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Countries</Label>
              <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="US, CA, GB" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ends (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Age min</Label>
              <Input type="number" min="13" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Age max</Label>
              <Input type="number" min="13" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <div className="flex gap-1">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setGenders(g.value)}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium",
                      genders.join() === g.value.join() ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Creative</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={creativeMode === "boost" ? "default" : "outline"} onClick={() => setCreativeMode("boost")}>
                Boost an existing post
              </Button>
              <Button type="button" size="sm" variant={creativeMode === "new" ? "default" : "outline"} onClick={() => setCreativeMode("new")}>
                New ad creative
              </Button>
            </div>
          </div>

          {creativeMode === "boost" ? (
            <div className="space-y-1.5">
              <Label>Post to boost</Label>
              <Select value={boostPostId} onValueChange={setBoostPostId}>
                <SelectTrigger>
                  <SelectValue placeholder={boostablePosts.length === 0 ? "No published Facebook posts yet" : "Choose a post"} />
                </SelectTrigger>
                <SelectContent>
                  {boostablePosts.map((p) => (
                    <SelectItem key={p.resultId} value={p.resultId}>
                      {truncateText(p.title || p.content, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only posts successfully published to Facebook through this app can be boosted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label>Body text</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Image URL</Label>
                <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label>Destination URL</Label>
                <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createCampaign.isPending}>
            {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create (paused)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
