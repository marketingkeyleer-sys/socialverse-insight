import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadPostBinding, verifiedUploadPostPage, uploadPostConnectionRow } from '../supabase/functions/_shared/uploadpost.ts';
import { decryptToken } from '../supabase/functions/_shared/crypto.ts';
import { syncUploadPostPage } from '../supabase/functions/_shared/uploadpost-sync.ts';
import {confirmedLinkedInResult, publishUploadPostPage} from '../supabase/functions/_shared/uploadpost-publish.ts';

const binding = { userId: 'owner', brandId: 'brand', profile: 'robotverse', pageId: 'urn:li:organization:108154398' };
const env = new Map([['UPLOAD_POST_API_KEY', 'server-only-secret'], ['OAUTH_ENCRYPTION_KEY', 'test-encryption-key'], ['UPLOAD_POST_LINKEDIN_BINDINGS', JSON.stringify([binding])]]);
globalThis.Deno = { env: { get: name => env.get(name) } };

test('provider profiles cannot be selected across owners or brands', () => {
  assert.equal(uploadPostBinding('other-owner', 'brand'), null);
  assert.equal(uploadPostBinding('owner', 'other-brand'), null);
  assert.deepEqual(uploadPostBinding('owner', 'brand'), binding);
});

test('connection verifies the pinned Page and keeps the provider key out of stored rows', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Apikey server-only-secret');
    assert.equal(options.redirect, 'error');
    const data = url.includes('linkedin-page')
      ? { success: true, selected_page_id: binding.pageId, pages: [{ id: binding.pageId, name: 'RobotVerse', followers: 1476 }] }
      : { success: true, profile: { username: 'robotverse', social_accounts: { linkedin: { username: 'member-123' } } } };
    return Response.json(data);
  };
  try {
    const row = await uploadPostConnectionRow(binding);
    assert.equal(row.followers_count, 1476);
    assert.equal(row.platform_user_id, binding.pageId);
    const reference = JSON.parse(await decryptToken(row.access_token_ciphertext, row.token_iv));
    assert.equal(reference.memberId, 'member-123');
    assert.equal(JSON.stringify(row).includes('server-only-secret'), false);
  } finally { globalThis.fetch = original; }
});

test('changed Page pin, expired authorization, and provider failures fail closed', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => Response.json(url.includes('linkedin-page')
      ? { success: true, selected_page_id: 'urn:li:organization:999', pages: [{ id: binding.pageId }] }
      : { success: true, profile: { username: 'robotverse', social_accounts: { linkedin: { username: 'member-123' } } } });
    await assert.rejects(verifiedUploadPostPage(binding), /selected LinkedIn Page changed/);
    globalThis.fetch = async () => Response.json({ success: true, profile: { username: 'robotverse', social_accounts: { linkedin: { username: 'member-123', reauth_required: true } } } });
    await assert.rejects(verifiedUploadPostPage(binding), /Reconnect/);
    globalThis.fetch = async () => new Response('private provider error', { status: 401 });
    await assert.rejects(verifiedUploadPostPage(binding), error => !error.message.includes('private provider error'));
  } finally { globalThis.fetch = original; }
});

