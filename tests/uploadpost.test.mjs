import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadPostBinding, verifiedUploadPostPage, uploadPostConnectionRow } from '../supabase/functions/_shared/uploadpost.ts';
import { decryptToken } from '../supabase/functions/_shared/crypto.ts';

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
