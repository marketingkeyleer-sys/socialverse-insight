// Authenticated: reports which platforms this installation can actually
// connect right now, so the app can show "Not available yet" up front
// instead of letting a user click Connect and hit a server-side error.
// Reads configuration only — it never returns a secret, just yes/no.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { PROVIDERS } from "../_shared/providers.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function bridgeReachable(): Promise<{ ready: boolean; reason?: string }> {
  const base = Deno.env.get("WHATSAPP_BRIDGE_URL");
  if (!base || !Deno.env.get("WHATSAPP_BRIDGE_KEY")) {
    return { ready: false, reason: "WhatsApp QR linking hasn't been set up on this server yet." };
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(6000) });
    return res.ok ? { ready: true } : { ready: false, reason: "The WhatsApp service is not responding." };
  } catch {
    return { ready: false, reason: "The WhatsApp service is offline right now." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return json({ error: "Not authenticated" }, 401);

  const platforms: Record<string, { ready: boolean; reason?: string }> = {};
  for (const provider of Object.values(PROVIDERS)) {
    const ready = Boolean(Deno.env.get(provider.clientIdEnv) && Deno.env.get(provider.clientSecretEnv));
    platforms[provider.id] = ready ? { ready } : { ready, reason: `${provider.name} login isn't set up on this server yet.` };
  }
  // WhatsApp has two routes: the shared QR service (needs the bridge) and the
  // official Cloud API, where each user brings their own credentials.
  const qr = await bridgeReachable();
  platforms.whatsapp = qr.ready ? { ready: true } : { ready: false, reason: qr.reason };

  return json({ platforms, cloudApiAvailable: true });
});
