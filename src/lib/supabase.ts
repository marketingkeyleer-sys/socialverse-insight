import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveSupabaseConfig } from "./supabaseConfig";

// Lovable supplies PUBLISHABLE_KEY; older local installs use ANON_KEY.
const { url: supabaseUrl, key: supabaseAnonKey } = resolveSupabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
