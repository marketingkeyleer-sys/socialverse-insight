import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirect, grantedScopes, validateSelection } from '../supabase/functions/_shared/oauth-policy.ts';
import { selectPublishTargets } from '../supabase/functions/_shared/publish-policy.ts';
import { followerTotals } from '../src/lib/analyticsTotals.ts';

const env = new Map(Object.entries({
  APP_URL: 'https://app.example.com', SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  META_CLIENT_ID: 'meta-client', META_CLIENT_SECRET: 'meta-secret',
  OAUTH_ENCRYPTION_KEY: 'test-only-key-never-use-in-production',
}));
let handler;
globalThis.Deno = { env: { get: (key) => env.get(key) }, serve: (fn) => { handler = fn; } };

// Small in-memory PostgREST double: ownership filters and compare-and-set
// updates execute against shared rows, including concurrent worker tests.
function database(tables, userId = 'A') {
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table) {
      let operation = 'select', payload, filters = [];
      const query = {
        select() { return query; },
        insert(value) { operation = 'insert'; payload = value; return query; },
        update(value) { operation = 'update'; payload = value; return query; },
        delete() { operation = 'delete'; return query; },
        eq(key, value) { filters.push((r) => r[key] === value); return query; },
        gt(key, value) { filters.push((r) => r[key] > value); return query; },
        in(key, values) { filters.push((r) => values.includes(r[key])); return query; },
        async execute(single = false) {
          const rows = tables[table] ??= [];
          let matched = rows.filter((row) => filters.every((f) => f(row)));
          if (operation === 'insert') {
            matched = (Array.isArray(payload) ? payload : [payload]).map((r) => ({ id: crypto.randomUUID(), ...r }));
            rows.push(...matched);
          }
          if (operation === 'update') matched.forEach((r) => Object.assign(r, payload));
          if (operation === 'delete') tables[table] = rows.filter((r) => !matched.includes(r));
          return { data: single ? matched[0] ?? null : matched, error: null };
        },
        maybeSingle() { return query.execute(true); }, single() { return query.execute(true); },
        then(resolve, reject) { return query.execute().then(resolve, reject); },
      };
      return query;
    },
  };
}
const postRequest = (body) => new Request('https://edge.example.com', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body) });

