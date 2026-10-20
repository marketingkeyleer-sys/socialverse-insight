interface SupabaseEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SOCIALVERSE_USE_ENV_CONFIG?: string;
}

export function resolveSupabaseConfig(env: SupabaseEnvironment) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing public Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in the frontend build environment.");
  }
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Invalid public Supabase URL");
  if (key.startsWith("sb_secret_")) throw new Error("A secret Supabase key cannot be used in the frontend");
  if (key.split(".").length === 3) {
    let role: string;
    try {
      const payload = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      role = JSON.parse(atob(payload)).role;
    } catch { throw new Error("Invalid public Supabase key"); }
    if (role !== "anon") throw new Error("Only an anon or publishable Supabase key may be used in the frontend");
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error("Use a public Supabase anon or publishable key");
  }
  return { url, key };
}

export function resolveAppSupabaseConfig(env: SupabaseEnvironment, project: { url: string; publishableKey: string }) {
  // Lovable can inject its own Cloud project into generic VITE variables.
  // Keep the app on its existing database unless another backend is explicitly
  // selected, rather than creating empty copies of production tables elsewhere.
  const sameProject = env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "") === project.url.replace(/\/$/, "");
  const hasKey = Boolean(env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim());
  if (env.VITE_SOCIALVERSE_USE_ENV_CONFIG === "true" || (sameProject && hasKey)) return resolveSupabaseConfig(env);
  return resolveSupabaseConfig({ VITE_SUPABASE_URL: project.url, VITE_SUPABASE_PUBLISHABLE_KEY: project.publishableKey });
}
