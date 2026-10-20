// WhatsApp helpers shared by the whatsapp Edge Function (connect / templates /
// bridge control / broadcast resume / cancel), publish.ts (so a composed post
// can target WhatsApp like any other platform, including scheduled posts),
// sync.ts and whatsapp-webhook.
//
// An account is in one of two modes, recorded in metadata.mode:
//   cloud   (default) the official WhatsApp Business Cloud API. Messages are
//           approved *templates* sent to opted-in contacts, directly from here.
//   bridge  the user's own whatsapp-bridge service, linked to their number by
//           QR code. Free-form text and media go to contacts AND groups, but
//           the sending is done by the bridge (one message at a time, paced
//           like a person) and results come back through whatsapp-webhook.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptToken } from "./crypto.ts";

export const GRAPH_VERSION = "v21.0";

// Cloud mode: parallel sends per chunk and the wall-clock budget one
// invocation spends sending. Anything not sent by then stays 'pending' and is
// picked up by the resume action instead of the Edge Function timing out.
const SEND_CONCURRENCY = 20;
const SEND_TIME_BUDGET_MS = 100_000;

// Bridge mode: the bridge accepts at most this many targets per job, and a
// QR-linked number shouldn't be blasting more than this at once anyway.
export const BRIDGE_MAX_TARGETS = 2000;

export type BridgePace = "safe" | "balanced" | "fast";

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
  bodyText: string;
  headerFormat: "IMAGE" | "VIDEO" | null;
  bodyParamCount: 0 | 1;
  supported: boolean;
  unsupportedReason?: string;
}

// What a post's whatsapp_options column holds. Cloud posts use the template
// fields; bridge posts use the audience fields. Mirrors WhatsAppOptions in
// src/types/database.ts.
export interface WhatsAppOptions {
  templateName?: string;
  language?: string;
  headerFormat?: "IMAGE" | "VIDEO" | null;
  bodyParamCount?: 0 | 1;
  tag?: string | null;
  includeContacts?: boolean;
  groups?: { id: string; name: string }[];
  pace?: BridgePace;
}

// deno-lint-ignore no-explicit-any
type Db = SupabaseClient<any>;
// deno-lint-ignore no-explicit-any
type Account = any;

export function isBridgeAccount(account: Account): boolean {
  return account?.metadata?.mode === "bridge";
}

// Template body variables can't contain newlines, tabs, or 5+ consecutive
// spaces, and are capped at 1024 chars — Meta rejects the whole send
// otherwise, so a multi-paragraph post is flattened onto one line here.
export function sanitizeTemplateParam(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {5,}/g, "    ")
    .trim()
    .slice(0, 1024);
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  return /^[0-9]{8,15}$/.test(digits) ? digits : null;
}

// ============================================================
// Cloud API
// ============================================================

async function graphGet(path: string, token: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? `WhatsApp API error (${res.status})`);
  return json;
}

