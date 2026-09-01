import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOrbitStorageStatus,
  initializeOrbitIndexedDbStorage,
  isOrbitDataKey
} from './orbitIndexedDbStorage.js';

test('IndexedDB mirror only accepts Orbit life-record keys', () => {
  assert.equal(isOrbitDataKey('codex-personal-scheduler-items:guestuser'), true);
  assert.equal(isOrbitDataKey('codex-ai-note-blocks:guestuser'), true);
  assert.equal(isOrbitDataKey('ai-assistant-budget-entries:guestuser'), true);
  assert.equal(isOrbitDataKey('orbit.finance-budget:v1:guestuser'), true);
  assert.equal(isOrbitDataKey('codex-workspace-auth'), false);
  assert.equal(isOrbitDataKey('lifehub-bridge-token:guestuser'), false);
});

test('IndexedDB unavailable environments keep the local compatibility store', async () => {
  const result = await initializeOrbitIndexedDbStorage();
  assert.equal(result.mode, 'local');
  assert.equal(result.state, 'unsupported');
  assert.deepEqual(getOrbitStorageStatus(), result);
});
