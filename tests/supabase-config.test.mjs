import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSupabaseConfig, resolveAppSupabaseConfig } from '../src/lib/supabaseConfig.ts';

const url = 'https://example.supabase.co';
const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;

test('Lovable publishable configuration loads without the legacy anon variable', () => {
  assert.deepEqual(resolveSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }), { url, key: 'sb_publishable_test' });
});
test('existing local anon configuration remains supported', () => {
  const key = jwt('anon');
  assert.deepEqual(resolveSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key }), { url, key });
});
test('empty publishable variable falls back to the local anon key', () => {
  const key = jwt('anon');
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: ' ', VITE_SUPABASE_ANON_KEY: key }).key, key);
});
test('frontend configuration rejects private server credentials', () => {
  for (const key of ['sb_secret_private', jwt('service_role'), jwt('authenticated')]) {
    assert.throws(() => resolveSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key }));
  }
});
test('missing or invalid configuration fails with actionable messages', () => {
  assert.throws(() => resolveSupabaseConfig({}), /Missing public Supabase configuration/);
  assert.throws(() => resolveSupabaseConfig({ VITE_SUPABASE_URL: 'javascript:alert(1)', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }), /Invalid public Supabase URL/);
});

const project = { url, publishableKey: 'sb_publishable_application' };
test('Lovable Cloud variables cannot silently redirect saves to an empty project', () => {
  assert.deepEqual(resolveAppSupabaseConfig({ VITE_SUPABASE_URL: 'https://other.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other' }, project), { url, key: project.publishableKey });
});
test('preview without environment variables still uses the existing application database', () => {
  assert.deepEqual(resolveAppSupabaseConfig({}, project), { url, key: project.publishableKey });
});
test('a rotated key for the same project is respected', () => {
  assert.equal(resolveAppSupabaseConfig({ VITE_SUPABASE_URL: `${url}/`, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_rotated' }, project).key, 'sb_publishable_rotated');
});
test('a different staging database requires explicit opt-in', () => {
  const env = { VITE_SUPABASE_URL: 'https://staging.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging', VITE_SOCIALVERSE_USE_ENV_CONFIG: 'true' };
  assert.deepEqual(resolveAppSupabaseConfig(env, project), { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY });
});
