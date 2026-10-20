import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBridgeGroups, useWhatsAppContacts, useWhatsAppTemplates } from "@/hooks/useWhatsApp";
import { buildGroupShareUrl } from "@/lib/whatsapp";
import type { BridgePace, ConnectedAccount, WhatsAppOptions } from "@/types/database";

// Average gap between messages for each pace (the bridge picks a random value
// inside a range each time), used only for the "about how long" estimate.
const PACES: { value: BridgePace; label: string; hint: string; avgSeconds: number }[] = [
  { value: "safe", label: "Safe", hint: "30–90 s between messages. Lowest risk for your number.", avgSeconds: 60 },
  { value: "balanced", label: "Balanced", hint: "8–25 s between messages.", avgSeconds: 16.5 },
  { value: "fast", label: "Fast", hint: "2–6 s between messages. Higher risk of restrictions.", avgSeconds: 4 },
];

function formatDuration(seconds: number): string {
  if (seconds < 90) return "about a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `about ${hours} h${rest ? ` ${rest} min` : ""}`;
}

export function WhatsAppOptionsCard({
  account,
  value,
  onChange,
  content,
  mediaUrls,
}: {
  account: ConnectedAccount;
  value: WhatsAppOptions;
  onChange: (next: WhatsAppOptions) => void;
  content: string;
  mediaUrls: string[];
}) {
  const bridge = account.metadata?.mode === "bridge";
  const { data: contacts = [] } = useWhatsAppContacts(account.id);

  const tags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const audienceCount = contacts.filter((c) => c.opted_in && (!value.tag || c.tags.includes(value.tag))).length;
  const set = (patch: Partial<WhatsAppOptions>) => onChange({ ...value, ...patch });

  const audience = (
    <div className="space-y-1.5">
      <Label>Customer list</Label>
      <Select value={value.tag ?? "all"} onValueChange={(v) => set({ tag: v === "all" ? null : v })}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All opted-in contacts</SelectItem>
          {tags.map((t) => (
            <SelectItem key={t} value={t}>
              Tag: {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {audienceCount} opted-in contact{audienceCount === 1 ? "" : "s"}.{" "}
        <Link to={`/whatsapp?account=${account.id}`} className="font-medium text-primary hover:underline">
          Manage contacts
        </Link>
      </p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bridge ? (
          <BridgeOptions account={account} value={value} set={set} audience={audience} audienceCount={audienceCount} />
        ) : (
          <CloudOptions account={account} value={value} set={set} audience={audience} />
        )}

        <div className="border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!content.trim()}
            onClick={() => window.open(buildGroupShareUrl(content, mediaUrls), "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Share to a group myself
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Opens WhatsApp with this post ready to send. You pick the group and tap send.
            {!bridge && " The official Cloud API can't post into groups, so this is how you reach them."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CloudOptions({
  account,
  value,
  set,
  audience,
}: {
  account: ConnectedAccount;
  value: WhatsAppOptions;
  set: (patch: Partial<WhatsAppOptions>) => void;
  audience: React.ReactNode;
}) {
  const { data: templates = [], isLoading, error } = useWhatsAppTemplates(account.id);
  const chosen = templates.find((t) => t.name === value.templateName && t.language === value.language);

  return (
    <>
      <div className="space-y-1.5">
        <Label>Message template</Label>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your approved templates…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load templates"}</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved templates yet. WhatsApp only lets businesses start conversations with templates — create one in Meta's
            WhatsApp Manager and wait for approval. A template with one variable, like "Hi! {"{{1}}"}", works best.
          </p>
        ) : (
          <Select
            value={chosen ? `${chosen.name}|${chosen.language}` : undefined}
            onValueChange={(v) => {
              const [name, language] = v.split("|");
              const t = templates.find((x) => x.name === name && x.language === language);
              if (t) set({ templateName: t.name, language: t.language, headerFormat: t.headerFormat, bodyParamCount: t.bodyParamCount });
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`} disabled={!t.supported}>
                  {t.name} ({t.language}){!t.supported && ` — ${t.unsupportedReason}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {chosen && (
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            {chosen.bodyText}
            {chosen.bodyParamCount === 1 && "\n\nThe variable is replaced with your post text."}
            {chosen.headerFormat && `\n\nNeeds an ${chosen.headerFormat.toLowerCase()} attached to this post.`}
          </p>
        )}
      </div>
      {audience}
    </>
  );
}

function BridgeOptions({
  account,
  value,
  set,
  audience,
  audienceCount,
}: {
  account: ConnectedAccount;
  value: WhatsAppOptions;
  set: (patch: Partial<WhatsAppOptions>) => void;
  audience: React.ReactNode;
  audienceCount: number;
}) {
  const { data: groups = [], isLoading, error, refetch, isFetching } = useBridgeGroups(account.id, true);
  const [filter, setFilter] = useState("");
  const selected = value.groups ?? [];
  const pace = value.pace ?? "balanced";
  const paceInfo = PACES.find((p) => p.value === pace)!;

  const recipients = (value.includeContacts ? audienceCount : 0) + selected.length;
  const visible = groups.filter((g) => g.name.toLowerCase().includes(filter.trim().toLowerCase()));

  function toggleGroup(id: string, name: string, checked: boolean) {
    set({ groups: checked ? [...selected, { id, name }] : selected.filter((g) => g.id !== id) });
  }

  return (
    <>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox checked={Boolean(value.includeContacts)} onCheckedChange={(v) => set({ includeContacts: v === true })} />
          Send to my customers
        </label>
        {value.includeContacts && audience}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Groups ({selected.length} selected)</Label>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your groups…
          </p>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load groups"}{" "}
            <Link to={`/whatsapp?account=${account.id}`} className="font-medium text-primary hover:underline">
              Open WhatsApp tab
            </Link>
          </p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">This number isn't in any WhatsApp groups.</p>
        ) : (
          <>
            {groups.length > 8 && <Input className="h-8" placeholder="Search groups" value={filter} onChange={(e) => setFilter(e.target.value)} />}
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {visible.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                  <Checkbox
                    checked={selected.some((s) => s.id === g.id)}
                    onCheckedChange={(v) => toggleGroup(g.id, g.name, v === true)}
                  />
                  <span className="truncate">{g.name || "(unnamed group)"}</span>
                  {g.size != null && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{g.size}</span>}
                </label>
              ))}
              {visible.length === 0 && <p className="p-1 text-xs text-muted-foreground">No groups match.</p>}
            </div>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Sending pace</Label>
        <Select value={pace} onValueChange={(v) => set({ pace: v as BridgePace })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {paceInfo.hint}
          {recipients > 1 && ` ${recipients} recipients will take ${formatDuration((recipients - 1) * paceInfo.avgSeconds)}.`} It
          keeps sending in the background after you leave this page.
        </p>
      </div>
    </>
  );
}
