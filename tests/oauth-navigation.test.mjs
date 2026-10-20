import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountReturnUrl, loginReturnPath, signInReturnUrl } from '../src/lib/oauthNavigation.ts';

const appUrl = 'https://socialverse-insight.lovable.app';
test('published and explicitly approved local OAuth returns stay on their origin', () => {
  for (const origin of [appUrl, 'http://localhost:5173', 'http://127.0.0.1:5173']) {
    assert.equal(accountReturnUrl(`${origin}/accounts`, appUrl), `${origin}/accounts`);
  }
});
test('Lovable previews complete account authorization on the approved production origin', () => {
  assert.equal(accountReturnUrl('https://id-preview--example.lovable.app/accounts', appUrl), `${appUrl}/accounts`);
  assert.equal(accountReturnUrl('https://untrusted.example/accounts', appUrl), `${appUrl}/accounts`);
});
test('email sign-in preserves the pending account confirmation query', () => {
  assert.equal(loginReturnPath({ pathname: '/accounts', search: '?connection_request=one-time-request' }), '/accounts?connection_request=one-time-request');
});
test('login navigation rejects external and looping destinations', () => {
  for (const pathname of ['https://evil.example', '//evil.example', '/\\evil.example', '/login']) {
    assert.equal(loginReturnPath({ pathname }), '/dashboard');
  }
});
test('Google sign-in preserves account confirmation and rejects an external return URL', () => {
  assert.equal(signInReturnUrl(appUrl, '/accounts?connection_request=pending'), `${appUrl}/accounts?connection_request=pending`);
  assert.throws(() => signInReturnUrl(appUrl, 'https://evil.example'));
});