test('OAuth redirects reject attacker origins, credentials and script schemes', () => {
  for (const target of ['https://evil.example/accounts', '//evil.example', 'javascript:alert(1)', 'https://user:pass@app.example.com']) {
    assert.throws(() => safeRedirect(target, env.get('APP_URL')));
  }
  assert.equal(safeRedirect('/accounts?connected=facebook#fragment', env.get('APP_URL')), 'https://app.example.com/accounts');
  assert.equal(safeRedirect('http://localhost:5173/accounts', env.get('APP_URL'), 'http://localhost:5173'), 'http://localhost:5173/accounts');
});
test('scope metadata records grants without inventing requested permissions', () => {
  assert.deepEqual(grantedScopes(undefined), []);
  assert.deepEqual(grantedScopes('read,write read'), ['read', 'write']);
});
test('analytics counts every account even when sync dates differ', () => {
  assert.deepEqual(followerTotals([
    { connected_account_id: 'a1', metric_date: '2026-10-01', followers: 10 },
    { connected_account_id: 'a1', metric_date: '2026-10-03', followers: 20 },
    { connected_account_id: 'a2', metric_date: '2026-10-01', followers: 100 },
    { connected_account_id: 'a2', metric_date: '2026-10-02', followers: 110 },
  ]), { first: 110, last: 130 });
});
test('asset selection rejects unapproved, duplicate and empty IDs', () => {
  const rows = [{ platform_user_id: 'page-A' }];
  assert.deepEqual(validateSelection(rows, ['page-A']), rows);
  for (const ids of [[], ['page-B'], ['page-A', 'page-A'], 'page-A']) assert.throws(() => validateSelection(rows, ids));
});
const accounts = [
  { id: 'a1', user_id: 'A', platform: 'facebook', is_active: true },
  { id: 'a2', user_id: 'A', platform: 'facebook', is_active: true },
  { id: 'b1', user_id: 'B', platform: 'facebook', is_active: true },
];
test('two-user destination selection isolates cron service-role results', () => {
  for (const owner of ['A', 'B']) {
    const id = owner === 'A' ? 'a2' : 'b1';
    assert.deepEqual(selectPublishTargets(owner, { user_id: owner, platforms: ['facebook'], connected_account_ids: [id] }, accounts).map((a) => a.id), [id]);
  }
  assert.throws(() => selectPublishTargets('A', { user_id: 'A', platforms: ['facebook'], connected_account_ids: ['b1'] }, accounts));
  assert.throws(() => selectPublishTargets('A', { user_id: 'B', platforms: ['facebook'] }, accounts));
  assert.throws(() => selectPublishTargets('A', { user_id: 'A', platforms: ['facebook'] }, accounts));
});
test('OAuth start binds both users to distinct states; rejects foreign brand and redirect', async () => {
  const tables = { sv_brands: [{ id: 'brand-B', user_id: 'B' }] };
  let owner = 'A';
  globalThis.testCreateClient = () => database(tables, owner);
  await import('../supabase/functions/oauth-start/index.ts');
  const start = handler;
  for (owner of ['A', 'B']) {
    const response = await start(postRequest({ platform: 'facebook', redirectTo: 'https://app.example.com/accounts' }));
    assert.equal(response.status, 200);
    const url = new URL((await response.json()).authorizeUrl);
    assert.equal(url.searchParams.get('config_id'), null);
    assert.equal(tables.sv_oauth_states.at(-1).user_id, owner);
  }
  assert.notEqual(tables.sv_oauth_states[0].state, tables.sv_oauth_states[1].state);
  owner = 'A';
  env.set('GOOGLE_CLIENT_ID', 'google-client');
  env.set('GOOGLE_CLIENT_SECRET', 'google-secret');
  tables.sv_brands.push({ id: 'brand-A', user_id: 'A' });
  const youtubeResponse = await start(postRequest({ platform: 'youtube', brandId: 'brand-A', redirectTo: 'https://app.example.com/accounts' }));
  assert.equal(youtubeResponse.status, 200);
  const youtubeUrl = new URL((await youtubeResponse.json()).authorizeUrl);
  assert.equal(youtubeUrl.searchParams.get('prompt'), 'select_account consent');
  assert.equal(youtubeUrl.searchParams.get('include_granted_scopes'), 'false');
  assert.equal(youtubeUrl.searchParams.get('access_type'), 'offline');
  assert.equal(youtubeUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(youtubeUrl.searchParams.get('redirect_uri'), 'https://example.supabase.co/functions/v1/oauth-callback/youtube');
  assert.equal(tables.sv_oauth_states.at(-1).brand_id, 'brand-A');
  assert.ok(youtubeUrl.searchParams.get('scope').split(' ').every((scope) => /^https:\/\/www\.googleapis\.com\/auth\/(youtube\.|yt-analytics\.)/.test(scope)));
  assert.equal((await start(postRequest({ platform: 'facebook', brandId: 'brand-B' }))).status, 400);
  assert.equal((await start(postRequest({ platform: 'facebook', redirectTo: 'https://evil.example' }))).status, 400);
  owner = null;
  assert.equal((await start(postRequest({ platform: 'facebook' }))).status, 401);
});
test('callback consumes state once, encrypts tokens and defers asset connection', async () => {
  const tables = { sv_oauth_states: [{ state: 'one-time', user_id: 'A', platform: 'facebook', expires_at: new Date(Date.now() + 60000).toISOString(), redirect_to: 'https://app.example.com/accounts' }] };
  globalThis.testCreateClient = () => database(tables);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => Response.json(String(url).includes('/oauth/access_token') ? { access_token: 'private-token', scope: 'pages_show_list' } : { data: [{ id: 'page1', name: 'Page 1', access_token: 'private-page-token' }, { id: 'page2', name: 'Page 2' }] });
  try {
    await import('../supabase/functions/oauth-callback/index.ts');
    const callback = handler;
    const response = await callback(new Request('https://example.supabase.co/functions/v1/oauth-callback/facebook?code=test&state=one-time'));
    assert.equal(response.status, 302);
    assert.ok(new URL(response.headers.get('Location')).searchParams.has('connection_request'));
    assert.equal(tables.sv_oauth_pending[0].user_id, 'A');
    assert.equal(tables.sv_oauth_pending[0].accounts.length, 2);
    assert.notEqual(tables.sv_oauth_pending[0].accounts[0].access_token_ciphertext, 'private-token');
    assert.equal(tables.sv_connected_accounts, undefined);
    const replay = await callback(new Request('https://example.supabase.co/functions/v1/oauth-callback/facebook?code=test&state=one-time'));
    assert.match(replay.headers.get('Location'), /connect_error=/);
    assert.equal(tables.sv_oauth_pending.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});
test('account confirmation never discloses another user request or credential fields', async () => {
  const tables = { sv_oauth_pending: [{ id: 'request-A', user_id: 'A', expires_at: new Date(Date.now() + 60000).toISOString(), platform: 'facebook', accounts: [{ platform_user_id: 'p1', platform_display_name: 'Page', access_token_ciphertext: 'SECRET' }] }] };
  let owner = 'B';
  globalThis.testCreateClient = () => database(tables, owner);
  await import('../supabase/functions/oauth-accounts/index.ts');
  const endpoint = handler;
  assert.equal((await endpoint(postRequest({ requestId: 'request-A' }))).status, 404);
  owner = 'A';
  const response = await endpoint(postRequest({ requestId: 'request-A' }));
  const body = await response.json();
  assert.deepEqual(body.accounts, [{ id: 'p1', name: 'Page' }]);
  assert.ok(!JSON.stringify(body).includes('SECRET'));
  assert.equal((await endpoint(postRequest({ requestId: 'request-A', selectedIds: ['foreign-page'] }))).status, 400);
});
test('actual publisher isolates two users, claims atomically and skips successful retries', async () => {
  const { encryptToken } = await import('../supabase/functions/_shared/crypto.ts');
  const { publishPost } = await import('../supabase/functions/_shared/publish.ts');
  const enc = await encryptToken('page-token');
  const tables = {
    sv_connected_accounts: accounts.map((a) => ({ ...a, platform_user_id: a.id, page_access_token_ciphertext: enc.ciphertext, page_access_token_iv: enc.iv })),
    sv_posts: ['A', 'B'].map((owner) => ({ id: `post-${owner}`, user_id: owner, status: 'scheduled', platforms: ['facebook'], connected_account_ids: [owner === 'A' ? 'a1' : 'b1'], content: 'Hello' })),
  };
  const client = database(tables);
  const originalFetch = globalThis.fetch;
  const published = [];
  globalThis.fetch = async (url) => { published.push(String(url)); return Response.json({ id: `remote-${published.length}` }); };
  try {
    const a = { ...tables.sv_posts[0] }, b = { ...tables.sv_posts[1] };
    const attempts = await Promise.allSettled([publishPost(client, 'A', a), publishPost(client, 'A', a), publishPost(client, 'B', b)]);
    assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 2);
    assert.deepEqual(published.map((url) => new URL(url).pathname), ['/v21.0/a1/feed', '/v21.0/b1/feed']);
    assert.equal(tables.sv_post_platform_results[0].user_id, 'A');
    assert.equal(tables.sv_post_platform_results[1].user_id, 'B');
    tables.sv_posts[0].status = 'partially_failed';
    await publishPost(client, 'A', a);
    assert.equal(published.length, 2, 'retry must not send an already published destination');
  } finally { globalThis.fetch = originalFetch; }
});

test('multiple accounts on one platform each receive exactly one post', async () => {
  const { encryptToken } = await import('../supabase/functions/_shared/crypto.ts');
  const { publishPost } = await import('../supabase/functions/_shared/publish.ts');
  const enc = await encryptToken('page-token');
  const post = { id: 'multi', user_id: 'A', status: 'draft', content: 'Multi-page', platforms: ['facebook'], connected_account_ids: ['a1', 'a2'] };
  const tables = { sv_posts: [post], sv_connected_accounts: accounts.map((a) => ({ ...a, platform_user_id: a.id, page_access_token_ciphertext: enc.ciphertext, page_access_token_iv: enc.iv })) };
  const originalFetch = globalThis.fetch;
  const sends = [];
  globalThis.fetch = async (url) => { sends.push(url); return Response.json({ id: 'posted' }); };
  try {
    const result = await publishPost(database(tables), 'A', { ...post });
    assert.equal(result.overallStatus, 'published');
    assert.equal(sends.length, 2);
    assert.deepEqual(tables.sv_post_platform_results.map((r) => r.connected_account_id), ['a1', 'a2']);
  } finally { globalThis.fetch = originalFetch; }
});

test('network uncertainty is recorded and blocks unsafe resend', async () => {
  const { encryptToken } = await import('../supabase/functions/_shared/crypto.ts');
  const { publishPost } = await import('../supabase/functions/_shared/publish.ts');
  const enc = await encryptToken('page-token');
  const post = { id: 'unknown', user_id: 'A', status: 'draft', content: 'Unknown outcome', platforms: ['facebook'], connected_account_ids: ['a1'] };
  const tables = { sv_posts: [post], sv_connected_accounts: [{ ...accounts[0], platform_user_id: 'a1', page_access_token_ciphertext: enc.ciphertext, page_access_token_iv: enc.iv }] };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  try {
    const client = database(tables);
    assert.equal((await publishPost(client, 'A', { ...post })).overallStatus, 'failed');
    assert.match(tables.sv_post_platform_results[0].error_message, /^Outcome unknown/);
    await assert.rejects(publishPost(client, 'A', { ...post }), /unknown outcome/);
  } finally { globalThis.fetch = originalFetch; }
});

test('YouTube refresh rotates encrypted credentials and cannot overwrite a foreign account', async () => {
  const { encryptToken, decryptToken } = await import('../supabase/functions/_shared/crypto.ts');
  const { getYouTubeAccessToken } = await import('../supabase/functions/_shared/sync.ts');
  const old = await encryptToken('old-token'), refresh = await encryptToken('refresh-token');
  env.set('GOOGLE_CLIENT_ID', 'google-client'); env.set('GOOGLE_CLIENT_SECRET', 'google-secret');
  const account = { id: 'yt-A', user_id: 'A', access_token_ciphertext: old.ciphertext, token_iv: old.iv, refresh_token_ciphertext: refresh.ciphertext, refresh_iv: refresh.iv, token_expires_at: '2000-01-01' };
  const tables = { sv_connected_accounts: [{ ...account }, { ...account, id: 'yt-B', user_id: 'B' }] };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 });
  try {
    assert.equal(await getYouTubeAccessToken(database(tables), account, account.id), 'new-token');
    assert.equal(await decryptToken(tables.sv_connected_accounts[0].refresh_token_ciphertext, tables.sv_connected_accounts[0].refresh_iv), 'new-refresh');
    assert.equal(tables.sv_connected_accounts[1].access_token_ciphertext, old.ciphertext);
  } finally { globalThis.fetch = originalFetch; }
});

test('LinkedIn uses the authorized person or organization and a supported version header', async () => {
  const { publishLinkedInText } = await import('../supabase/functions/_shared/linkedin.ts');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, ...init }); return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:test' } }); };
  try {
    await publishLinkedInText('member-A', false, 'private-token', 'Hello');
    await publishLinkedInText('org-B', true, 'private-token-B', 'Hello organization');
    assert.equal(JSON.parse(requests[0].body).author, 'urn:li:person:member-A');
    assert.equal(JSON.parse(requests[1].body).author, 'urn:li:organization:org-B');
    assert.equal(requests[0].headers['LinkedIn-Version'], '202609');
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(publishLinkedInText('member-A', false, 'token', 'Hello'), /permission is missing/);
  } finally { globalThis.fetch = originalFetch; }
});