test('monitoring sends an explicit Page destination and saves only the owning account', async () => {
  const original = globalThis.fetch;
  const writes = [];
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/linkedin-page')) return Response.json({ success: true, selected_page_id: binding.pageId, pages: [{ id: binding.pageId, name: 'RobotVerse', followers: 1482 }] });
    if (parsed.pathname.endsWith('/robotverse')) return Response.json({ success: true, profile: { username: 'robotverse', social_accounts: { linkedin: { username: 'member-123' } } } });
    assert.equal(parsed.searchParams.get('page_urn'), binding.pageId);
    assert.equal(parsed.searchParams.get('user'), 'robotverse');
    if (parsed.pathname.endsWith('/media')) return Response.json({ success: true, media: [{ id: 'urn:li:share:12345', caption: 'Brand post', timestamp: '2026-10-21T10:00:00Z', permalink: 'https://www.linkedin.com/feed/update/urn:li:share:12345' }] });
    return Response.json({ success: true, platforms: { linkedin: { platform_post_id: 'urn:li:share:12345', post_metrics: { likes: 12, comments: 2, shares: 1, impressions: 100 } } } });
  };
  const db = { from(table) { return {
    upsert(row) { writes.push({ table, row }); return Promise.resolve({ error: null }); },
    select() { return { eq() { return { eq() { return Promise.resolve({ count: 1, error: null }); } }; } }; },
    update(row) { writes.push({ table, row }); return { eq() { return { eq() { return Promise.resolve({ error: null }); } }; } }; },
  }; } };
  try {
    const row = await uploadPostConnectionRow(binding);
    const result = await syncUploadPostPage(db, 'owner', { ...row, id: 'account-1' }, 'account-1');
    assert.equal(result.postsSynced, 1);
    assert.equal(result.daysSynced, 1);
    const observation=writes.find(write=>write.table==='sv_analytics_snapshots').row;
    assert.equal(observation.connected_account_id,'account-1');
    assert.equal(observation.user_id,'owner');
    assert.equal(observation.followers,1482);
    assert.deepEqual(observation.available_metrics,['followers']);
    assert.equal(observation.reach,undefined);
    const post=writes.find(write=>write.table==='sv_platform_posts').row;
    assert.equal(post.connected_account_id, 'account-1');
    assert.equal(post.user_id, 'owner');
    assert.equal(post.impressions, 100);
    assert.equal(post.reach, undefined);
    assert.equal(writes.find(write=>write.table==='sv_connected_accounts').row.followers_count, 1482);
    await assert.rejects(syncUploadPostPage(db, 'other-owner', { ...row, id: 'account-1' }, 'account-1'), /another user/);
    assert.equal(writes.length, 3);
  } finally { globalThis.fetch = original; }
});

test('provider receipts and queued successes are never mistaken for publication', () => {
  assert.equal(confirmedLinkedInResult({success:true,request_id:'request'}),null);
  assert.equal(confirmedLinkedInResult({results:{linkedin:{success:true,status:'queued',url:'https://www.linkedin.com/feed/update/123'}}}),null);
  assert.equal(confirmedLinkedInResult({results:{linkedin:{success:true,url:'https://evil.example/post/1'}}}),null);
  assert.equal(confirmedLinkedInResult({results:{linkedin:{success:true,skipped:true,url:'https://www.linkedin.com/feed/update/123'}}}),null);
  assert.equal(confirmedLinkedInResult({results:{linkedin:{success:true,url:'https://www.linkedin.com/feed/update/urn:li:share:123'}}}).id,'https://www.linkedin.com/feed/update/urn:li:share:123');
});

test('provider publishing uses owned media, explicit Page and stable idempotency', async () => {
  const original=globalThis.fetch;
  env.set('SUPABASE_URL','https://project.supabase.co');
  const requests=[];
  globalThis.fetch=async (url,options) => {
    if (options?.method === 'POST') {requests.push(options);return Response.json({success:true,request_id:options.body.get('request_id')});}
    return Response.json(url.includes('linkedin-page')
      ? {success:true,selected_page_id:binding.pageId,pages:[{id:binding.pageId,name:'RobotVerse'}]}
      : {success:true,profile:{username:'robotverse',social_accounts:{linkedin:{username:'member-123'}}}});
  };
  try {
    const account={...await uploadPostConnectionRow(binding),id:'account-1'};
    const media=['https://project.supabase.co/storage/v1/object/public/sv-media/owner/photo.png'];
    const first=await publishUploadPostPage(account,'owner','post-1','Caption',media);
    const second=await publishUploadPostPage(account,'owner','post-1','Caption',media);
    assert.equal(first.pending,true);
    assert.equal(first.requestId,second.requestId);
    assert.equal(requests[0].body.get('target_linkedin_page_id'),binding.pageId);
    assert.equal(requests[0].body.get('platform[]'),'linkedin');
    assert.equal(requests[0].body.get('user'),'robotverse');
    assert.equal(requests[0].headers['Idempotency-Key'],first.requestId);
    await assert.rejects(publishUploadPostPage(account,'owner','post-1','Caption',['https://evil.example/photo.png']),/own SocialVerse/);
    assert.equal(requests.length,2);
  } finally {globalThis.fetch=original;}
});
