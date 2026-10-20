// Read-only API smoke test. Run with the project's TS loader from the
// frontend build directory; no user data or credential values are printed.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { resolveAppSupabaseConfig } from '../src/lib/supabaseConfig.ts';
import { supabaseProject } from '../src/lib/supabaseProject.ts';

const text = await readFile('.env', 'utf8');
const env = {};
for (const line of text.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
}
const config = resolveAppSupabaseConfig(env, supabaseProject);
console.log(`Build environment URL: ${env.VITE_SUPABASE_URL ?? '(not set)'}`);
console.log(`Application database URL: ${config.url}`);
const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = false;
for (const table of ['sv_brands', 'sv_connected_accounts', 'sv_profiles', 'sv_posts', 'sv_inbox_state']) {
  const { error, status } = await client.from(table).select('id').limit(0);
  console.log(`${table}: HTTP ${status}${error ? ` (${error.code})` : ''}`);
  if (error) failed = true;
}
if (failed) process.exitCode = 1;
