import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleSignInEnabled } from '../src/lib/authProviders.ts';
test('Google sign-in is offered only when the authentication provider is enabled', async () => {
  assert.equal(await googleSignInEnabled('https://project.supabase.co', 'public-key', async () => Response.json({ external: { google: false } })), false);
  assert.equal(await googleSignInEnabled('https://project.supabase.co', 'public-key', async () => Response.json({ external: { google: true } })), true);
  assert.equal(await googleSignInEnabled('https://project.supabase.co', 'public-key', async () => Response.json({})), false);
});
test('provider discovery fails closed while leaving email sign-in independent', async () => {
  await assert.rejects(googleSignInEnabled('https://project.supabase.co', 'public-key', async () => new Response('', { status: 500 })), /Sign-in options/);
});
