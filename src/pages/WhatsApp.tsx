import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BridgeLinkPanel } from "@/components/whatsapp/BridgeLinkPanel";
import { useScopedAccounts as useConnectedAccounts } from "@/contexts/BrandContext";
import { NewBroadcastDialog } from "@/components/whatsapp/NewBroadcastDialog";
import { useBridgeGroups, useWhatsAppBroadcasts, useWhatsAppContacts } from "@/hooks/useWhatsApp";
import { parseContactLines } from "@/lib/whatsapp";
import { getRelativeTime } from "@/lib/utils";

const ROW_LIMIT = 200;

function ContactsTab({ accountId }: { accountId: string }) {
  const { data: contacts = [], isLoading, addContacts, setOptedIn, removeContact } = useWhatsAppContacts(accountId);
  const [text, setText] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [source, setSource] = useState("Customer list");
  const [consent, setConsent] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");

  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const optedInCount = contacts.filter((c) => c.opted_in).length;

  const visible = contacts.filter((c) => {
    if (tagFilter !== "all" && !c.tags.includes(tagFilter)) return false;
    const q = search.trim().toLowerCase();
    return !q || c.phone.includes(q) || (c.name ?? "").toLowerCase().includes(q);
  });

  function handleAdd() {
    const { rows, invalid, duplicates } = parseContactLines(text, countryCode);
    if (rows.length === 0) {
      toast.error(
        invalid.length
          ? "None of those numbers look valid — include the country code, e.g. 919876543210"
          : "Paste at least one phone number",
      );
      return;
    }
    if (invalid.length) toast.warning(`Skipped ${invalid.length} invalid line${invalid.length === 1 ? "" : "s"}`);
    if (duplicates) toast.info(`Ignored ${duplicates} duplicate number${duplicates === 1 ? "" : "s"}`);
    addContacts.mutate(
      { rows, source: source.trim() || "Manual entry" },
      { onSuccess: () => setText("") },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={5}
            placeholder={"919876543210, Priya, vip;diwali\n919812345678, Arjun\n919800000000"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary hover:underline">
            <Upload className="h-3.5 w-3.5" />
            Upload a CSV or text file
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const contents = await file.text();
                setText((prev) => (prev ? prev + "\n" : "") + contents);
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            One per line: phone, name, tags (separate tags with ;). You can paste straight from a spreadsheet. Numbers need
            the country code unless you set a default below.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wa-cc">Default country code (optional)</Label>
              <Input id="wa-cc" inputMode="numeric" placeholder="e.g. 91" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-source">Where did they opt in?</Label>
              <Input id="wa-source" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>
              I confirm these people agreed to receive WhatsApp messages from my business. WhatsApp can restrict numbers that
              message people who haven't opted in.
            </span>
          </label>
          <Button onClick={handleAdd} disabled={!consent || !text.trim() || addContacts.isPending}>
            {addContacts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add contacts
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Contacts <Badge variant="secondary">{optedInCount} opted in</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Input className="h-8 w-44" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No contacts yet. Add your opted-in customers above.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.slice(0, ROW_LIMIT).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name ?? <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="font-mono text-xs">+{c.phone}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <Badge key={t} variant="outline">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          title={c.opted_in ? "Click to mark as opted out" : "Click to confirm they opted back in"}
                          onClick={() => setOptedIn.mutate({ id: c.id, optedIn: !c.opted_in })}
                        >
                          <Badge variant={c.opted_in ? "secondary" : "destructive"}>{c.opted_in ? "Opted in" : "Opted out"}</Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeContact.mutate(c.id)}
                          title="Delete contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {visible.length > ROW_LIMIT && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Showing {ROW_LIMIT} of {visible.length}. Use search or a tag to narrow the list.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const STATUS_VARIANT = {
  sending: "secondary",
  completed: "default",
  partial: "outline",
  failed: "destructive",
} as const;

function GroupsTab({ accountId }: { accountId: string }) {
  const { data: groups = [], isLoading, error, refetch, isFetching } = useBridgeGroups(accountId, true);
  const [filter, setFilter] = useState("");
  const shown = groups.filter((g) => g.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">
          Your WhatsApp groups <Badge variant="secondary">{groups.length}</Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Input className="h-8 w-44" placeholder="Search groups" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load groups"}
          </p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">This number isn't in any WhatsApp groups.</p>
        ) : (
          <div className="divide-y">
            {shown.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{g.name || "(unnamed group)"}</span>
                {g.size != null && <span className="text-xs text-muted-foreground">{g.size} members</span>}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Choose groups when you compose a post or start a New broadcast. Posts go out one message at a time at the pace you pick.
        </p>
      </CardContent>
    </Card>
  );
}

const PACE_LABEL = { safe: "Safe pace", balanced: "Balanced pace", fast: "Fast pace" } as const;

function BroadcastsTab({ accountId }: { accountId: string }) {
  const { data: broadcasts = [], isLoading, resume, cancel } = useWhatsAppBroadcasts(accountId);

  if (isLoading) return <Skeleton className="h-40" />;
  if (broadcasts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No broadcasts yet. Pick WhatsApp as a platform when you{" "}
        <Link to="/compose" className="font-medium text-primary hover:underline">
          compose a post
        </Link>{" "}
        and it will go to your opted-in contacts.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {broadcasts.map((b) => {
        const s = b.stats;
        const pending = s?.pending ?? 0;
        const queued = s?.queued ?? 0;
        const failed = s?.failed ?? 0;
        const bridge = b.mode === "bridge";
        const busy =
          (resume.isPending && resume.variables?.broadcastId === b.id) || (cancel.isPending && cancel.variables === b.id);
        return (
          <Card key={b.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                <span className="text-sm font-medium">
                  {bridge
                    ? `QR session${b.group_count ? ` · ${b.group_count} group${b.group_count === 1 ? "" : "s"}` : ""}`
                    : b.template_name}
                </span>
                {bridge && b.bridge_pace && <Badge variant="outline">{PACE_LABEL[b.bridge_pace]}</Badge>}
                {b.audience_tag && <Badge variant="outline">tag: {b.audience_tag}</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{getRelativeTime(b.created_at)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{b.message_text}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span>{b.total} recipients</span>
                <span>{(s?.sent ?? 0) + (s?.delivered ?? 0) + (s?.read ?? 0)} sent</span>
                {!bridge && <span>{(s?.delivered ?? 0) + (s?.read ?? 0)} delivered</span>}
                {!bridge && <span>{s?.read ?? 0} read</span>}
                {failed > 0 && <span className="text-destructive">{failed} failed</span>}
                {queued > 0 && <span className="text-sky-500">{queued} queued, sending gradually</span>}
                {pending > 0 && <span className="text-amber-500">{pending} pending</span>}
              </div>
              {(pending > 0 || queued > 0 || failed > 0) && (
                <div className="flex flex-wrap gap-2">
                  {(pending > 0 || queued > 0) && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => cancel.mutate(b.id)}>
                      Stop sending
                    </Button>
                  )}
                  {pending > 0 && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => resume.mutate({ broadcastId: b.id })}>
                      {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                      Send remaining
                    </Button>
                  )}
                  {failed > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => resume.mutate({ broadcastId: b.id, retryFailed: true })}
                    >
                      Retry failed
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function WhatsApp() {
  const { data: accounts = [], isLoading } = useConnectedAccounts();
  const [params, setParams] = useSearchParams();
  const waAccounts = accounts.filter((a) => a.platform === "whatsapp");
  const selected = waAccounts.find((a) => a.id === params.get("account")) ?? waAccounts[0];
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const isBridge = selected?.metadata?.mode === "bridge";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        {selected && (
          <Button size="sm" onClick={() => setBroadcastOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            New broadcast
          </Button>
        )}
        {waAccounts.length > 1 && selected && (
          <Select value={selected.id} onValueChange={(id) => setParams({ account: id })}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {waAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.platform_display_name} {a.platform_username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !selected ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No WhatsApp number connected yet.{" "}
          <Link to="/accounts" className="font-medium text-primary hover:underline">
            Connect one
          </Link>{" "}
          to manage contacts and send broadcasts.
        </p>
      ) : (
        <Tabs defaultValue="contacts">
          {selected.metadata?.mode === "bridge" && <BridgeLinkPanel accountId={selected.id} />}
          <TabsList className="mt-4">
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            {isBridge && <TabsTrigger value="groups">Groups</TabsTrigger>}
            <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
          </TabsList>
          {isBridge && (
            <TabsContent value="groups" className="mt-4">
              <GroupsTab accountId={selected.id} />
            </TabsContent>
          )}
          <TabsContent value="contacts" className="mt-4">
            <ContactsTab accountId={selected.id} />
          </TabsContent>
          <TabsContent value="broadcasts" className="mt-4">
            <BroadcastsTab accountId={selected.id} />
          </TabsContent>
        </Tabs>
      )}

      {selected && <NewBroadcastDialog account={selected} open={broadcastOpen} onOpenChange={setBroadcastOpen} />}
    </div>
  );
}
