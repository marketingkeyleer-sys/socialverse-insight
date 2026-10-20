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
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "Caption generation failed");
  const caption = json.choices?.[0]?.message?.content?.trim();
  if (!caption) throw new Error("OpenAI returned no caption");
  return caption;
}

async function generateImage(openaiKey: string, title: string): Promise<Uint8Array> {
  const prompt = `A professional, eye-catching social media graphic representing: ${title}. Clean, modern, high quality, no text overlay.`;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", n: 1 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "Image generation failed");
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { title, websiteUrl } = await req.json();
    if (!title || typeof title !== "string") throw new Error("A title is required");

    const [caption, imageBytes] = await Promise.all([
      generateCaption(openaiKey, title, websiteUrl || undefined),
      generateImage(openaiKey, title),
    ]);

    const path = `${userData.user.id}/ai-${crypto.randomUUID()}.png`;
    const { error: uploadErr } = await supabase.storage
      .from("sv-media")
      .upload(path, imageBytes, { contentType: "image/png" });
    if (uploadErr) throw new Error(uploadErr.message);
    const { data: publicUrlData } = supabase.storage.from("sv-media").getPublicUrl(path);

    return new Response(JSON.stringify({ caption, imageUrl: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
