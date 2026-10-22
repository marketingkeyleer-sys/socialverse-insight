// Authenticated: given just a title (and optionally a URL to work into the
// post as a call-to-action), generates a caption via OpenAI's chat model and
// an image via its image model, uploads the image to the user's own
// sv-media storage path, and returns both for the composer to prefill —
// nothing is saved as a post here, the user still reviews/edits before
// saving as a draft or publishing through the existing flow.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CHAT_MODEL = "gpt-4o-mini";
const IMAGE_MODEL = "gpt-image-1";

async function generateCaption(openaiKey: string, title: string, websiteUrl?: string): Promise<string> {
  const prompt =
    `Write an engaging social media post caption about: "${title}".` +
    (websiteUrl ? ` Naturally work in this link as a call to action: ${websiteUrl}.` : "") +
    ` Keep it concise, no markdown formatting, end with a few relevant hashtags.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(25000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(res.status === 401 ? "AI credentials were rejected. The administrator must update the server's OpenAI key." : res.status === 429 ? "The AI provider's quota or rate limit is exhausted. The administrator must check OpenAI billing and limits." : "The AI provider is unavailable. Please retry later.");
  const caption = json.choices?.[0]?.message?.content?.trim();
  if (!caption) throw new Error("OpenAI returned no caption");
  return caption;
}

async function generateImage(openaiKey: string, title: string): Promise<Uint8Array> {
  const prompt = `A professional, eye-catching social media graphic representing: ${title}. Clean, modern, high quality, no text overlay.`;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", quality: "low", n: 1 }),
    signal: AbortSignal.timeout(100000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error("Image generation is unavailable. Retry later or upload your own image.");
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({error:"Use POST"}), {status:405, headers:{...corsHeaders,"Content-Type":"application/json"}});

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("AI generation isn't configured yet — set OPENAI_API_KEY as an Edge Function secret.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, websiteUrl, withImage = true, usageOnly = false } = await req.json();
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const limit = Math.floor(Math.min(10000, Math.max(1, Number(Deno.env.get("AI_REQUESTS_PER_HOUR")) || 20)));
    const hour = new Date(); hour.setUTCMinutes(0,0,0);
    const resetAt = new Date(hour.getTime() + 3600000).toISOString();
    if (usageOnly) {
      const {data, error} = await admin.from("sv_ai_usage").select("requests").eq("user_id", userData.user.id).eq("hour_start", hour.toISOString()).maybeSingle();
      if (error) throw new Error("AI usage tracking is not configured. Contact your administrator.");
      return new Response(JSON.stringify({usage:{used:data?.requests ?? 0, limit, resetAt}}), {headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    if (typeof title !== "string" || !title.trim() || title.length > 1500) throw new Error("Enter a topic between 1 and 1500 characters");
    if (typeof withImage !== "boolean") throw new Error("Invalid image option");
    if (websiteUrl) {
      if (typeof websiteUrl !== "string" || websiteUrl.length > 2048) throw new Error("Enter a valid website URL");
      const url = new URL(websiteUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use an HTTPS website URL without credentials");
    }
    const {data: used, error: usageError} = await admin.rpc("sv_reserve_ai_request", {owner_id:userData.user.id, request_limit:limit});
    if (usageError) throw new Error("AI usage tracking is not configured. Contact your administrator.");
    if (used < 0) return new Response(JSON.stringify({error:"Hourly AI request limit reached. Try again after the reset.",usage:{used:limit,limit,resetAt}}), {status:429,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const [captionResult, imageResult] = await Promise.allSettled([
      generateCaption(openaiKey, title, websiteUrl || undefined),
      withImage ? generateImage(openaiKey, title) : Promise.resolve(null),
    ]);
    if (captionResult.status !== "fulfilled") throw new Error(captionResult.reason instanceof Error && captionResult.reason.message.startsWith("AI ") || captionResult.reason instanceof Error && captionResult.reason.message.startsWith("The AI provider") ? captionResult.reason.message : "Caption generation is unavailable. Check your AI service configuration or retry later.");
    const caption = captionResult.value;
    let imageUrl: string | undefined;
    let warning: string | undefined;
    const imageBytes = imageResult.status === "fulfilled" ? imageResult.value : null;
    if (withImage && !imageBytes) warning = "Caption generated; the image service is unavailable. You can upload an image or retry generation.";

    if (imageBytes) {
    const path = `${userData.user.id}/ai-${crypto.randomUUID()}.png`;
    const { error: uploadErr } = await supabase.storage
      .from("sv-media")
      .upload(path, imageBytes, { contentType: "image/png" });
    if (uploadErr) warning = "Caption generated; the image could not be saved. Upload an image manually.";
    const { data: publicUrlData } = supabase.storage.from("sv-media").getPublicUrl(path);
    if (!uploadErr) imageUrl = publicUrlData.publicUrl;
    }

    return new Response(JSON.stringify({ caption, imageUrl, warning, usage:{used,limit,resetAt} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
