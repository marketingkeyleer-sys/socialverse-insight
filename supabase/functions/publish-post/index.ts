// Authenticated: actually publishes a composed sv_posts row to each of its
// selected platforms' real APIs, right now (the "Publish now" button — see
// run-due-posts for the scheduled version, which shares this same logic via
// _shared/publish.ts). Runs on the caller's own RLS-scoped client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { publishPost } from "../_shared/publish.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { postId } = await req.json();
    const { data: post, error: postErr } = await supabase
      .from("sv_posts")
      .select("*")
      .eq("id", postId)
      .single();
    if (postErr || !post) throw new Error("Post not found");

    const outcome = await publishPost(supabase, userData.user.id, post);

    return new Response(JSON.stringify({ ok: true, ...outcome }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
