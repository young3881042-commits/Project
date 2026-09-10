import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { travelApi, TRAVEL_RESULT_EVENT } from './travelApi.js';

test('native travel response correlates request ids and removes event listeners', async () => {
  const target = new EventTarget(); target.crypto = { randomUUID };
  target.AiAssistantNative = { requestTravelAction(id, action, raw) {
    assert.equal(action, 'status'); assert.equal(raw, '{}');
    queueMicrotask(() => {
      target.dispatchEvent(new CustomEvent(TRAVEL_RESULT_EVENT, { detail: { requestId: 'wrong', error: 'ignored' } }));
      target.dispatchEvent(new CustomEvent(TRAVEL_RESULT_EVENT, { detail: { requestId: id, data: { connected: true } } }));
    });
  } };
  assert.deepEqual(await travelApi('status', {}, target), { connected: true });
});
test('native error preserves authentication status and unsafe web deployments fail closed', async () => {
  const target = new EventTarget(); target.crypto = { randomUUID };
  target.AiAssistantNative = { requestTravelAction(id) { queueMicrotask(() => target.dispatchEvent(new CustomEvent(TRAVEL_RESULT_EVENT, { detail: { requestId: id, status: 401, error: '연결 필요' } }))); } };
  await assert.rejects(travelApi('status', {}, target), error => error.status === 401);
  await assert.rejects(travelApi('status', {}, { location: { origin: 'https://example.com' } }), /Android 앱/);
  await assert.rejects(travelApi('shell', {}, target), /지원하지/);
});
