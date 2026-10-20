import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveAppSupabaseConfig } from "./supabaseConfig";
import { supabaseProject } from "./supabaseProject";

// Lovable supplies PUBLISHABLE_KEY; older local installs use ANON_KEY.
const { url: supabaseUrl, key: supabaseAnonKey } = resolveAppSupabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_SOCIALVERSE_USE_ENV_CONFIG: import.meta.env.VITE_SOCIALVERSE_USE_ENV_CONFIG,
}, supabaseProject);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
