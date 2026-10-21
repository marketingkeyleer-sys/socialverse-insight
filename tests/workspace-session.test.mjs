import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionChoice, saveSessionChoice, onboardingStep } from '../src/lib/workspaceSession.ts';

test('workspace navigation survives OAuth reload and stays separated by signed-in user', () => {
  const values = new Map();
  globalThis.window = { sessionStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } };
  saveSessionChoice('socialverse:brand:A', 'company-a');
  saveSessionChoice('socialverse:onboarding:A', '3');
  assert.equal(sessionChoice('socialverse:brand:A'), 'company-a');
  assert.equal(sessionChoice('socialverse:brand:B'), null);
  assert.equal(onboardingStep(sessionChoice('socialverse:onboarding:A')), 3);
  assert.equal(onboardingStep(sessionChoice('socialverse:onboarding:B')), 1);
  saveSessionChoice('socialverse:onboarding:A', null);
  assert.equal(sessionChoice('socialverse:onboarding:A'), null);
  delete globalThis.window;
});

test('unavailable browser storage cannot prevent onboarding or brand navigation', () => {
  globalThis.window = { get sessionStorage() { throw new Error('Storage disabled'); } };
  assert.equal(sessionChoice('brand'), null);
  assert.doesNotThrow(() => saveSessionChoice('brand', 'company-a'));
  assert.doesNotThrow(() => saveSessionChoice('brand', null));
  delete globalThis.window;
});

test('corrupted saved onboarding steps recover to the welcome screen', () => {
  for (const invalid of [null, '', '0', '5', '-1', 'NaN', '3.5', '03']) assert.equal(onboardingStep(invalid), 1);
  for (const valid of ['1', '2', '3', '4']) assert.equal(onboardingStep(valid), Number(valid));
});