export async function getPhoneNumberInfo(phoneNumberId: string, token: string) {
  return await graphGet(
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`,
    token,
  );
}

export async function assertPhoneBelongsToWaba(wabaId: string, phoneNumberId: string, token: string) {
  const json = await graphGet(`${wabaId}/phone_numbers?fields=id&limit=100`, token);
  const ids = (json.data ?? []).map((p: { id: string }) => p.id);
  if (!ids.includes(phoneNumberId)) {
    throw new Error("That Phone Number ID doesn't belong to this WhatsApp Business Account ID");
  }
}

export async function listApprovedTemplates(wabaId: string, token: string): Promise<WhatsAppTemplate[]> {
  const json = await graphGet(
    `${wabaId}/message_templates?fields=name,language,status,category,components&status=APPROVED&limit=200`,
    token,
  );
  // deno-lint-ignore no-explicit-any
  return ((json.data ?? []) as any[]).map((t) => {
    // deno-lint-ignore no-explicit-any
    const components = (t.components ?? []) as any[];
    const header = components.find((c) => c.type === "HEADER");
    const body = components.find((c) => c.type === "BODY");
    const buttons = components.find((c) => c.type === "BUTTONS");
    const bodyText: string = body?.text ?? "";
    const vars = new Set([...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]));

    let unsupportedReason: string | undefined;
    if (vars.size > 1) unsupportedReason = "Uses more than one variable — a post only fills one";
    else if (components.some((c) => !["HEADER", "BODY", "FOOTER", "BUTTONS"].includes(c.type))) {
      unsupportedReason = "Uses a carousel/offer layout that isn't supported yet";
    } else if (header && header.format === "TEXT" && /\{\{/.test(header.text ?? "")) {
      unsupportedReason = "Has a header variable";
    } else if (header && ["DOCUMENT", "LOCATION"].includes(header.format)) {
      unsupportedReason = `Has a ${String(header.format).toLowerCase()} header`;
    // deno-lint-ignore no-explicit-any
    } else if (buttons?.buttons?.some((b: any) => /\{\{/.test(b.url ?? ""))) {
      unsupportedReason = "Has a button with a dynamic link";
    }

    const headerFormat = header && (header.format === "IMAGE" || header.format === "VIDEO") ? header.format : null;
    return {
      name: t.name,
      language: t.language,
      category: t.category,
      bodyText,
      headerFormat,
      bodyParamCount: (vars.size === 1 ? 1 : 0) as 0 | 1,
      supported: !unsupportedReason,
      unsupportedReason,
    };
  });
}

export async function sendTemplateMessage(args: {
  phoneNumberId: string;
  token: string;
  to: string;
  options: WhatsAppOptions;
  text: string;
  mediaUrl: string | null;
}): Promise<string> {
  const { phoneNumberId, token, to, options, text, mediaUrl } = args;
  // deno-lint-ignore no-explicit-any
  const components: any[] = [];
  if (options.headerFormat) {
    if (!mediaUrl) throw new Error(`This template needs an ${options.headerFormat.toLowerCase()} attached to the post`);
    const key = options.headerFormat === "IMAGE" ? "image" : "video";
    components.push({ type: "header", parameters: [{ type: key, [key]: { link: mediaUrl } }] });
  }
  if (options.bodyParamCount === 1) {
    components.push({ type: "body", parameters: [{ type: "text", text: sanitizeTemplateParam(text) }] });
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: options.templateName, language: { code: options.language }, components },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? `WhatsApp send failed (${res.status})`);
  return json.messages?.[0]?.id ?? "";
}

// ============================================================
// Bridge
// ============================================================

// The hosted bridge is one shared service run by the SocialVerse operator,
// reached with two project secrets. Users never see or enter either.
export function bridgeKey(): string {
  const key = Deno.env.get("WHATSAPP_BRIDGE_KEY");
  if (!key) throw new Error("WhatsApp QR linking isn't set up on this server yet (WHATSAPP_BRIDGE_KEY is missing)");
  return key;
}

export async function bridgeRequest(
  path: string,
  init: { method?: string; body?: unknown } = {},
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const base = Deno.env.get("WHATSAPP_BRIDGE_URL");
  if (!base) throw new Error("WhatsApp QR linking isn't set up on this server yet (WHATSAPP_BRIDGE_URL is missing)");
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${bridgeKey()}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("isn't set up")) throw error;
    throw new Error("The WhatsApp service is unreachable right now. Please try again in a moment.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `WhatsApp service error (${res.status})`);
  return json;
}

export const sessionPath = (account: Account, op: string) => `/api/sessions/${account.id}/${op}`;

function webhookUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/whatsapp-webhook`;
}

// ============================================================
// Broadcast bookkeeping (both modes)
// ============================================================

export interface BroadcastCounts {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  queued: number;
}

export async function countRecipients(db: Db, broadcastId: string): Promise<BroadcastCounts> {
  const counts: BroadcastCounts = { total: 0, sent: 0, failed: 0, pending: 0, queued: 0 };
  for (const status of ["pending", "queued", "sent", "delivered", "read", "failed"] as const) {
    const { count } = await db
      .from("sv_whatsapp_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .eq("status", status);
    const n = count ?? 0;
    counts.total += n;
    if (status === "pending") counts.pending += n;
    else if (status === "queued") counts.queued += n;
    else if (status === "failed") counts.failed += n;
    else counts.sent += n;
  }
  return counts;
}

// Once nothing is still waiting to go out, the broadcast's status follows
// from how the rest ended.
export async function settleBroadcast(db: Db, broadcastId: string): Promise<BroadcastCounts> {
  const counts = await countRecipients(db, broadcastId);
  if (counts.pending === 0 && counts.queued === 0) {
    const status = counts.sent === 0 ? "failed" : counts.failed > 0 ? "partial" : "completed";
    await db.from("sv_whatsapp_broadcasts").update({ status }).eq("id", broadcastId);
  }
  return counts;
}

// ============================================================
// Cloud broadcast sending
// ============================================================

// Sends every still-pending recipient of a cloud broadcast until the time
// budget runs out, then settles the broadcast's status from the real counts.
async function runCloudBroadcast(
  db: Db,
  // deno-lint-ignore no-explicit-any
  broadcast: any,
  account: Account,
): Promise<BroadcastCounts> {
  if (!account.access_token_ciphertext || !account.token_iv) {
    throw new Error("Reconnect WhatsApp — its access token is missing");
  }
  const token = await decryptToken(account.access_token_ciphertext, account.token_iv);
  const options: WhatsAppOptions = {
    templateName: broadcast.template_name,
    language: broadcast.template_language,
    headerFormat: broadcast.header_format,
    bodyParamCount: broadcast.body_param_count,
  };
  const started = Date.now();

  while (Date.now() - started < SEND_TIME_BUDGET_MS) {
    const { data: batch, error } = await db
      .from("sv_whatsapp_recipients")
      .select("id, phone")
      .eq("broadcast_id", broadcast.id)
      .eq("status", "pending")
      .limit(SEND_CONCURRENCY);
    if (error) throw new Error(error.message);
    if (!batch || batch.length === 0) break;

    await Promise.all(
      batch.map(async (r: { id: string; phone: string }) => {
        try {
          const messageId = await sendTemplateMessage({
            phoneNumberId: account.platform_user_id,
            token,
            to: r.phone,
            options,
            text: broadcast.message_text,
            mediaUrl: broadcast.media_url,
          });
          await db
            .from("sv_whatsapp_recipients")
            .update({ status: "sent", wa_message_id: messageId, updated_at: new Date().toISOString() })
            .eq("id", r.id);
        } catch (e) {
          await db
            .from("sv_whatsapp_recipients")
            .update({
              status: "failed",
              error_message: e instanceof Error ? e.message : String(e),
              updated_at: new Date().toISOString(),
            })
            .eq("id", r.id);
        }
      }),
    );
  }
  return await settleBroadcast(db, broadcast.id);
}

// ============================================================
// Bridge broadcast sending
// ============================================================

// Hands recipients to the bridge as one paced job. They move to 'queued' once
// the bridge has accepted them; from then on the bridge reports each result.
async function submitBridgeJob(
  db: Db,
  // deno-lint-ignore no-explicit-any
  broadcast: any,
  account: Account,
  recipients: { id: string; phone: string; name?: string | null }[],
  jobId: string,
) {
  await bridgeRequest("/api/jobs", {
    method: "POST",
    body: {
      jobId,
      accountId: account.id,
      callbackUrl: webhookUrl(),
      text: broadcast.message_text,
      mediaUrl: broadcast.media_url,
      pace: broadcast.bridge_pace ?? "balanced",
      targets: recipients.map((r) => ({ id: r.id, to: r.phone, name: r.name ?? "" })),
    },
  });
  const ids = recipients.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    await db
      .from("sv_whatsapp_recipients")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .in("id", ids.slice(i, i + 200))
      .eq("status", "pending");
  }
}

// Continues a bridge broadcast. Pending recipients exist only when the first
// hand-off to the bridge failed (or a retry was requested), and the bridge
// treats a job id it already knows as a no-op — so it's checked first, to
// avoid double-sending when the bridge got the job but its reply was lost.
export async function resumeBridgeBroadcast(
  db: Db,
  // deno-lint-ignore no-explicit-any
  broadcast: any,
  account: Account,
): Promise<BroadcastCounts> {
  const { data: pending } = await db
    .from("sv_whatsapp_recipients")
    .select("id, phone, contact_id")
    .eq("broadcast_id", broadcast.id)
    .eq("status", "pending")
    .limit(BRIDGE_MAX_TARGETS);
  if (pending && pending.length > 0) {
    const names = await contactNames(db, pending.map((p: { contact_id: string | null }) => p.contact_id));
    const recipients = pending.map((p: { id: string; phone: string; contact_id: string | null }) => ({
      id: p.id,
      phone: p.phone,
      name: p.contact_id ? names.get(p.contact_id) ?? null : null,
    }));
    let known = true;
    try {
      await bridgeRequest(`/api/jobs/${broadcast.id}`);
    } catch (e) {
      if (e instanceof Error && /not found/i.test(e.message)) known = false;
      else throw e;
    }
    if (known) {
      // The bridge already has this job: the recipients just never got marked.
      await db
        .from("sv_whatsapp_recipients")
        .update({ status: "queued", updated_at: new Date().toISOString() })
        .eq("broadcast_id", broadcast.id)
        .eq("status", "pending");
    } else {
      await submitBridgeJob(db, broadcast, account, recipients, broadcast.id);
    }
    await db.from("sv_whatsapp_broadcasts").update({ status: "sending" }).eq("id", broadcast.id);
  }
  return await settleBroadcast(db, broadcast.id);
}

// Re-sends only the recipients that failed, as a brand-new bridge job (the
// original job id is finished, and reusing it would be ignored).
export async function retryBridgeFailures(
  db: Db,
  // deno-lint-ignore no-explicit-any
  broadcast: any,
  account: Account,
): Promise<BroadcastCounts> {
  const { data: failed } = await db
    .from("sv_whatsapp_recipients")
    .select("id, phone, contact_id")
    .eq("broadcast_id", broadcast.id)
    .eq("status", "failed")
    .limit(BRIDGE_MAX_TARGETS);
  if (failed && failed.length > 0) {
    const ids = failed.map((f: { id: string }) => f.id);
    await db
      .from("sv_whatsapp_recipients")
      .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
      .in("id", ids);
    const names = await contactNames(db, failed.map((f: { contact_id: string | null }) => f.contact_id));
    await submitBridgeJob(
      db,
      broadcast,
      account,
      failed.map((f: { id: string; phone: string; contact_id: string | null }) => ({
        id: f.id,
        phone: f.phone,
        name: f.contact_id ? names.get(f.contact_id) ?? null : null,
      })),
      crypto.randomUUID(),
    );
    await db.from("sv_whatsapp_broadcasts").update({ status: "sending" }).eq("id", broadcast.id);
  }
  return await settleBroadcast(db, broadcast.id);
}

async function contactNames(db: Db, ids: (string | null)[]): Promise<Map<string, string | null>> {
  const wanted = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const names = new Map<string, string | null>();
  for (let i = 0; i < wanted.length; i += 200) {
    const { data } = await db.from("sv_whatsapp_contacts").select("id, name").in("id", wanted.slice(i, i + 200));
    for (const c of data ?? []) names.set(c.id, c.name);
  }
  return names;
}

// Stops a bridge broadcast: asks the bridge to drop what it hasn't sent, then
// marks everything still waiting here as failed so nothing looks stuck.
export async function cancelBridgeBroadcast(
  db: Db,
  // deno-lint-ignore no-explicit-any
  broadcast: any,
  account: Account,
): Promise<BroadcastCounts> {
  try {
    await bridgeRequest(`/api/jobs/${broadcast.id}/cancel`, { method: "POST", body: {} });
  } catch {
    // The bridge may be down or have already finished the job; either way the
    // local state below is what the user needs to see.
  }
  await db
    .from("sv_whatsapp_recipients")
    .update({ status: "failed", error_message: "Cancelled before sending", updated_at: new Date().toISOString() })
    .eq("broadcast_id", broadcast.id)
    .in("status", ["pending", "queued"]);
  return await settleBroadcast(db, broadcast.id);
}

// Applies a signed callback from the bridge: per-message results, and
// customers who replied STOP.
export async function applyBridgeCallback(
  db: Db,
  account: Account,
  payload: {
    events?: { recipientId: string; status: "sent" | "failed"; messageId?: string; error?: string }[];
    optOut?: string[];
  },
) {
  const now = new Date().toISOString();
  const touched = new Set<string>();

  for (const e of payload.events ?? []) {
    if (!e?.recipientId || (e.status !== "sent" && e.status !== "failed")) continue;
    // Only a recipient still waiting can be settled, so a replayed callback
    // can't flip a finished result, and one account can't touch another's.
    const { data } = await db
      .from("sv_whatsapp_recipients")
      .update(
        e.status === "sent"
          ? { status: "sent", wa_message_id: e.messageId ?? null, error_message: null, updated_at: now }
          : { status: "failed", error_message: String(e.error ?? "Send failed").slice(0, 500), updated_at: now },
      )
      .eq("id", e.recipientId)
      .eq("user_id", account.user_id)
      .in("status", ["queued", "pending"])
      .select("broadcast_id");
    for (const row of data ?? []) touched.add(row.broadcast_id);
  }
  for (const id of touched) await settleBroadcast(db, id);

  const phones = (payload.optOut ?? []).map((p) => normalizePhone(String(p))).filter((p): p is string => Boolean(p));
  if (phones.length > 0) {
    await db
      .from("sv_whatsapp_contacts")
      .update({ opted_in: false, opted_out_at: now })
      .eq("connected_account_id", account.id)
      .in("phone", phones);
  }
}

// ============================================================
// Creating a broadcast from a post
// ============================================================

// Creates the broadcast + one pending recipient per target, then starts
// sending. Shared by the composer's "Publish now", the scheduled-post cron,
// and the whatsapp function.
export async function createAndRunBroadcast(
  db: Db,
  userId: string,
  account: Account,
  input: { text: string; mediaUrl: string | null; postId: string | null; options: WhatsAppOptions },
): Promise<{ broadcastId: string; counts: BroadcastCounts }> {
  const options = input.options ?? {};
  const bridge = isBridgeAccount(account);

  if (!bridge) {
    if (!options.templateName) throw new Error("Pick an approved WhatsApp template for this post");
    if (options.headerFormat && !input.mediaUrl) {
      throw new Error(`Template "${options.templateName}" needs an ${options.headerFormat.toLowerCase()} attached to the post`);
    }
  } else if (!options.includeContacts && !(options.groups && options.groups.length > 0)) {
    throw new Error("Choose who gets this on WhatsApp: your contacts, one or more groups, or both");
  }

  const contacts: { id: string; phone: string; name: string | null }[] = [];
  if (!bridge || options.includeContacts) {
    for (let from = 0; ; from += 1000) {
      let q = db
        .from("sv_whatsapp_contacts")
        .select("id, phone, name")
        .eq("connected_account_id", account.id)
        .eq("opted_in", true)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (options.tag) q = q.contains("tags", [options.tag]);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      contacts.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    if (contacts.length === 0 && !(bridge && options.groups?.length)) {
      throw new Error(
        options.tag
          ? `No opted-in contacts tagged "${options.tag}"`
          : "No opted-in WhatsApp contacts yet — add some in the WhatsApp tab first",
      );
    }
  }

  const groups = bridge ? options.groups ?? [] : [];
  const targetCount = contacts.length + groups.length;
  if (bridge && targetCount > BRIDGE_MAX_TARGETS) {
    throw new Error(
      `That's ${targetCount} recipients — a QR-linked number can send at most ${BRIDGE_MAX_TARGETS} per broadcast. Narrow it with a tag.`,
    );
  }

  const { data: broadcast, error: bErr } = await db
    .from("sv_whatsapp_broadcasts")
    .insert({
      user_id: userId,
      connected_account_id: account.id,
      post_id: input.postId,
      mode: bridge ? "bridge" : "cloud",
      template_name: bridge ? null : options.templateName,
      template_language: bridge ? null : options.language,
      header_format: bridge ? null : options.headerFormat ?? null,
      body_param_count: bridge ? 0 : options.bodyParamCount ?? 0,
      message_text: input.text,
      media_url: input.mediaUrl,
      audience_tag: options.tag ?? null,
      bridge_pace: bridge ? options.pace ?? "balanced" : null,
      group_count: groups.length,
      total: targetCount,
    })
    .select()
    .single();
  if (bErr || !broadcast) throw new Error(bErr?.message ?? "Could not create broadcast");

  const rows = [
    ...contacts.map((c) => ({ contact_id: c.id as string | null, phone: c.phone, name: c.name })),
    ...groups.map((g) => ({ contact_id: null as string | null, phone: g.id, name: g.name })),
  ];
  const inserted: { id: string; phone: string; name: string | null }[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await db
      .from("sv_whatsapp_recipients")
      .insert(chunk.map((r) => ({ broadcast_id: broadcast.id, user_id: userId, contact_id: r.contact_id, phone: r.phone })))
      .select("id, phone");
    if (error) throw new Error(error.message);
    // select() returns rows in insertion order, so names line up by index.
    (data ?? []).forEach((d: { id: string; phone: string }, idx: number) =>
      inserted.push({ id: d.id, phone: d.phone, name: chunk[idx].name })
    );
  }

  if (bridge) {
    await submitBridgeJob(db, broadcast, account, inserted, broadcast.id);
    return { broadcastId: broadcast.id, counts: await countRecipients(db, broadcast.id) };
  }
  const counts = await runCloudBroadcast(db, broadcast, account);
  return { broadcastId: broadcast.id, counts };
}

// Resume entry point for the whatsapp function: continues whatever is
// outstanding for a broadcast, in whichever mode it was sent.
export async function resumeBroadcast(
  db: Db,
  // deno-lint-ignore no-explicit-any
  broadcast: any,
  account: Account,
  retryFailed: boolean,
): Promise<BroadcastCounts> {
  if (broadcast.mode === "bridge") {
    const resumed = await resumeBridgeBroadcast(db, broadcast, account);
    return retryFailed ? await retryBridgeFailures(db, broadcast, account) : resumed;
  }
  if (retryFailed) {
    await db
      .from("sv_whatsapp_recipients")
      .update({ status: "pending", error_message: null })
      .eq("broadcast_id", broadcast.id)
      .eq("status", "failed");
    await db.from("sv_whatsapp_broadcasts").update({ status: "sending" }).eq("id", broadcast.id);
  }
  return await runCloudBroadcast(db, broadcast, account);
}

// ============================================================
// Sync
// ============================================================

// Keeps the Accounts card honest: "followers" for WhatsApp is the number of
// opted-in contacts. Cloud accounts also refresh the number's quality rating
// (a RED rating is what makes Meta throttle sending); bridge accounts refresh
// connection state.
export async function syncWhatsApp(
  db: Db,
  account: Account,
  accountId: string,
): Promise<{ postsSynced: number; daysSynced: number; warnings: string[] }> {
  const warnings: string[] = [];
  const { count } = await db
    .from("sv_whatsapp_contacts")
    .select("id", { count: "exact", head: true })
    .eq("connected_account_id", accountId)
    .eq("opted_in", true);

  const update: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    followers_count: count ?? 0,
  };

  try {
    if (isBridgeAccount(account)) {
      const status = await bridgeRequest(sessionPath(account, "status"));
      if (status.state === "ready" && status.account) {
        update.platform_display_name = status.account.name || account.platform_display_name;
        update.platform_username = status.account.phone ? `+${status.account.phone}` : account.platform_username;
      } else {
        warnings.push(`WhatsApp isn't connected on your bridge (${status.state}) — open the WhatsApp tab to scan the QR code`);
      }
    } else if (account.access_token_ciphertext && account.token_iv) {
      const token = await decryptToken(account.access_token_ciphertext, account.token_iv);
      const info = await getPhoneNumberInfo(account.platform_user_id, token);
      update.platform_display_name = info.verified_name ?? account.platform_display_name;
      update.platform_username = info.display_phone_number ?? account.platform_username;
      update.metadata = { ...(account.metadata ?? {}), quality_rating: info.quality_rating ?? null };
      if (info.quality_rating === "RED") {
        warnings.push("This WhatsApp number's quality rating is RED — Meta may limit or block your broadcasts");
      }
    }
  } catch (e) {
    warnings.push(`Could not refresh WhatsApp details: ${e instanceof Error ? e.message : String(e)}`);
  }

  await db.from("sv_connected_accounts").update(update).eq("id", accountId);
  return { postsSynced: 0, daysSynced: 0, warnings };
}
