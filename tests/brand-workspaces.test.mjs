import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountsForBrand, platformFollowerTotals, postBrandFilter, ALL_BRANDS, UNGROUPED } from '../src/lib/brandScope.ts';
import { selectPublishTargets } from '../supabase/functions/_shared/publish-policy.ts';
import { platformPostContent, validatePlatformDraft } from '../supabase/functions/_shared/content-policy.ts';

const accounts = [
  { id: 'a-fb', user_id: 'owner', brand_id: 'company-a', platform: 'facebook', followers_count: 111, is_active: true },
  { id: 'a-yt', user_id: 'owner', brand_id: 'company-a', platform: 'youtube', followers_count: 222, is_active: true },
  { id: 'b-fb', user_id: 'owner', brand_id: 'company-b', platform: 'facebook', followers_count: 900, is_active: true },
  { id: 'loose', user_id: 'owner', brand_id: null, platform: 'facebook', followers_count: 7, is_active: true },
];
test('companies retain their own channels and independent follower totals', () => {
  const first = accountsForBrand(accounts, 'company-a');
  assert.deepEqual(first.map((a) => a.id), ['a-fb', 'a-yt']);
  assert.equal(first.reduce((sum, a) => sum + a.followers_count, 0), 333);
  assert.equal(accountsForBrand(accounts, 'company-b').reduce((sum, a) => sum + a.followers_count, 0), 900);
  assert.deepEqual(accountsForBrand(accounts, UNGROUPED).map((a) => a.id), ['loose']);
  assert.deepEqual(accountsForBrand(accounts, 'empty-company'), []);
  assert.equal(accountsForBrand(accounts, ALL_BRANDS).length, 4);
});
test('portfolio platform totals include every account without duplicating another platform', () => {
  assert.deepEqual([...platformFollowerTotals(accounts)], [['facebook', 1018], ['youtube', 222]]);
});
test('post filters scope empty companies and retain legacy explicit account destinations', () => {
  assert.equal(postBrandFilter('company-a', []), 'brand_id.eq.company-a');
  assert.match(postBrandFilter('company-a', ['a-fb']), /brand_id\.eq\.company-a/);
  assert.match(postBrandFilter('company-a', ['a-fb']), /connected_account_ids\.ov\.\{a-fb\}/);
  assert.equal(postBrandFilter(ALL_BRANDS, []), null);
  assert.match(postBrandFilter(UNGROUPED, []), /brand_id.is.null/);
});
test('publisher refuses another company destination even for the same owner', () => {
  const post = { user_id: 'owner', brand_id: 'company-a', platforms: ['facebook'], connected_account_ids: ['b-fb'] };
  assert.throws(() => selectPublishTargets('owner', post, accounts), /selected account/);
  assert.deepEqual(selectPublishTargets('owner', { ...post, connected_account_ids: ['a-fb'] }, accounts).map((a) => a.id), ['a-fb']);
});
test('each platform resolves its own caption, title and media without common-content leakage', () => {
  const post = { content: 'Shared brief', title: 'Working title', media_urls: ['shared.jpg'], platform_content: {
    facebook: { content: 'Community announcement', media_urls: ['facebook.jpg'] },
    linkedin: { content: 'Professional case study', media_urls: [] },
    youtube: { content: 'Video description', title: 'Video title', media_urls: ['video.mp4'] },
  } };
  assert.equal(platformPostContent(post, 'facebook').content, 'Community announcement');
  assert.equal(platformPostContent(post, 'linkedin').content, 'Professional case study');
  assert.deepEqual(platformPostContent(post, 'linkedin').media_urls, []);
  assert.deepEqual(platformPostContent(post, 'facebook').media_urls, ['facebook.jpg']);
  assert.equal(platformPostContent(post, 'youtube').title, 'Video title');
  assert.equal(post.content, 'Shared brief');
});
test('legacy posts remain compatible and invalid variants fail before publishing', () => {
  assert.equal(platformPostContent({ content: 'Legacy caption' }, 'facebook').content, 'Legacy caption');
  assert.throws(() => platformPostContent({ content: 'Shared', platform_content: { facebook: { media_urls: [] } } }, 'facebook'), /caption/);
  assert.throws(() => validatePlatformDraft('instagram', { content: 'Image needed', media_urls: [] }), /image/);
  assert.throws(() => validatePlatformDraft('youtube', { content: 'Video needed', media_urls: ['image.jpg'] }), /video/);
  assert.throws(() => validatePlatformDraft('linkedin', { content: 'x'.repeat(3001), media_urls: [] }), /character limit/);
});
